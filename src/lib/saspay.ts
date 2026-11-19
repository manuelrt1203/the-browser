import { createHmac, timingSafeEqual } from "node:crypto";
import type { StoredPremiumOrder } from "./premium-redis.ts";
import { paymentTestRuntime } from "./payment-test-runtime.ts";

export const sasPayOrderDescription = (orderId: string, environment: "test" | "live" = "test") =>
  `The Browser Premium${environment === "test" ? " test" : ""} — commande ${orderId}`;
export class SasPayError extends Error {
  readonly code: string;
  constructor(code: string) { super(`SasPay : ${code}`); this.code = code; }
}
export function saspayTestEnabled() {
  return paymentTestRuntime("SASPAY_TEST_ENABLED");
}
export function sasPayId(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export function saspayTestClient(key = process.env.SASPAY_API_KEY_TEST ?? "") {
  return sasPayClient("test", key);
}
export function saspayLiveClient(key = process.env.SASPAY_API_KEY ?? "") {
  if (process.env.SASPAY_LIVE_FEE_MODE !== "DEDUCTED") throw new SasPayError("FEE_POLICY_REQUIRED");
  return sasPayClient("live", key);
}
function sasPayClient(environment: "test" | "live", key: string) {
  const API = environment === "test" ? "https://sandbox-api.saspay.me/api/v1" : "https://api.saspay.me/api/v1";
  // The two exported clients select fixed, separate API origins. No redirects
  // or runtime base override may turn a test request into a real payment.
  // Reject keys of the other mode and proxy placeholders as an extra check.
  if (!key.startsWith(environment === "test" ? "sk_test_" : "sk_live_") || key.length < 16) throw new SasPayError("KEY_MODE_REQUIRED");
  async function request(path: string, body?: unknown, idempotencyKey?: string): Promise<unknown> {
    let response;
    try {
      response = await fetch(`${API}${path}`, { method: body === undefined ? "GET" : "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json",
          ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        cache: "no-store", redirect: "error", signal: AbortSignal.timeout(20_000) });
    } catch { throw new SasPayError("NETWORK"); }
    let data;
    try { data = await response.json(); } catch { throw new SasPayError("RESPONSE"); }
    if (!response.ok || !data || (typeof data === "object" && data.success === false)) throw new SasPayError("PROVIDER_ERROR");
    return typeof data === "object" && "data" in data ? data.data : data;
  }
  async function networks() {
    const countries = await request("/countries/");
    if (!Array.isArray(countries)) throw new SasPayError("COUNTRIES");
    const country = countries.find(c => c.iso_code === "CG" && c.is_active === true);
    if (!country || !sasPayId(country.id) || country.default_currency !== "XAF") throw new SasPayError("COUNTRY_UNAVAILABLE");
    const result: { code: string; name: string }[] = [];
    for (let page = 1; page <= 20; page++) {
      const data = await request(`/networks/?page_size=100&page=${page}`) as { results?: unknown[]; next?: unknown };
      if (!data || !Array.isArray(data.results)) throw new SasPayError("NETWORKS");
      for (const value of data.results) {
        const network = value as { country?: string; code?: string; name?: string; is_active?: boolean };
        if (network.country === country.id && network.is_active === true && typeof network.name === "string" &&
            /\b(MTN|Airtel)\b/i.test(network.name) && typeof network.code === "string" && /^[a-z0-9_-]{1,80}$/i.test(network.code)) {
          result.push({ code: network.code, name: network.name });
        }
      }
      if (!data.next) return result;
    }
    throw new SasPayError("CATALOGUE_TOO_LARGE");
  }
  async function initiate(orderId: string, input: unknown) {
    if (!sasPayId(orderId)) throw new SasPayError("ORDER_ID");
    const customer = sasPayCustomer(input);
    const available = await networks();
    if (!available.some(n => n.code === customer.network)) throw new SasPayError("NETWORK_UNAVAILABLE");
    const data = await request("/payments/softpay/", {
      amount: "3000.00", currency: "XAF", country: "CG", network: customer.network,
      description: sasPayOrderDescription(orderId, environment),
      ...(environment === "live" ? { fee_charge_mode: "DEDUCTED" } : {}),
      customer: { email: customer.email, first_name: customer.firstName, last_name: customer.lastName, phone: customer.phone },
      metadata: { order_id: orderId },
    }, `the-browser-saspay-${environment}-${orderId}`) as { id?: string; status?: string; checkout_url?: string; instructions?: string };
    if (!data || !sasPayId(data.id)) throw new SasPayError("PAYMENT_RESPONSE");
    let checkoutUrl: string | null = null;
    if (data.checkout_url) {
      const url = new URL(data.checkout_url);
      if (url.protocol !== "https:" || url.hostname !== (environment === "test" ? "sandbox-checkout.saspay.me" : "pay.saspay.me") || url.username || url.password || url.port) {
        throw new SasPayError("REDIRECT_UNSUPPORTED");
      }
      checkoutUrl = url.toString();
    }
    return { id: data.id, checkoutUrl };
  }
  async function verify(paymentId: string) {
    if (!sasPayId(paymentId)) throw new SasPayError("PAYMENT_ID");
    return await request(`/payments/${paymentId}/verify/`) as SasPayPayment;
  }
  async function merchantCheck() { await request("/pricing/my-rates/"); return true; }
  async function webhookConfigured(expectedUrl: string) {
    async function records(path: string) {
      const rows: Record<string, unknown>[] = [];
      for (let page = 1; page <= 20; page++) {
        const data = await request(`${path}?page_size=100&page=${page}`) as { results?: Record<string, unknown>[]; next?: unknown };
        if (!Array.isArray(data.results)) throw new SasPayError("WEBHOOK_CONFIG");
        rows.push(...data.results);
        if (!data.next) return rows;
      }
      throw new SasPayError("CATALOGUE_TOO_LARGE");
    }
    const hooks = await records("/merchant-webhooks/");
    const subscriptions = await records("/merchant-webhook-subscriptions/");
    return hooks.some(hook => hook.url === expectedUrl && hook.is_active === true && hook.environment === (environment === "live" ? "LIVE" : "SANDBOX") &&
      ["transaction.success", "transaction.failed", "transaction.cancelled"].every(event => subscriptions.some(s => s.webhook === hook.id && s.event_type === event)));
  }
  return { networks, initiate, verify, merchantCheck, webhookConfigured };
}

export function sasPayCustomer(input: unknown) {
  if (!input || typeof input !== "object") throw new SasPayError("CUSTOMER");
  const value = input as Record<string, unknown>;
  const get = (name: string) => typeof value[name] === "string" ? value[name].trim() : "";
  const firstName = get("firstName"), lastName = get("lastName"), email = get("email"), network = get("network");
  const phone = get("phone").replace(/[ ()-]/g, "");
  if (!firstName || firstName.length > 80 || !lastName || lastName.length > 80 || email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^\+242\d{9}$/.test(phone) || !/^[a-z0-9_-]{1,80}$/i.test(network)) {
    throw new SasPayError("CUSTOMER");
  }
  return { firstName, lastName, email, phone, network };
}

/** A proxy substitution marker is not the signing secret and cannot be used for local HMAC. */
export function sasPayWebhookSecretConfigured(secret: string | undefined): secret is string {
  return !!secret?.trim() && !/^_+.*codex.*secret.*__$/i.test(secret);
}

export function verifySasPaySignature(body: string | Uint8Array, signature: string, timestamp: string, secret: string, now = Date.now()) {
  if (!sasPayWebhookSecretConfigured(secret) || !/^[0-9a-f]{64}$/.test(signature) || !/^[1-9]\d{8,11}$/.test(timestamp) ||
      !Number.isFinite(now) || Math.abs(now / 1000 - Number(timestamp)) > 300) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.`).update(body).digest();
  return timingSafeEqual(Buffer.from(signature, "hex"), expected);
}

export type SasPayPayment = {
  id: string; status: string; currency: string; requested_amount: string;
  transaction_type: string; flow_direction: string; updated_at: string; description: string;
};
export function verifiedSasPayResult(order: StoredPremiumOrder, payment: SasPayPayment) {
  if (!payment || order.provider !== "saspay" || !sasPayId(payment.id) || order.providerSessionId !== payment.id ||
      order.amountMinor !== 3000 || order.currency !== "XAF" || payment.currency !== "XAF" ||
      typeof payment.requested_amount !== "string" || !/^3000(?:\.0{1,2})?$/.test(payment.requested_amount) ||
      payment.transaction_type !== "PAIEMENT" || payment.flow_direction !== "INBOUND" ||
      !["test", "live"].includes(order.environment) || payment.description !== sasPayOrderDescription(order.id, order.environment)) throw new SasPayError("PAYMENT_MISMATCH");
  if (payment.status === "SUCCESS") {
    if (!Number.isFinite(Date.parse(payment.updated_at))) throw new SasPayError("PAYMENT_DATE");
    return { status: "confirmed" as const, payment: { orderId: order.id, provider: "saspay" as const, sessionId: payment.id,
      paymentId: payment.id, amountMinor: 3000, currency: "XAF", paidAt: payment.updated_at } };
  }
  if (payment.status === "FAILED") return { status: "failed" as const };
  if (payment.status === "CANCELLED") return { status: "cancelled" as const };
  return { status: "pending" as const };
}
