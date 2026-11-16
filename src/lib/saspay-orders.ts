import { premiumRedis, validPremiumOrderId } from "./premium-redis.ts";
import type { StoredPremiumOrder } from "./premium-redis.ts";
import { saspayTestClient, SasPayError, verifiedSasPayResult } from "./saspay.ts";

export async function refreshSasPayTestOrder(order: StoredPremiumOrder) {
  if (order.environment !== "test" || !order.providerSessionId) throw new SasPayError("PAYMENT_MISMATCH");
  const payment = await saspayTestClient().verify(order.providerSessionId);
  const result = verifiedSasPayResult(order, payment);
  const store = premiumRedis("test");
  if (result.status === "confirmed") return store.confirmPayment(result.payment);
  if (result.status === "failed" || result.status === "cancelled") return store.markUnpaid(order.id, order.providerSessionId, result.status);
  return order;
}

/** A push can complete before the initiating request saves its payment ID.
 * Recover only from the exact server-authored description returned by verify/;
 * never infer an owner from unverified webhook metadata or browser input. */
export async function findSasPayTestOrder(paymentId: string) {
  const store = premiumRedis("test");
  const known = await store.findBySession("saspay", paymentId);
  if (known) return known;
  const payment = await saspayTestClient().verify(paymentId);
  const match = typeof payment.description === "string" ? payment.description.match(/^The Browser Premium test — commande (.+)$/) : null;
  if (!match || !validPremiumOrderId(match[1])) return null;
  const order = await store.getOrder(match[1]);
  if (!order || order.environment !== "test" || order.provider !== "saspay") return null;
  verifiedSasPayResult({ ...order, providerSessionId: paymentId }, payment);
  return store.bindSession(order.id, paymentId);
}
