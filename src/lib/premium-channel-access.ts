import { randomUUID } from "node:crypto";
import { premiumRedis, premiumRedisCommand } from "./premium-redis.ts";
import type { StoredPremiumOrder } from "./premium-redis.ts";
import { hasPremiumAccess } from "./subscription.ts";

export function premiumChannelAccessEnabled() {
  return process.env.PREMIUM_TELEGRAM_ACCESS_ENABLED === "1" && process.env.PREMIUM_ENVIRONMENT === "live";
}
export type ChannelAccess = {
  userId: string; channelId: string; status: "invited" | "member" | "removing" | "banned" | "expired";
  expiresAt: string; invite?: string; inviteExpiresAt?: number;
};
export interface AccessStore {
  load(user: string): Promise<ChannelAccess | null>;
  save(value: ChannelAccess): Promise<void>;
  assertLease(): Promise<void>;
}
export interface ChannelBot {
  member(user: string): Promise<string>;
  invite(expires: number): Promise<string>;
  revoke(invite: string): Promise<void>;
  approve(user: string): Promise<void>;
  decline(user: string): Promise<void>;
  ban(user: string): Promise<void>;
  unban(user: string): Promise<void>;
}
const validUser = (id: string) => /^[1-9]\d{0,15}$/.test(id) && Number.isSafeInteger(Number(id));

/** Only durable, confirmed LIVE orders may produce an entitlement. No test override. */
export function channelEntitlement(orders: StoredPremiumOrder[], user: string, now: Date) {
  if (!validUser(user) || !Number.isFinite(now.getTime())) throw new Error("Identité ou date invalide");
  const active = orders.filter(order => order.environment === "live" && order.telegramUserId === user &&
    order.providerSessionId && order.confirmedPaymentId && hasPremiumAccess(order, now));
  return active.reduce<string | null>((end, order) => !end || Date.parse(order.expiresAt!) > Date.parse(end) ? order.expiresAt! : end, null);
}

/** Dependencies are injected so tests never contact Telegram or a production database. */
export function channelAccessService(channel: string, store: AccessStore, bot: ChannelBot,
  orders: (user: string) => Promise<StoredPremiumOrder[]>, clock = () => new Date()) {
  if (!/^-100\d+$/.test(channel)) throw new Error("Canal privé invalide");
  const entitlement = async (user: string) => channelEntitlement(await orders(user), user, clock());
  async function load(user: string) {
    if (!validUser(user)) throw new Error("Identité invalide");
    const record = await store.load(user);
    if (record && (record.userId !== user || record.channelId !== channel)) throw new Error("Accès incohérent");
    return record;
  }
  async function invite(user: string) {
    const end = await entitlement(user);
    if (!end) throw new Error("Aucun abonnement réel actif");
    const record = await load(user);
    await store.assertLease();
    const member = await bot.member(user);
    if (["administrator", "creator"].includes(member)) throw new Error("Compte administrateur protégé");
    if (member === "member") {
      await store.save({ ...record, userId: user, channelId: channel, status: "member", expiresAt: end });
      return { member: true, expiresAt: end };
    }
    if (member === "kicked") { await store.assertLease(); await bot.unban(user); }
    const now = Math.floor(clock().getTime() / 1000);
    if (record?.invite && record.inviteExpiresAt! > now && record.status === "invited") {
      return { member: false, inviteUrl: record.invite, inviteExpiresAt: record.inviteExpiresAt, expiresAt: end };
    }
    // Short-lived request link: forwarding it never grants admission to another account.
    const until = Math.min(now + 600, Math.floor(Date.parse(end) / 1000));
    if (until <= now) throw new Error("Abonnement expiré");
    await store.assertLease();
    const link = await bot.invite(until);
    await store.save({ userId: user, channelId: channel, status: "invited", expiresAt: end, invite: link, inviteExpiresAt: until });
    return { member: false, inviteUrl: link, inviteExpiresAt: until, expiresAt: end };
  }
  async function join(user: string, link: string) {
    const record = await load(user);
    if (!record || record.invite !== link) return false; // Unknown link/account never approved.
    await store.assertLease();
    const end = await entitlement(user);
    if (!end || !record.inviteExpiresAt || record.inviteExpiresAt <= clock().getTime() / 1000) {
      await bot.decline(user); return true;
    }
    const member = await bot.member(user);
    if (["administrator", "creator"].includes(member)) return true;
    if (member !== "member") { await store.assertLease(); await bot.approve(user); }
    await store.save({ ...record, expiresAt: end, status: "member" });
    return true;
  }
  async function expire(user: string) {
    const record = await load(user);
    if (!record || record.status === "expired") return "ignored";
    // Re-read real payments: another valid order prevents removal, without inventing stacking rules.
    const activeEnd = await entitlement(user);
    if (activeEnd) {
      if (record.status === "banned" || record.status === "removing") {
        await store.assertLease();
        const member = await bot.member(user);
        if (member === "kicked") { await store.assertLease(); await bot.unban(user); }
        await store.save({ ...record, expiresAt: activeEnd, status: member === "member" ? "member" : "invited", invite: undefined, inviteExpiresAt: undefined });
      }
      return "active";
    }
    await store.assertLease();
    const member = await bot.member(user);
    if (["administrator", "creator"].includes(member)) throw new Error("Compte administrateur protégé");
    if (record.invite && record.inviteExpiresAt! > clock().getTime() / 1000) {
      await store.assertLease(); await bot.revoke(record.invite);
    }
    await store.save({ ...record, status: "removing" });
    if (await entitlement(user)) return "active";
    if (member === "member" || member === "restricted") {
      await store.assertLease(); await bot.ban(user);
      await store.save({ ...record, status: "banned" });
    }
    // Crash after ban is recoverable via getChatMember == kicked on the next run.
    if (["member", "restricted", "kicked"].includes(member)) { await store.assertLease(); await bot.unban(user); }
    await store.save({ ...record, status: "expired" });
    return "expired";
  }
  return { invite, join, expire };
}

