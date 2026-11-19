import { premiumSalesEnabled, liveProviderEnabled, stripeLiveClient, stripeLiveAccountReady, liveCheckoutParameters, withLivePurchase, purchaseConflict, refreshLivePayment, ensureLiveSasPayCheckout } from "@/lib/premium-sales";
import { premiumIdentity } from "@/lib/premium-session";
import { isPremiumSameOrigin, premiumSiteOrigin } from "@/lib/premium-auth";
import { premiumRedis, premiumRedisCommand, validPremiumOrderId } from "@/lib/premium-redis";
import { sasPayCheckoutCustomer } from "@/lib/saspay";

export async function POST(request: Request) {
  if (!premiumSalesEnabled()) return new Response(null, { status: 404 });
  try {
    if (!isPremiumSameOrigin(request)) return Response.json({ error: "Origine refusée" }, { status: 403 });
    const identity = await premiumIdentity();
    if (!identity) return Response.json({ error: "Connectez votre compte Telegram." }, { status: 401 });
    const id = request.headers.get("idempotency-key") ?? "";
    if (!validPremiumOrderId(id)) return Response.json({ error: "Tentative invalide" }, { status: 400 });
    const raw = await request.text();
    if (Buffer.byteLength(raw) > 4096) return new Response(null, { status: 413 });
    const input = JSON.parse(raw);
    const provider = input.provider;
    if (!["stripe", "saspay"].includes(provider) || (input.termsVersion !== process.env.COMMERCIAL_TERMS_VERSION || input.acceptedTerms !== "on")) return Response.json({ error: "Veuillez accepter les conditions en vigueur." }, { status: 400 });
    if (!liveProviderEnabled(provider)) return Response.json({ error: "Ce moyen de paiement est momentanément indisponible." }, { status: 503 });
    const last = await premiumRedisCommand(["GET", "the-browser:{premium:live}:expiration-sweep:last-success"]);
    if (typeof last !== "string" || !Number.isFinite(Date.parse(last)) || Date.now() - Date.parse(last) > 15 * 60_000 || Date.parse(last) > Date.now() + 60_000) throw new Error("Maintenance non disponible");
    const customer = provider === "saspay" ? sasPayCheckoutCustomer(input) : null;
    return await withLivePurchase(identity.telegramUserId, async lease => {
      const store = premiumRedis("live");
      let order = await store.getOrder(id);
      if (order && (order.telegramUserId !== identity.telegramUserId || order.provider !== provider)) return Response.json({ error: "Tentative incompatible" }, { status: 409 });
      if (purchaseConflict(await store.listOrders(identity.telegramUserId), id)) return Response.json({ error: "Un abonnement actif ou un autre paiement est déjà enregistré. Consultez Mon abonnement avant une nouvelle tentative." }, { status: 409 });
      if (order?.status === "confirmed") return Response.json({ orderId: id, status: order.status, checkoutUrl: null }, { headers: { "Cache-Control": "no-store" } });
      if (order && order.status !== "pending") return Response.json({ error: "Cette tentative est terminée. Lancez une nouvelle commande." }, { status: 409 });
      const stripeClient = provider === "stripe" ? stripeLiveClient() : null;
      if (stripeClient && !await stripeLiveAccountReady(stripeClient)) throw new Error("Compte Stripe non activé");
      await lease();
      order ??= await store.createOrder(id, identity.telegramUserId, provider);
      await premiumRedisCommand(["SET", `the-browser:{premium:live}:terms:${id}`, JSON.stringify({ version: process.env.COMMERCIAL_TERMS_VERSION, acceptedAt: new Date().toISOString() }), "NX"]);
      let checkoutUrl: string | null = null;
      if (provider === "stripe") {
        const client = stripeClient!;
        await lease();
        const session = order.providerSessionId ? await client.checkout.sessions.retrieve(order.providerSessionId) : await client.checkout.sessions.create(liveCheckoutParameters(id, premiumSiteOrigin()), { idempotencyKey: `the-browser-live-${id}` });
        if (!session.livemode || !session.id.startsWith("cs_live_") || session.client_reference_id !== id || session.amount_total !== 457 || session.currency !== "eur") throw new Error("Session incompatible");
        if (session.url) { const u = new URL(session.url); if (u.protocol !== "https:" || u.hostname !== "checkout.stripe.com" || u.username || u.password || u.port) throw new Error("Checkout invalide"); checkoutUrl = u.toString(); }
        await lease(); await store.bindSession(id, session.id);
      } else {
        await lease(); order = await ensureLiveSasPayCheckout(order, customer!, premiumSiteOrigin()); await lease();
        checkoutUrl = order.providerCheckoutUrl ?? null;
      }
      // Payment completion is always re-read from the provider, never the browser.
      order = await refreshLivePayment((await store.getOrder(id))!);
      return Response.json({ orderId: id, status: order.status, checkoutUrl }, { headers: { "Cache-Control": "no-store" } });
    });
  } catch { return Response.json({ error: "Paiement indisponible. Conservez votre tentative et vérifiez Mon abonnement avant de réessayer." }, { status: 503 }); }
}
