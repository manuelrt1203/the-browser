import Stripe from "stripe";
import { randomUUID } from "node:crypto";
import { premiumRedis, premiumRedisCommand } from "./premium-redis.ts";
import type { StoredPremiumOrder } from "./premium-redis.ts";
import { PREMIUM_OFFERS, hasPremiumAccess } from "./subscription.ts";
import { saspayLiveClient, sasPayOrderDescription, verifiedSasPayResult, sasPayWebhookSecretConfigured, verifiedSasPayCheckout, verifiedSasPayCheckoutResult } from "./saspay.ts";

export function livePaymentRuntime(env = process.env) {
  return env.VERCEL === "1" && env.VERCEL_ENV === "production" && env.PREMIUM_ENVIRONMENT === "live";
}
/** Explicit owner activation and usable live credentials are required. */
export function premiumSalesEnabled(env = process.env) {
  return livePaymentRuntime(env) && env.PREMIUM_SALES_ENABLED === "1" &&
    env.PREMIUM_TELEGRAM_AUTH_ENABLED === "1" && env.PREMIUM_TELEGRAM_ACCESS_ENABLED === "1" &&
    ["SELLER_NAME", "COMMERCIAL_TERMS_VERSION"].every(k => !!env[k]?.trim()) &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(env.SUPPORT_EMAIL ?? "") &&
    (liveProviderEnabled("stripe", env) || liveProviderEnabled("saspay", env));
}
export function liveProviderReady(provider: "stripe" | "saspay", env = process.env) {
  if (provider === "stripe") return /^(sk|rk)_live_/.test(env.STRIPE_SECRET_KEY ?? "") && /^whsec_/.test(env.STRIPE_WEBHOOK_SECRET_LIVE ?? "");
  return /^sk_live_/.test(env.SASPAY_API_KEY ?? "") && sasPayWebhookSecretConfigured(env.SASPAY_WEBHOOK_SECRET) && env.SASPAY_LIVE_FEE_MODE === "DEDUCTED";
}
/** Enable each method independently only after its private live checks succeed. */
export function liveProviderEnabled(provider: "stripe" | "saspay", env = process.env) {
  return env[provider === "stripe" ? "STRIPE_LIVE_ENABLED" : "SASPAY_LIVE_ENABLED"] === "1" && liveProviderReady(provider, env);
}
export function stripeLiveClient(key = process.env.STRIPE_SECRET_KEY ?? "") {
  if (!/^(sk|rk)_live_/.test(key)) throw new Error("Clé Stripe live réelle requise");
  return new Stripe(key, { httpClient: Stripe.createFetchHttpClient(), maxNetworkRetries: 2 });
}
export async function stripeLiveAccountState(client = stripeLiveClient()) {
  const [balance, account] = await Promise.all([client.balance.retrieve(), client.accounts.retrieve(null)]);
  return { liveMode: balance.livemode === true, chargesEnabled: account.charges_enabled === true, payoutsEnabled: account.payouts_enabled === true };
}
export async function stripeLiveAccountReady(client = stripeLiveClient()) {
  const state = await stripeLiveAccountState(client);
  return state.liveMode && state.chargesEnabled && state.payoutsEnabled;
}
export async function stripeLiveWebhookConfigured(client: Stripe, expectedUrl: string) {
  const endpoints = await client.webhookEndpoints.list({ limit: 100 });
  const events = ["checkout.session.completed", "checkout.session.async_payment_succeeded", "checkout.session.async_payment_failed", "checkout.session.expired"];
  return endpoints.data.some(endpoint => endpoint.livemode && endpoint.status === "enabled" && endpoint.url === expectedUrl &&
    (endpoint.enabled_events.includes("*") || events.every(event => endpoint.enabled_events.includes(event))));
}
export function liveCheckoutParameters(orderId: string, origin: string): Stripe.Checkout.SessionCreateParams {
  const url = new URL(origin);
  if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) throw new Error("Origine invalide");
  return { mode: "payment", client_reference_id: orderId,
    line_items: [{ price_data: { currency: "eur", unit_amount: PREMIUM_OFFERS.stripe.amountMinor, product_data: { name: "The Browser Premium — un mois" } }, quantity: 1 }],
    adaptive_pricing: { enabled: false },
    success_url: `${url.origin}/premium?order=${encodeURIComponent(orderId)}`,
    cancel_url: `${url.origin}/premium?order=${encodeURIComponent(orderId)}&cancelled=1`,
  };
}
export function verifiedLiveStripeSession(order: StoredPremiumOrder, session: Stripe.Checkout.Session) {
  if (order.environment !== "live" || order.provider !== "stripe" || !session.livemode ||
      !session.id.startsWith("cs_live_") || order.providerSessionId !== session.id || session.client_reference_id !== order.id ||
      session.mode !== "payment" || session.currency !== "eur" || session.amount_total !== 457 || order.currency !== "EUR" || order.amountMinor !== 457) throw new Error("Session incompatible");
  if (session.status === "complete" && session.payment_status === "paid") {
    if (typeof session.payment_intent !== "string" || !session.payment_intent.startsWith("pi_")) throw new Error("Paiement incomplet");
    return session.payment_intent;
  }
  return null;
}
export async function refreshLivePayment(order: StoredPremiumOrder, paidAt = new Date().toISOString()) {
  if (order.environment !== "live" || !order.providerSessionId) throw new Error("Commande live requise");
  const store = premiumRedis("live");
  if (order.provider === "saspay") {
    if (order.providerFlow === "checkout") {
      const client = saspayLiveClient();
      const state = await client.checkoutStatus(order.providerSessionId);
      // Read detail AFTER status, which can update the linked transaction.
      const session = await client.checkout(order.providerSessionId);
      const payment = state.status === "PAID" && state.transaction_id ? await client.verify(state.transaction_id) : undefined;
      const result = verifiedSasPayCheckoutResult(order, session, state, payment);
      if (result.status === "confirmed") return store.confirmPayment(result.payment);
      if (result.status === "cancelled") return store.markUnpaid(order.id, order.providerSessionId, result.status);
      return order;
    }
    const result = verifiedSasPayResult(order, await saspayLiveClient().verify(order.providerSessionId));
    if (result.status === "confirmed") return store.confirmPayment(result.payment);
    if (result.status === "failed" || result.status === "cancelled") return store.markUnpaid(order.id, order.providerSessionId, result.status);
  } else {
    const session = await stripeLiveClient().checkout.sessions.retrieve(order.providerSessionId);
    const payment = verifiedLiveStripeSession(order, session);
    if (payment) return store.confirmPayment({ orderId: order.id, provider: "stripe", sessionId: session.id, paymentId: payment, amountMinor: 457, currency: "EUR", paidAt });
    if (session.status === "expired") return store.markUnpaid(order.id, session.id, "cancelled");
  }
  return order;
}
export async function findLiveSasPayOrder(paymentId: string) {
  const store = premiumRedis("live");
  const known = await store.findBySession("saspay", paymentId);
  if (known) return known;
  const payment = await saspayLiveClient().verify(paymentId);
  const prefix = sasPayOrderDescription("", "live");
  if (!payment.description?.startsWith(prefix)) return null;
  const id = payment.description.slice(prefix.length);
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const order = await store.getOrder(id);
  if (!order || order.provider !== "saspay") return null;
  if (order.providerFlow === "checkout") return order;
  // Recover a hosted session saved by SasPay just before a network/Redis failure.
  if (!order.providerSessionId && await premiumRedisCommand(["GET", `the-browser:{premium:live}:saspay-checkout:${id}`])) return ensureLiveSasPayCheckout(order);
  verifiedSasPayResult({ ...order, providerSessionId: paymentId }, payment);
  return store.bindSession(id, paymentId);
}

