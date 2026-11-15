import Stripe from "stripe";
import { PREMIUM_OFFERS, confirmPremiumPayment } from "./subscription.ts";
import type { PremiumOrder } from "./subscription.ts";

export type StripeTestOrder = PremiumOrder & {
  sessionId: string;
  checkoutUrl: string;
  eventIds: string[];
};

export function stripeTestEnabled() {
  return process.env.NODE_ENV === "development" && !process.env.VERCEL &&
    process.env.STRIPE_TEST_CHECKOUT_ENABLED === "1" && (process.env.PREMIUM_ENVIRONMENT ?? "test") === "test";
}

export function stripeTestClient() {
  const key = process.env.STRIPE_SECRET_KEY_TEST;
  if (!key || /^(sk|rk)_live_/.test(key)) throw new Error("Clé Stripe de test requise");
  // fetch uses the managed HTTPS proxy when Node is started with NODE_USE_ENV_PROXY=1.
  return new Stripe(key, { httpClient: Stripe.createFetchHttpClient(), maxNetworkRetries: 2 });
}

export function testCheckoutParameters(orderId: string, origin: string): Stripe.Checkout.SessionCreateParams {
  const url = new URL(origin);
  if (!((url.hostname === "127.0.0.1" || url.hostname === "localhost") && url.protocol === "http:")) {
    throw new Error("Le parcours Stripe de test est réservé au serveur local");
  }
  return {
    mode: "payment",
    client_reference_id: orderId,
    integration_identifier: "the_browser_test_checkout_qmrxvnta",
    line_items: [{ price_data: { currency: "eur", unit_amount: PREMIUM_OFFERS.stripe.amountMinor,
      product_data: { name: "The Browser Premium — un mois (test)" } }, quantity: 1 }],
    adaptive_pricing: { enabled: false }, // Preserve the explicitly selected EUR price in this pilot.
    success_url: `${url.origin}/premium/stripe-test?order=${encodeURIComponent(orderId)}`,
    cancel_url: `${url.origin}/premium/stripe-test?order=${encodeURIComponent(orderId)}&cancelled=1`,
  };
}

export const STRIPE_TEST_EVENTS = new Set([
  "checkout.session.completed", "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed", "checkout.session.expired",
]);

/** Receives a signature-verified event and a fresh Session retrieved from Stripe. */
export function applyStripeTestEvent(order: StripeTestOrder, event: Stripe.Event,
  session: Stripe.Checkout.Session): StripeTestOrder {
  if (!STRIPE_TEST_EVENTS.has(event.type)) return order;
  const snapshot = event.data.object as Stripe.Checkout.Session;
  if (event.livemode || session.livemode || snapshot.id !== order.sessionId || session.id !== order.sessionId ||
      session.client_reference_id !== order.id || session.mode !== "payment" ||
      session.currency !== "eur" || session.amount_total !== PREMIUM_OFFERS.stripe.amountMinor ||
      order.provider !== "stripe" || order.amountMinor !== PREMIUM_OFFERS.stripe.amountMinor || order.currency !== "EUR") {
    throw new Error("Session incompatible avec la commande de test");
  }
  if (order.eventIds.includes(event.id)) return order;
  let next = order;
  if ((event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") &&
      snapshot.payment_status === "paid" && session.payment_status === "paid" && session.status === "complete") {
    if (typeof session.payment_intent !== "string" || !Number.isFinite(event.created) || event.created <= 0) {
      throw new Error("Confirmation Stripe incomplète");
    }
    next = { ...order, ...confirmPremiumPayment(order, { orderId: order.id, provider: "stripe",
      paymentId: session.payment_intent, amountMinor: session.amount_total, currency: "EUR",
      paidAt: new Date(event.created * 1000).toISOString() }) };
  } else if (order.status !== "confirmed" && session.payment_status !== "paid") {
    if (event.type === "checkout.session.async_payment_failed") next = { ...order, status: "failed" };
    if (event.type === "checkout.session.expired" && session.status === "expired") next = { ...order, status: "cancelled" };
  }
  return { ...next, eventIds: [...order.eventIds, event.id] };
}
