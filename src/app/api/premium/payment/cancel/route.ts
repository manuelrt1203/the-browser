import { limitedJsonObject, RequestBodyError, requestBodyErrorResponse } from "@/lib/request-body";
import { premiumRateLimit } from "@/lib/premium-rate-limit";
import { livePaymentRuntime, withLivePurchase } from "@/lib/premium-sales";
import { premiumIdentity } from "@/lib/premium-session";
import { isPremiumSameOrigin } from "@/lib/premium-auth";
import { premiumRedis, validPremiumOrderId } from "@/lib/premium-redis";
import { cancelLivePayment, PaymentChangeBlocked } from "@/lib/premium-payment-cancel";

export async function POST(request: Request) {
  const headers = { "Cache-Control": "private, no-store" };
  if (!livePaymentRuntime()) return new Response(null, { status: 404 });
  try {
    if (!isPremiumSameOrigin(request)) return new Response(null, { status: 403 });
    const identity = await premiumIdentity();
    if (!identity) return new Response(null, { status: 401 });
    const limited = await premiumRateLimit("payment-cancel", `user:${identity.telegramUserId}`);
    if (limited) return limited;
    const { orderId } = await limitedJsonObject(request, 1024);
    if (typeof orderId !== "string" || !validPremiumOrderId(orderId)) return new Response(null, { status: 400 });
    return await withLivePurchase(identity.telegramUserId, async lease => {
      const order = await premiumRedis("live").getOrder(orderId);
      if (order && order.telegramUserId !== identity.telegramUserId) return new Response(null, { status: 404 });
      if (order) await cancelLivePayment(order, lease);
      return Response.json({ cancelled: true }, { headers });
    });
  } catch (error) {
    if (error instanceof RequestBodyError) return requestBodyErrorResponse(error);
    return Response.json({ error: error instanceof PaymentChangeBlocked ? error.message : "Impossible de confirmer l’annulation. Conservez cette commande et réessayez avant un nouveau paiement." }, { status: error instanceof PaymentChangeBlocked ? 409 : 503, headers });
  }
}
