import { premiumRedis } from "./premium-redis.ts";
import type { StoredPremiumOrder } from "./premium-redis.ts";
import { ensureLiveSasPayCheckout, refreshLivePayment, stripeLiveClient, verifiedLiveStripeSession } from "./premium-sales.ts";
import { saspayLiveClient, verifiedSasPayCheckout } from "./saspay.ts";

export class PaymentChangeBlocked extends Error {}
const blocked = () => new PaymentChangeBlocked("Ce paiement est confirmé ou en cours de traitement. Vérifiez votre commande avant de changer de moyen de paiement.");

/** Caller holds the account purchase lock. Never erase payment history or mark
 * cancelled solely from a browser action: close the remote checkout first. */
export async function cancelLivePayment(order: StoredPremiumOrder, lease: () => Promise<void>) {
  if (order.environment !== "live" || order.status === "confirmed") throw blocked();
  if (order.status === "cancelled") return order;
  const store = premiumRedis("live");
  if (!order.providerSessionId && order.provider === "saspay") order = await ensureLiveSasPayCheckout(order);
  // An ambiguous Stripe creation must be reconciled, never assumed absent.
  if (!order.providerSessionId) throw blocked();
  const current = order;
  if (current.provider === "saspay") {
    if (current.providerFlow !== "checkout") throw blocked();
    const client = saspayLiveClient(), state = await client.checkoutStatus(current.providerSessionId!);
    const session = await client.checkout(current.providerSessionId!);
    verifiedSasPayCheckout(current, session);
    if (state.status === "PAID") { await refreshLivePayment(current); throw blocked(); }
    // A linked transaction could finish AFTER cancellation of its session.
    // Keep the purchase blocked while any such transaction is unresolved.
    if (state.transaction_id || session.transaction) throw blocked();
    if (state.status === "PENDING") { await lease(); await client.cancelCheckout(current.providerSessionId!); }
    const after = await client.checkoutStatus(current.providerSessionId!);
    if (after.id !== current.providerSessionId || !["CANCELLED", "EXPIRED"].includes(after.status) || after.transaction_id) throw blocked();
  } else {
    const client = stripeLiveClient();
    let session = await client.checkout.sessions.retrieve(current.providerSessionId!);
    if (verifiedLiveStripeSession(current, session)) { await refreshLivePayment(current); throw blocked(); }
    if (session.payment_status !== "unpaid" || !["open", "expired"].includes(session.status ?? "")) throw blocked();
    if (session.status === "open") { await lease(); await client.checkout.sessions.expire(session.id); }
    session = await client.checkout.sessions.retrieve(session.id);
    verifiedLiveStripeSession(current, session);
    if (session.status !== "expired" || session.payment_status !== "unpaid") throw blocked();
  }
  await lease();
  const saved = await store.markUnpaid(current.id, current.providerSessionId!, "cancelled");
  if (saved.status !== "cancelled") throw blocked();
  return saved;
}
