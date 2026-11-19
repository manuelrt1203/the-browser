import { premiumMaintenanceAuthorized } from "@/lib/premium-maintenance-auth";
import { livePaymentRuntime, liveProviderReady, premiumSalesEnabled, stripeLiveAccountReady } from "@/lib/premium-sales";
import { saspayLiveClient } from "@/lib/saspay";
import { premiumRedisCommand } from "@/lib/premium-redis";
export async function GET(request: Request) {
  if (!livePaymentRuntime()) return new Response(null, { status: 404 });
  if (!await premiumMaintenanceAuthorized(request.headers.get("authorization") ?? "")) return new Response(null, { status: 401 });
  const stripeConfigured = liveProviderReady("stripe"), saspayConfigured = liveProviderReady("saspay");
  let stripeVerified = false, saspayVerified = false;
  try { if (stripeConfigured) stripeVerified = await stripeLiveAccountReady(); } catch {}
  try { if (saspayConfigured) saspayVerified = await saspayLiveClient().merchantCheck(); } catch {}
  const last = await premiumRedisCommand(["GET", "the-browser:{premium:live}:expiration-sweep:last-success"]);
  const schedulerFresh = typeof last === "string" && Number.isFinite(Date.parse(last)) && Date.now() - Date.parse(last) < 15 * 60_000 && Date.parse(last) <= Date.now() + 60_000;
  return Response.json({ salesEnabled: premiumSalesEnabled(), stripeConfigured, stripeVerified, saspayConfigured, saspayVerified, schedulerFresh }, { headers: { "Cache-Control": "private, no-store" } });
}