/** Checkout creation is NOT idempotent at SasPay. A durable creation marker
 * prevents blind retries after an ambiguous network failure; reconcile instead. */
export async function ensureLiveSasPayCheckout(order: StoredPremiumOrder, customer?: { name: string; email: string }, origin?: string) {
  if (order.environment !== "live" || order.provider !== "saspay") throw new Error("Commande SasPay live requise");
  if (order.providerSessionId) return order; // Also preserves pending legacy softpay payments.
  const marker = `the-browser:{premium:live}:saspay-checkout:${order.id}`;
  const client = saspayLiveClient();
  const creating = customer && origin && await premiumRedisCommand(["SET", marker, "started", "NX"]) === "OK";
  const session = creating ? await client.createCheckout(order.id, customer, origin!) : await client.findCheckout(order.id);
  if (!session) throw new Error("Session en cours de rapprochement ; ne pas recréer");
  const verified = verifiedSasPayCheckout(order, session);
  return premiumRedis("live").bindSession(order.id, verified.id, verified.checkoutUrl, "checkout");
}
/** Serializes purchases for one account; no concurrent provider checkouts. */
export async function withLivePurchase<T>(user: string, operation: (lease: () => Promise<void>) => Promise<T>) {
  if (!/^[1-9]\d{0,15}$/.test(user)) throw new Error("Identité invalide");
  const key = `the-browser:{premium:live}:purchase:${user}`, token = randomUUID();
  if (await premiumRedisCommand(["SET", key, token, "NX", "EX", 120]) !== "OK") throw new Error("Achat déjà en cours");
  const lease = async () => { if (await premiumRedisCommand(["GET", key]) !== token) throw new Error("Verrou perdu"); };
  try { return await operation(lease); }
  finally { await premiumRedisCommand(["EVAL", "if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('DEL',KEYS[1]) end return 0", 1, key, token]); }
}
export function purchaseConflict(orders: StoredPremiumOrder[], id: string, now = new Date()) {
  // Advance renewal/stacking has not been agreed: do not charge for an undefined period.
  return orders.some(o => o.id !== id && (hasPremiumAccess(o, now) || o.status === "pending"));
}
