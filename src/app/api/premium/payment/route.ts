import { limitedJsonObject, RequestBodyError, requestBodyErrorResponse } from "@/lib/request-body";
import { premiumRateLimit } from "@/lib/premium-rate-limit";
import { premiumSalesEnabled, liveProviderEnabled, stripeLiveClient, stripeLiveAccountReady, liveCheckoutParameters, withLivePurchase, purchaseConflict, refreshLivePayment, ensureLiveSasPayCheckout } from "@/lib/premium-sales";
import { premiumIdentity } from "@/lib/premium-session";
import { isPremiumSameOrigin, premiumSiteOrigin } from "@/lib/premium-auth";
import { premiumRedis, premiumRedisCommand, validPremiumOrderId } from "@/lib/premium-redis";
import { sasPayCheckoutCustomer } from "@/lib/saspay";
import { validPremiumPlan, premiumTermsVersion } from "@/lib/subscription";
import { pricingCountry } from "@/lib/regional-pricing";
import { regionalPaymentOptions } from "@/lib/regional-payments";

export async function POST(request: Request) {
  if (!premiumSalesEnabled()) return new Response(null, { status: 404 });
  try {
    if (!isPremiumSameOrigin(request)) return Response.json({ error: "Origine refusée" }, { status: 403 });
    const identity = await premiumIdentity();
    if (!identity) return Response.json({ error: "Connectez votre compte Telegram." }, { status: 401 });
    const limited = await premiumRateLimit("payment-create", `user:${identity.telegramUserId}`);
    if (limited) return limited;
    const id = request.headers.get("idempotency-key") ?? "";
    if (!validPremiumOrderId(id)) return Response.json({ error: "Tentative invalide" }, { status: 400 });
    const input = await limitedJsonObject(request, 4096);
    const provider = input.provider;
    const countryCode = typeof input.countryCode === "string" ? input.countryCode : undefined;
    const plan = input.plan ?? "monthly";
    if (!validPremiumPlan(plan)) return Response.json({ error: "Choisissez une formule mensuelle, trimestrielle ou annuelle." }, { status: 400 });
    const termsVersion = premiumTermsVersion(process.env.COMMERCIAL_TERMS_VERSION ?? "");
    if ((provider !== "stripe" && provider !== "saspay") || (input.termsVersion !== termsVersion || input.acceptedTerms !== "on")) return Response.json({ error: "Veuillez actualiser la page et accepter les conditions en vigueur." }, { status: 400 });
    if (!liveProviderEnabled(provider)) return Response.json({ error: "Ce moyen de paiement est momentanément indisponible." }, { status: 503 });
    const last = await premiumRedisCommand(["GET", "the-browser:{premium:live}:expiration-sweep:last-success"]);
    if (typeof last !== "string" || !Number.isFinite(Date.parse(last)) || Date.now() - Date.parse(last) > 15 * 60_000 || Date.parse(last) > Date.now() + 60_000) throw new Error("Maintenance non disponible");
    const customer = provider === "saspay" ? sasPayCheckoutCustomer(input) : null;
    return await withLivePurchase(identity.telegramUserId, async lease => {
      const store = premiumRedis("live");
      let order = await store.getOrder(id);
      if (order && (order.telegramUserId !== identity.telegramUserId || order.provider !== provider || (order.plan ?? "monthly") !== plan ||
        (order.countryCode !== undefined && order.countryCode !== countryCode))) return Response.json({ error: "Annulez cette tentative avant de changer de pays, de formule ou de moyen de paiement." }, { status: 409 });
      if (purchaseConflict(await store.listOrders(identity.telegramUserId), id)) return Response.json({ error: "Un abonnement actif ou un autre paiement est déjà enregistré. Consultez Mon abonnement avant une nouvelle tentative." }, { status: 409 });
      if (order?.status === "confirmed") return Response.json({ orderId: id, status: order.status, countryCode: order.countryCode ?? null, plan: order.plan ?? "monthly", amountMinor: order.amountMinor, currency: order.currency, checkoutUrl: null }, { headers: { "Cache-Control": "no-store" } });
      if (order && order.status !== "pending") return Response.json({ error: "Cette tentative est terminée. Lancez une nouvelle commande." }, { status: 409 });
      if (!order) {
        if (!pricingCountry(countryCode)) return Response.json({error: "Choisissez votre pays de facturation parmi les pays proposés.", attemptCreated: false}, {status: 400});
        const methods = (await regionalPaymentOptions())[countryCode!]?.[plan];
        if (!methods?.[provider as "stripe" | "saspay"]) return Response.json({error: "Ce moyen de paiement n’est pas disponible pour ce pays et cette formule. Choisissez une autre option.", attemptCreated: false}, {status: 422});
      }
      const stripeClient = provider === "stripe" ? stripeLiveClient() : null;
      if (stripeClient && !await stripeLiveAccountReady(stripeClient)) throw new Error("Compte Stripe non activé");
      await lease();
      order ??= await store.createOrder(id, identity.telegramUserId, provider, plan, countryCode);
      await premiumRedisCommand(["SET", `the-browser:{premium:live}:terms:${id}`, JSON.stringify({ version: termsVersion, plan, countryCode: order.countryCode, zone: order.zone, amountMinor: order.amountMinor, currency: order.currency, priceVersion: order.priceVersion ?? "legacy", acceptedAt: new Date().toISOString() }), "NX"]);
      let checkoutUrl: string | null = null;
      if (provider === "stripe") {
        const client = stripeClient!;
        await lease();
        const session = order.providerSessionId ? await client.checkout.sessions.retrieve(order.providerSessionId) : await client.checkout.sessions.create(liveCheckoutParameters(id, premiumSiteOrigin(), order), { idempotencyKey: `the-browser-live-${id}` });
        if (!session.livemode || !session.id.startsWith("cs_live_") || session.client_reference_id !== id || session.amount_total !== order.amountMinor || session.currency !== order.currency.toLowerCase()) throw new Error("Session incompatible");
        if (session.url) { const u = new URL(session.url); if (u.protocol !== "https:" || u.hostname !== "checkout.stripe.com" || u.username || u.password || u.port) throw new Error("Checkout invalide"); checkoutUrl = u.toString(); }
        await lease(); await store.bindSession(id, session.id);
      } else {
        await lease(); order = await ensureLiveSasPayCheckout(order, customer!, premiumSiteOrigin()); await lease();
        checkoutUrl = order.providerCheckoutUrl ?? null;
      }
      // Payment completion is always re-read from the provider, never the browser.
      order = await refreshLivePayment((await store.getOrder(id))!);
      return Response.json({ orderId: id, status: order.status, countryCode: order.countryCode ?? null, plan: order.plan ?? "monthly", amountMinor: order.amountMinor, currency: order.currency, checkoutUrl }, { headers: { "Cache-Control": "no-store" } });
    });
  } catch (error) { if (error instanceof RequestBodyError) return requestBodyErrorResponse(error); return Response.json({ error: "Paiement indisponible. Conservez votre tentative et vérifiez Mon abonnement avant de réessayer." }, { status: 503 }); }
}
