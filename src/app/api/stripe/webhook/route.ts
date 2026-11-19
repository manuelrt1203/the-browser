import { livePaymentRuntime, stripeLiveClient, refreshLivePayment } from "@/lib/premium-sales";
import { premiumRedis, validPremiumOrderId } from "@/lib/premium-redis";
import { STRIPE_TEST_EVENTS } from "@/lib/stripe-test";
export async function POST(request: Request) {
  if (!livePaymentRuntime()) return new Response(null, { status: 404 });
  const secret = process.env.STRIPE_WEBHOOK_SECRET_LIVE;
  if (!secret?.startsWith("whsec_")) return new Response(null, { status: 503 });
  let client;
  try { client = stripeLiveClient(); } catch { return new Response(null, { status: 503 }); }
  let event;
  try {
    const body = Buffer.from(await request.arrayBuffer());
    if (body.byteLength > 128_000) return new Response(null, { status: 413 });
    event = client.webhooks.constructEvent(body, request.headers.get("stripe-signature") ?? "", secret);
    if (!event.livemode) throw new Error("Mode test refusé");
  } catch { return new Response(null, { status: 400 }); }
  if (!STRIPE_TEST_EVENTS.has(event.type)) return Response.json({ received: true, ignored: true });
  try {
    const snapshot = event.data.object as { id: string };
    const session = await client.checkout.sessions.retrieve(snapshot.id);
    if (!session.livemode) throw new Error("Session test");
    const id = session.client_reference_id ?? "";
    const store = premiumRedis("live"), order = validPremiumOrderId(id) ? await store.getOrder(id) : null;
    if (!order) return Response.json({ received: true, ignored: true });
    if (order.provider !== "stripe" || order.providerSessionId !== session.id) throw new Error("Session incompatible");
    if (!Number.isFinite(event.created) || event.created <= 0) throw new Error("Date invalide");
    const updated = await refreshLivePayment(order, new Date(event.created * 1000).toISOString());
    if (event.type === "checkout.session.async_payment_failed" && updated.status !== "confirmed") await store.markUnpaid(id, session.id, "failed");
    return Response.json({ received: true });
  } catch { return new Response(null, { status: 503 }); }
}
