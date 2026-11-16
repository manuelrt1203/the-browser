import { createPremiumOrder, confirmPremiumPayment, hasPremiumAccess } from "./subscription.ts";
import type { PaymentProvider, PremiumOrder } from "./subscription.ts";

export type StoredPremiumOrder = PremiumOrder & {
  telegramUserId: string;
  environment: "test" | "live";
  providerSessionId?: string;
  providerCheckoutUrl?: string;
};

export class PremiumStorageError extends Error {
  readonly code: string;
  constructor(code: string) { super(`Stockage Premium : ${code}`); this.code = code; }
}

// All keys share a Redis Cluster hash slot, isolated from the public catalogue.
const CREATE = `
local current = redis.call('GET', KEYS[1])
if current then return current end
local userType = redis.call('TYPE', KEYS[2]).ok
if userType ~= 'none' and userType ~= 'set' then return 'CORRUPT' end
redis.call('SET', KEYS[1], ARGV[1])
redis.call('SADD', KEYS[2], ARGV[2])
return ARGV[1]
`;

const BIND = `
local current = redis.call('GET', KEYS[1])
if not current then return 'MISSING' end
if current ~= ARGV[1] then return 'RETRY' end
local owner = redis.call('GET', KEYS[2])
if owner and owner ~= ARGV[3] then return 'SESSION_CONFLICT' end
redis.call('SET', KEYS[1], ARGV[2])
redis.call('SET', KEYS[2], ARGV[3])
return 'OK'
`;

const CONFIRM = `
if #KEYS > 3 and redis.call('EXISTS', KEYS[4]) == 1 then return 'ACCESS_BUSY' end
local current = redis.call('GET', KEYS[1])
if not current then return 'MISSING' end
if current ~= ARGV[1] then return 'RETRY' end
if redis.call('GET', KEYS[3]) ~= ARGV[3] then return 'SESSION_CONFLICT' end
local owner = redis.call('GET', KEYS[2])
if owner and owner ~= ARGV[3] then return 'PAYMENT_CONFLICT' end
redis.call('SET', KEYS[1], ARGV[2])
redis.call('SET', KEYS[2], ARGV[3])
return 'OK'
`;

export function validPremiumOrderId(id: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}
function validTelegramId(id: string) { return typeof id === "string" && /^[1-9]\d{0,15}$/.test(id) && Number.isSafeInteger(Number(id)); }
function providerIdentifier(id: string) {
  if (!/^[A-Za-z0-9_-]{1,200}$/.test(id)) throw new PremiumStorageError("IDENTIFIER");
  return id;
}

export async function premiumRedisCommand(args: (string | number)[]): Promise<unknown> {
  const kv = Boolean(process.env.KV_REST_API_URL || process.env.KV_REST_API_TOKEN);
  const url = kv ? process.env.KV_REST_API_URL : process.env.UPSTASH_REDIS_REST_URL;
  const token = kv ? process.env.KV_REST_API_TOKEN : process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new PremiumStorageError("CONFIG");
  let endpoint;
  try {
    endpoint = new URL(url);
    if (endpoint.protocol !== "https:" || endpoint.username || endpoint.password || endpoint.search || endpoint.hash) throw new Error();
  } catch { throw new PremiumStorageError("CONFIG"); }
  let response;
  try {
    response = await fetch(endpoint.toString(), { method: "POST", headers: {
      Authorization: `Bearer ${token}`, "Content-Type": "application/json",
    }, body: JSON.stringify(args), cache: "no-store", signal: AbortSignal.timeout(10_000) });
  } catch { throw new PremiumStorageError("NETWORK"); }
  let data;
  try { data = await response.json(); } catch { throw new PremiumStorageError("RESPONSE"); }
  if (!response.ok || !data || typeof data !== "object" || Array.isArray(data) || data.error || !("result" in data)) {
    throw new PremiumStorageError("COMMAND");
  }
  return data.result;
}

