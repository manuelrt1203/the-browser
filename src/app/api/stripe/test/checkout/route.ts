import { stripeTestClient, stripeTestEnabled, testCheckoutParameters } from "@/lib/stripe-test";
import { premiumIdentity } from "@/lib/premium-session";
import { premiumRedis, validPremiumOrderId } from "@/lib/premium-redis";
import { PREMIUM_OFFERS } from "@/lib/subscription";
import { isPremiumSameOrigin } from "@/lib/premium-auth";

export async function POST(request: Request) {
  if (!stripeTestEnabled()) return new Response(null, { status: 404 });
  const origin = request.headers.get("origin");
  try {
    if (!origin || !isPremiumSameOrigin(request)) return Response.json({ error: "Origine refusée" }, { status: 403 });
  } catch { return Response.json({ error: "Origine de test non configurée" }, { status: 503 }); }
  const id = request.headers.get("idempotency-key") ?? "";
  if (!validPremiumOrderId(id)) return Response.json({ error: "Identifiant de tentative invalide" }, { status: 400 });
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    return Response.json({ error: "Configurez la confirmation Stripe de test avant le paiement." }, { status: 503 });
  }
  try {
    const identity = await premiumIdentity();
    if (!identity) return Response.json({ error: "Connectez votre compte Telegram avant le paiement." }, { status: 401 });
    const client = stripeTestClient();
    // Check actual server mode, including keys injected through the HTTPS proxy.
    if ((await client.balance.retrieve()).livemode) throw new Error("Mode test requis");
    const store = premiumRedis("test");
    const order = await store.createOrder(id, identity.telegramUserId, "stripe");
    const session = order.providerSessionId ? await client.checkout.sessions.retrieve(order.providerSessionId) :
      await client.checkout.sessions.create(testCheckoutParameters(id, origin), {
        idempotencyKey: `the-browser-test-${id}`,
      });
    if (session.livemode || !session.url || !session.id.startsWith("cs_test_") || session.client_reference_id !== id ||
        session.amount_total !== PREMIUM_OFFERS.stripe.amountMinor || session.currency !== "eur") throw new Error("Session de test requise");
    await store.bindSession(id, session.id);
    return Response.json({ orderId: order.id, checkoutUrl: session.url }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Paiement de test indisponible. Vérifiez la configuration serveur." }, { status: 503 });
  }
}
