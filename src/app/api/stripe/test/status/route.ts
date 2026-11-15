import { stripeTestEnabled } from "@/lib/stripe-test";
import { premiumIdentity } from "@/lib/premium-session";
import { premiumRedis, validPremiumOrderId } from "@/lib/premium-redis";

export async function GET(request: Request) {
  if (!stripeTestEnabled()) return new Response(null, { status: 404 });
  const id = new URL(request.url).searchParams.get("order") ?? "";
  if (!validPremiumOrderId(id)) return Response.json({ error: "Commande invalide" }, { status: 400 });
  try {
    const identity = await premiumIdentity();
    if (!identity) return Response.json({ error: "Connexion Telegram requise" }, { status: 401 });
    const order = await premiumRedis("test").getOrder(id);
    if (!order || order.telegramUserId !== identity.telegramUserId) return Response.json({ error: "Commande introuvable" }, { status: 404 });
    return Response.json({ status: order.status, expiresAt: order.expiresAt ?? null, telegramAccessGranted: false }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch { return Response.json({ error: "Stockage de test indisponible" }, { status: 503 }); }
}
