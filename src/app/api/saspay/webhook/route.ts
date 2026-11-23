import { limitedRequestBody, requestBodyErrorResponse } from "@/lib/request-body";
import { livePaymentRuntime, findLiveSasPayOrder, refreshLivePayment } from "@/lib/premium-sales";
import { sasPayWebhookSecretConfigured, verifySasPaySignature, sasPayId } from "@/lib/saspay";
export async function POST(request: Request) {
  if (!livePaymentRuntime()) return new Response(null, { status: 404 });
  const secret = process.env.SASPAY_WEBHOOK_SECRET;
  if (!sasPayWebhookSecretConfigured(secret)) return new Response(null, { status: 503 });
  let body;
  try { body = await limitedRequestBody(request, 128_000); } catch (error) { return requestBodyErrorResponse(error); }
  if (!verifySasPaySignature(body, request.headers.get("x-webhook-signature") ?? "", request.headers.get("x-webhook-timestamp") ?? "", secret)) return new Response(null, { status: 400 });
  let event;
  try { event = JSON.parse(body.toString("utf8")); if (event.event !== request.headers.get("x-webhook-event")) throw new Error(); }
  catch { return new Response(null, { status: 400 }); }
  if (!["transaction.success", "transaction.failed", "transaction.cancelled"].includes(event.event)) return Response.json({ received: true, ignored: true });
  if (!sasPayId(event.data?.id)) return new Response(null, { status: 400 });
  try {
    const order = await findLiveSasPayOrder(event.data.id);
    if (!order) return Response.json({ received: true, ignored: true });
    await refreshLivePayment(order);
    return Response.json({ received: true });
  } catch { return new Response(null, { status: 503 }); }
}
