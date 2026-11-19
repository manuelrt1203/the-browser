import { premiumMaintenanceAuthorized } from "@/lib/premium-maintenance-auth";
import { livePaymentRuntime, liveProviderReady, premiumSalesEnabled, stripeLiveAccountState, stripeLiveClient, stripeLiveWebhookConfigured, ensureLiveSasPayCheckout, refreshLivePayment } from "@/lib/premium-sales";
import { saspayLiveClient, verifiedSasPayCheckout } from "@/lib/saspay";
import { premiumRedisCommand, premiumRedis, validPremiumOrderId } from "@/lib/premium-redis";
export async function GET(request: Request) {
  if (!livePaymentRuntime()) return new Response(null, { status: 404 });
  if (!await premiumMaintenanceAuthorized(request.headers.get("authorization") ?? "")) return new Response(null, { status: 401 });
  const orderId = new URL(request.url).searchParams.get("order");
  if (orderId) {
    if (!validPremiumOrderId(orderId)) return new Response(null, { status: 400 });
    const order = await premiumRedis("live").getOrder(orderId);
    if (!order || order.provider !== "saspay") return new Response(null, { status: 404 });
    try {
      const client = saspayLiveClient();
      const session = order.providerSessionId ? await client.checkout(order.providerSessionId) : await client.findCheckout(order.id);
      let validation = null;
      if (session) { try { verifiedSasPayCheckout(order, session); } catch (error) { validation = (error as { code?: string }).code ?? "invalid_response"; } }
      return Response.json({ found: !!session, bound: !!order.providerSessionId, validation,
        ...(session ? { amount: session.amount, currency: session.currency, status: session.status,
          checkoutHost: (() => { try { return new URL(session.checkout_url).hostname; } catch { return null; } })(),
          metadataMatches: session.metadata?.order_id === order.id && session.metadata?.environment === "live",
        } : {}) }, { headers: { "Cache-Control": "private, no-store" } });
    } catch (error) { return Response.json({ error: (error as { code?: string }).code ?? "request_failed" }, { status: 503, headers: { "Cache-Control": "private, no-store" } }); }
  }
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

/** Maintenance-only reconciliation: looks up an EXISTING merchant session.
 * No customer input is supplied, so this can never create a checkout or debit. */
export async function POST(request: Request) {
  if (!livePaymentRuntime()) return new Response(null, { status: 404 });
  if (!await premiumMaintenanceAuthorized(request.headers.get("authorization") ?? "")) return new Response(null, { status: 401 });
  const id = new URL(request.url).searchParams.get("order") ?? "";
  if (!validPremiumOrderId(id)) return new Response(null, { status: 400 });
  try {
    const order = await premiumRedis("live").getOrder(id);
    if (!order || order.provider !== "saspay" || order.status !== "pending") return new Response(null, { status: 409 });
    const updated = await refreshLivePayment(await ensureLiveSasPayCheckout(order));
    return Response.json({ recovered: !!updated.providerSessionId, status: updated.status }, { headers: { "Cache-Control": "private, no-store" } });
  } catch { return Response.json({ error: "reconciliation_failed" }, { status: 503, headers: { "Cache-Control": "private, no-store" } }); }
}
