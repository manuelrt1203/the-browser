import { saspayTestEnabled, sasPayId, verifySasPaySignature } from "@/lib/saspay";
import { refreshSasPayTestOrder, findSasPayTestOrder } from "@/lib/saspay-orders";

export async function POST(request: Request) {
  if (!saspayTestEnabled()) return new Response(null, { status: 404 });
  const secret = process.env.SASPAY_WEBHOOK_SECRET_TEST;
  if (!secret) return Response.json({ error: "Webhook SasPay non configuré" }, { status: 503 });
  const body = await request.text();
  if (Buffer.byteLength(body) > 128_000) return new Response(null, { status: 413 });
  if (!verifySasPaySignature(body, request.headers.get("x-webhook-signature") ?? "",
      request.headers.get("x-webhook-timestamp") ?? "", secret)) {
    return Response.json({ error: "Signature ou horodatage invalide" }, { status: 400 });
  }
  let event;
  try {
    event = JSON.parse(body);
    if (!event || typeof event.event !== "string" || event.event !== request.headers.get("x-webhook-event")) throw new Error();
  } catch { return Response.json({ error: "Notification invalide" }, { status: 400 }); }
  if (!["transaction.success", "transaction.failed", "transaction.cancelled"].includes(event.event)) {
    return Response.json({ received: true, ignored: true });
  }
  if (!sasPayId(event.data?.id)) return Response.json({ error: "Paiement invalide" }, { status: 400 });
  try {
    const order = await findSasPayTestOrder(event.data.id);
    if (!order) return Response.json({ received: true, ignored: true });
    await refreshSasPayTestOrder(order);
    return Response.json({ received: true });
  } catch { return Response.json({ error: "Confirmation différée ; réessayer la notification" }, { status: 503 }); }
}
