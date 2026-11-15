import { applyStripeTestEvent, stripeTestClient, stripeTestEnabled, STRIPE_TEST_EVENTS } from "@/lib/stripe-test";
import { premiumRedis, validPremiumOrderId } from "@/lib/premium-redis";
import type Stripe from "stripe";

export async function POST(request: Request) {
  if (!stripeTestEnabled()) return new Response(null, { status: 404 });
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return Response.json({ error: "Webhook de test non configuré" }, { status: 503 });
  let client;
  try { client = stripeTestClient(); }
  catch { return Response.json({ error: "Clé Stripe de test non configurée" }, { status: 503 }); }
  let event: Stripe.Event;
  try {
    event = client.webhooks.constructEvent(await request.text(), request.headers.get("stripe-signature") ?? "", secret);
    if (event.livemode) throw new Error("Événement de production refusé");
  } catch { return Response.json({ error: "Signature ou mode invalide" }, { status: 400 }); }
  if (!STRIPE_TEST_EVENTS.has(event.type)) return Response.json({ received: true });
  try {
    const snapshot = event.data.object as Stripe.Checkout.Session;
    const session = await client.checkout.sessions.retrieve(snapshot.id);
    const id = session.client_reference_id ?? "";
    const store = premiumRedis("test");
    const order = validPremiumOrderId(id) ? await store.getOrder(id) : null;
    if (!order) {
      // Other test integrations on this account do not belong to this pilot.
      return Response.json({ received: true, ignored: true });
    }
    const updated = applyStripeTestEvent({ ...order, sessionId: order.providerSessionId ?? "", checkoutUrl: "", eventIds: [] }, event, session);
    if (updated.status === "confirmed") {
      await store.confirmPayment({ orderId: id, provider: "stripe", sessionId: session.id,
        paymentId: updated.confirmedPaymentId!, amountMinor: updated.amountMinor, currency: updated.currency, paidAt: updated.startsAt! });
    } else if (updated.status === "failed" || updated.status === "cancelled") {
      await store.markUnpaid(id, session.id, updated.status);
    }
    return Response.json({ received: true });
  } catch { return Response.json({ error: "Traitement différé : réessayer la notification" }, { status: 503 }); }
}
