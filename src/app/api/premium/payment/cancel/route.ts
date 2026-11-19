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
    const raw = await request.text();
    if (Buffer.byteLength(raw) > 1024) return new Response(null, { status: 413 });
    const { orderId } = JSON.parse(raw);
    if (typeof orderId !== "string" || !validPremiumOrderId(orderId)) return new Response(null, { status: 400 });
    return await withLivePurchase(identity.telegramUserId, async lease => {
      const order = await premiumRedis("live").getOrder(orderId);
      if (order && order.telegramUserId !== identity.telegramUserId) return new Response(null, { status: 404 });
      if (order) await cancelLivePayment(order, lease);
      return Response.json({ cancelled: true }, { headers });
    });
  } catch (error) {
    return Response.json({ error: error instanceof PaymentChangeBlocked ? error.message : "Impossible de confirmer l’annulation. Conservez cette commande et réessayez avant un nouveau paiement." }, { status: error instanceof PaymentChangeBlocked ? 409 : 503, headers });
  }
}