function configuration() {
  if (!premiumChannelAccessEnabled()) throw new Error("Accès Telegram réel désactivé");
  const channel = process.env.TELEGRAM_PREMIUM_CHANNEL_ID ?? "";
  if (!/^-100\d+$/.test(channel) || channel === process.env.TELEGRAM_CHANNEL_ID || !process.env.TELEGRAM_BOT_TOKEN) {
    throw new Error("Canal privé non configuré");
  }
  return channel;
}
function telegramChannelBot(channel: string): ChannelBot {
  async function call(method: string, data: Record<string, unknown>) {
    try {
      const r = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: channel, ...data }),
        redirect: "error", signal: AbortSignal.timeout(10_000), cache: "no-store",
      });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error();
      return j.result;
    } catch { throw new Error("Action Telegram différée"); }
  }
  return {
    member: async user => (await call("getChatMember", { user_id: Number(user) })).status,
    invite: async expires => {
      const result = await call("createChatInviteLink", { creates_join_request: true, expire_date: expires });
      const u = new URL(result.invite_link);
      if (u.protocol !== "https:" || u.hostname !== "t.me" || u.username || u.password || u.port || !result.creates_join_request) throw new Error("Invitation invalide");
      return u.toString();
    },
    revoke: async link => { await call("revokeChatInviteLink", { invite_link: link }); },
    approve: async user => { await call("approveChatJoinRequest", { user_id: Number(user) }); },
    decline: async user => { await call("declineChatJoinRequest", { user_id: Number(user) }); },
    ban: async user => { await call("banChatMember", { user_id: Number(user) }); },
    unban: async user => { await call("unbanChatMember", { user_id: Number(user), only_if_banned: true }); },
  };
}
const prefix = "the-browser:{premium:live}:channel-access:";
/** One lease per Telegram user. Saves fail closed when the lease is lost. */
export async function withChannelAccess<T>(user: string, operation: (service: ReturnType<typeof channelAccessService>) => Promise<T>) {
  const channel = configuration();
  if (!validUser(user)) throw new Error("Identité invalide");
  const token = randomUUID(), lock = `${prefix}lock:${user}`, key = `${prefix}user:${user}`;
  if (await premiumRedisCommand(["SET", lock, token, "NX", "EX", 120]) !== "OK") throw new Error("Accès occupé, réessayer");
  const store: AccessStore = {
    assertLease: async () => { if (await premiumRedisCommand(["GET", lock]) !== token) throw new Error("Verrou expiré"); },
    load: async () => {
      const raw = await premiumRedisCommand(["GET", key]);
      if (raw === null) return null;
      if (typeof raw !== "string") throw new Error("Accès corrompu");
      const v = JSON.parse(raw) as ChannelAccess;
      if (!v || !["invited", "member", "removing", "banned", "expired"].includes(v.status) || !Number.isFinite(Date.parse(v.expiresAt))) throw new Error("Accès corrompu");
      return v;
    },
    save: async record => {
      const result = await premiumRedisCommand(["EVAL", "if redis.call('GET',KEYS[1])~=ARGV[1] then return 0 end redis.call('SET',KEYS[2],ARGV[2]) redis.call('SADD',KEYS[3],ARGV[3]) return 1", 3,
        lock, key, `${prefix}users`, token, JSON.stringify(record), user]);
      if (result !== 1) throw new Error("Verrou expiré");
    },
  };
  try { return await operation(channelAccessService(channel, store, telegramChannelBot(channel), user => premiumRedis("live").activeOrders(user))); }
  finally { await premiumRedisCommand(["EVAL", "if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('DEL',KEYS[1]) end return 0", 1, lock, token]); }
}

/** Cursor-based batch; failures remain registered for a later retry. */
export async function expireChannelAccessBatch(cursor = "0") {
  configuration();
  if (!/^\d+$/.test(cursor)) throw new Error("Curseur invalide");
  const response = await premiumRedisCommand(["SSCAN", `${prefix}users`, cursor, "COUNT", 25]);
  if (!Array.isArray(response) || !Array.isArray(response[1])) throw new Error("Index invalide");
  let failed = 0;
  for (const user of response[1]) {
    try { await withChannelAccess(String(user), service => service.expire(String(user))); } catch { failed++; }
  }
  return { cursor: String(response[0]), processed: response[1].length, failed };
}