/** No file fallback. The environment is a server-side setting, never a request parameter. */
export function premiumRedis(environment: "test" | "live") {
  if (environment !== "test" && environment !== "live") throw new PremiumStorageError("ENVIRONMENT");
  const prefix = `the-browser:{premium:${environment}}`;
  const orderKey = (id: string) => {
    if (!validPremiumOrderId(id)) throw new PremiumStorageError("ORDER_ID");
    return `${prefix}:order:${id}`;
  };
  const sessionKey = (provider: PaymentProvider, sessionId: string) =>
    `${prefix}:session:${provider}:${providerIdentifier(sessionId)}`;

  const command = premiumRedisCommand;

  function decode(raw: unknown, id: string): StoredPremiumOrder {
    try {
      if (typeof raw !== "string") throw new Error();
      const value = JSON.parse(raw) as StoredPremiumOrder;
      if (value.id !== id || value.environment !== environment || !validTelegramId(value.telegramUserId) ||
          !["stripe", "saspay"].includes(value.provider) || !["pending", "confirmed", "failed", "cancelled"].includes(value.status)) throw new Error();
      const expected = createPremiumOrder(id, value.provider);
      if (value.currency !== expected.currency || value.amountMinor !== expected.amountMinor) throw new Error();
      if (value.providerSessionId !== undefined) providerIdentifier(value.providerSessionId);
      if (value.providerCheckoutUrl !== undefined) {
        const url = new URL(value.providerCheckoutUrl);
        if (value.provider !== "saspay" || url.protocol !== "https:" || url.hostname !== (environment === "test" ? "sandbox-checkout.saspay.me" : "pay.saspay.me") || url.username || url.password || url.port) throw new Error();
      }
      if (value.status === "confirmed" && (!value.providerSessionId || !value.confirmedPaymentId || !value.startsAt || !value.expiresAt ||
          !Number.isFinite(Date.parse(value.startsAt)) || !Number.isFinite(Date.parse(value.expiresAt)) ||
          Date.parse(value.expiresAt) <= Date.parse(value.startsAt))) throw new Error();
      return value;
    } catch { throw new PremiumStorageError("CORRUPT"); }
  }

  async function load(id: string) {
    const raw = await command(["GET", orderKey(id)]);
    return raw === null ? null : { raw: raw as string, order: decode(raw, id) };
  }

  async function getOrder(id: string): Promise<StoredPremiumOrder | null> { return (await load(id))?.order ?? null; }

  async function findBySession(provider: PaymentProvider, sessionId: string) {
    const id = await command(["GET", sessionKey(provider, sessionId)]);
    if (id === null) return null;
    if (typeof id !== "string" || !validPremiumOrderId(id)) throw new PremiumStorageError("CORRUPT");
    const order = await getOrder(id);
    if (!order || order.provider !== provider || order.providerSessionId !== sessionId) throw new PremiumStorageError("CORRUPT");
    return order;
  }

  /** telegramUserId MUST come from a verified login, not a client-supplied ID. */
  async function createOrder(id: string, telegramUserId: string, provider: PaymentProvider) {
    if (!validTelegramId(telegramUserId) || !["stripe", "saspay"].includes(provider)) throw new PremiumStorageError("IDENTITY");
    const order: StoredPremiumOrder = { ...createPremiumOrder(id, provider), environment, telegramUserId };
    const result = await command(["EVAL", CREATE, 2, orderKey(id), `${prefix}:user:${telegramUserId}:orders`, JSON.stringify(order), id]);
    const saved = decode(result, id);
    if (saved.telegramUserId !== telegramUserId || saved.provider !== provider) throw new PremiumStorageError("ORDER_CONFLICT");
    return saved;
  }

  async function bindSession(id: string, sessionId: string, checkoutUrl?: string) {
    providerIdentifier(sessionId);
    for (let attempt = 0; attempt < 8; attempt++) {
      const current = await load(id);
      if (!current) throw new PremiumStorageError("MISSING");
      if (current.order.providerSessionId && current.order.providerSessionId !== sessionId) throw new PremiumStorageError("SESSION_CONFLICT");
      if (checkoutUrl !== undefined) {
        const url = new URL(checkoutUrl);
        if (current.order.provider !== "saspay" || url.protocol !== "https:" || url.hostname !== (environment === "test" ? "sandbox-checkout.saspay.me" : "pay.saspay.me") || url.username || url.password || url.port) throw new PremiumStorageError("REDIRECT");
        if (current.order.providerCheckoutUrl && current.order.providerCheckoutUrl !== checkoutUrl) throw new PremiumStorageError("SESSION_CONFLICT");
      }
      const updated = { ...current.order, providerSessionId: sessionId,
        ...(checkoutUrl === undefined ? {} : { providerCheckoutUrl: checkoutUrl }) };
      const result = await command(["EVAL", BIND, 2, orderKey(id), sessionKey(updated.provider, sessionId), current.raw, JSON.stringify(updated), id]);
      if (result === "RETRY") continue;
      if (result !== "OK") throw new PremiumStorageError(String(result));
      return updated;
    }
    throw new PremiumStorageError("CONTENTION");
  }

  /** Only call after provider signature/status/mode verification and a fresh payment lookup. */
  async function confirmPayment(input: {
    orderId: string; provider: PaymentProvider; sessionId: string; paymentId: string;
    amountMinor: number; currency: string; paidAt: string;
  }) {
    providerIdentifier(input.paymentId); providerIdentifier(input.sessionId);
    for (let attempt = 0; attempt < 8; attempt++) {
      const current = await load(input.orderId);
      if (!current) throw new PremiumStorageError("MISSING");
      if (current.order.providerSessionId !== input.sessionId) throw new PremiumStorageError("SESSION_CONFLICT");
      let updated: StoredPremiumOrder;
      try {
        updated = { ...current.order, ...confirmPremiumPayment(current.order, { ...input, orderId: input.orderId }) };
      } catch { throw new PremiumStorageError("PAYMENT_MISMATCH"); }
      const accessLock = environment === "live" ? [`${prefix}:channel-access:lock:${current.order.telegramUserId}`] : [];
      const result = await command(["EVAL", CONFIRM, 3 + accessLock.length, orderKey(input.orderId),
        `${prefix}:payment:${input.provider}:${input.paymentId}`, sessionKey(input.provider, input.sessionId), ...accessLock,
        current.raw, JSON.stringify(updated), input.orderId]);
      if (result === "RETRY") continue;
      if (result !== "OK") throw new PremiumStorageError(String(result));
      return updated;
    }
    throw new PremiumStorageError("CONTENTION");
  }

  async function listOrders(telegramUserId: string) {
    if (!validTelegramId(telegramUserId)) throw new PremiumStorageError("IDENTITY");
    const ids = await command(["SMEMBERS", `${prefix}:user:${telegramUserId}:orders`]);
    if (!Array.isArray(ids) || ids.some(id => typeof id !== "string" || !validPremiumOrderId(id))) throw new PremiumStorageError("CORRUPT");
    const orders = await Promise.all(ids.map(id => getOrder(id)));
    if (orders.some(order => !order || order.telegramUserId !== telegramUserId)) throw new PremiumStorageError("CORRUPT");
    return orders as StoredPremiumOrder[];
  }
  async function activeOrders(telegramUserId: string, now = new Date()) {
    if (!Number.isFinite(now.getTime())) throw new PremiumStorageError("IDENTITY");
    return (await listOrders(telegramUserId)).filter(order => hasPremiumAccess(order, now));
  }
  async function markUnpaid(id: string, sessionId: string, status: "failed" | "cancelled") {
    if (status !== "failed" && status !== "cancelled") throw new PremiumStorageError("STATUS");
    for (let attempt = 0; attempt < 8; attempt++) {
      const current = await load(id);
      if (!current) throw new PremiumStorageError("MISSING");
      if (current.order.providerSessionId !== sessionId) throw new PremiumStorageError("SESSION_CONFLICT");
      if (current.order.status === "confirmed") return current.order;
      const updated = { ...current.order, status };
      const result = await command(["EVAL", BIND, 2, orderKey(id), sessionKey(updated.provider, sessionId), current.raw, JSON.stringify(updated), id]);
      if (result === "RETRY") continue;
      if (result !== "OK") throw new PremiumStorageError(String(result));
      return updated;
    }
    throw new PremiumStorageError("CONTENTION");
  }
  return { createOrder, getOrder, bindSession, confirmPayment, activeOrders, listOrders, markUnpaid, findBySession };
}
