import { premiumRateLimit } from "@/lib/premium-rate-limit";
import { livePaymentRuntime, refreshLivePayment, stripeLiveClient } from "@/lib/premium-sales";
import { premiumIdentity } from "@/lib/premium-session";
import { premiumRedis, validPremiumOrderId } from "@/lib/premium-redis";
export async function GET(request: Request) {
  if (!livePaymentRuntime()) return new Response(null, { status: 404 });
  try {
    const identity = await premiumIdentity();
    if (!identity) return new Response(null, { status: 401 });
    const limited = await premiumRateLimit("payment-status", `user:${identity.telegramUserId}`);
    if (limited) return limited;
    const id = new URL(request.url).searchParams.get("order") ?? "";
    if (!validPremiumOrderId(id)) return new Response(null, { status: 400 });
    const order = await premiumRedis("live").getOrder(id);
    if (!order || order.telegramUserId !== identity.telegramUserId) return new Response(null, { status: 404 });
    const updated = order.status !== "confirmed" && order.providerSessionId ? await refreshLivePayment(order) : order;
    let checkoutUrl = updated.providerCheckoutUrl ?? null;
    if (updated.status === "pending" && updated.provider === "stripe" && updated.providerSessionId) {
      const session = await stripeLiveClient().checkout.sessions.retrieve(updated.providerSessionId);
      if (session.url) { const u = new URL(session.url); if (u.protocol !== "https:" || u.hostname !== "checkout.stripe.com" || u.username || u.password || u.port) throw new Error(); checkoutUrl = u.toString(); }
    }
    return Response.json({ orderId: id, provider: updated.provider, countryCode: updated.countryCode ?? null, zone: updated.zone ?? null, plan: updated.plan ?? "monthly", amountMinor: updated.amountMinor, currency: updated.currency, needsRetry: updated.status === "pending" && !updated.providerSessionId, status: updated.status, expiresAt: updated.expiresAt ?? null, checkoutUrl: updated.status === "pending" ? checkoutUrl : null }, { headers: { "Cache-Control": "private, no-store" } });
  } catch { return Response.json({ error: "Confirmation momentanément indisponible" }, { status: 503 }); }
}
