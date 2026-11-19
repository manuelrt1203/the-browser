import { premiumIdentity } from "@/lib/premium-session";
import { isPremiumSameOrigin } from "@/lib/premium-auth";
import { premiumRedis, validPremiumOrderId } from "@/lib/premium-redis";
import { saspayTestClient, saspayTestEnabled, sasPayCustomer, SasPayError, sasPayWebhookSecretConfigured } from "@/lib/saspay";
import { refreshSasPayTestOrder } from "@/lib/saspay-orders";

export async function POST(request: Request) {
  if (!saspayTestEnabled()) return new Response(null, { status: 404 });
  try {
    if (!isPremiumSameOrigin(request)) return Response.json({ error: "Origine refusée" }, { status: 403 });
    const identity = await premiumIdentity();
    if (!identity) return Response.json({ error: "Connexion Telegram requise" }, { status: 401 });
    const id = request.headers.get("idempotency-key") ?? "";
    if (!validPremiumOrderId(id)) return Response.json({ error: "Tentative invalide" }, { status: 400 });
    if (!sasPayWebhookSecretConfigured(process.env.SASPAY_WEBHOOK_SECRET_TEST)) {
      return Response.json({ error: "Configurer la valeur réelle du secret webhook SasPay dans Vercel Preview avant le paiement." }, { status: 503 });
    }
    let input;
    try { const text = await request.text(); if (Buffer.byteLength(text) > 4096) throw new Error(); input = sasPayCustomer(JSON.parse(text)); }
    catch { return Response.json({ error: "Vérifiez votre nom, email, réseau et numéro +242." }, { status: 400 }); }
    const client = saspayTestClient();
    const store = premiumRedis("test");
    let order = await store.createOrder(id, identity.telegramUserId, "saspay");
    let checkoutUrl = order.providerCheckoutUrl ?? null;
    if (!order.providerSessionId) {
      const payment = await client.initiate(id, input);
      order = await store.bindSession(id, payment.id, payment.checkoutUrl ?? undefined);
      checkoutUrl = payment.checkoutUrl;
    }
    // Covers a successful notification racing the session binding. No access is
    // granted from the initiation response or a browser redirect.
    order = await refreshSasPayTestOrder(order);
    return Response.json({ orderId: id, status: order.status, checkoutUrl, telegramAccessGranted: false }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof SasPayError && ["CUSTOMER", "NETWORK_UNAVAILABLE"].includes(error.code)) {
      return Response.json({ error: "Réseau indisponible ou coordonnées invalides." }, { status: 400 });
    }
    return Response.json({ error: "Paiement de test indisponible. Réessayez la même tentative." }, { status: 503 });
  }
}
