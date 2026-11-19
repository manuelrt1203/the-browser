import { premiumMaintenanceAuthorized } from "@/lib/premium-maintenance-auth";
import { livePaymentRuntime, liveProviderReady, premiumSalesEnabled, stripeLiveAccountState, stripeLiveClient, stripeLiveWebhookConfigured } from "@/lib/premium-sales";
import { saspayLiveClient } from "@/lib/saspay";
import { premiumRedisCommand } from "@/lib/premium-redis";
export async function GET(request: Request) {
  if (!livePaymentRuntime()) return new Response(null, { status: 404 });
  if (!await premiumMaintenanceAuthorized(request.headers.get("authorization") ?? "")) return new Response(null, { status: 401 });
  const stripeConfigured = liveProviderReady("stripe"), saspayConfigured = liveProviderReady("saspay");
  let stripeWebhookConfigured = false, stripeVerified = false, saspayVerified = false, saspayWebhookConfigured = false;
  let stripeAccount = null, stripeError = null;
  try {
    if (stripeConfigured) { const client = stripeLiveClient(); stripeAccount = await stripeLiveAccountState(client); stripeWebhookConfigured = await stripeLiveWebhookConfigured(client, `${process.env.SITE_URL?.replace(/\/$/, "")}/api/stripe/webhook`); stripeVerified = stripeAccount.liveMode && stripeAccount.chargesEnabled && stripeAccount.payoutsEnabled && stripeWebhookConfigured; }
  } catch (error) {
    const failure = error as { statusCode?: number; code?: string };
    stripeError = { status: failure.statusCode ?? null, code: typeof failure.code === "string" && /^[a-z_]{1,64}$/.test(failure.code) ? failure.code : "request_failed" };
  }
  try { if (saspayConfigured) { const client = saspayLiveClient(); saspayWebhookConfigured = await client.webhookConfigured(`${process.env.SITE_URL?.replace(/\/$/, "")}/api/saspay/webhook`); saspayVerified = await client.merchantCheck() && saspayWebhookConfigured; } } catch {}
  const last = await premiumRedisCommand(["GET", "the-browser:{premium:live}:expiration-sweep:last-success"]);
  const schedulerFresh = typeof last === "string" && Number.isFinite(Date.parse(last)) && Date.now() - Date.parse(last) < 15 * 60_000 && Date.parse(last) <= Date.now() + 60_000;
  return Response.json({ salesEnabled: premiumSalesEnabled(), stripeConfigured, stripeVerified, stripeWebhookConfigured, stripeAccount, stripeError, saspayConfigured, saspayVerified, saspayWebhookConfigured, schedulerFresh }, { headers: { "Cache-Control": "private, no-store" } });
}
