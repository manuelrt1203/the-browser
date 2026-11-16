import { premiumIdentity } from "@/lib/premium-session";
import { premiumRedis, validPremiumOrderId } from "@/lib/premium-redis";
import { saspayTestEnabled } from "@/lib/saspay";
import { refreshSasPayTestOrder } from "@/lib/saspay-orders";

export async function GET(request: Request) {
  if (!saspayTestEnabled()) return new Response(null, { status: 404 });
  try {
    const identity = await premiumIdentity();
    if (!identity) return Response.json({ error: "Connexion Telegram requise" }, { status: 401 });
    const id = new URL(request.url).searchParams.get("order") ?? "";
    if (!validPremiumOrderId(id)) return Response.json({ error: "Commande invalide" }, { status: 400 });
    const order = await premiumRedis("test").getOrder(id);
    if (!order || order.telegramUserId !== identity.telegramUserId || order.provider !== "saspay") {
      return Response.json({ error: "Commande introuvable" }, { status: 404 });
    }
    const current = order.providerSessionId ? await refreshSasPayTestOrder(order) : order;
    return Response.json({ status: current.status, expiresAt: current.expiresAt ?? null, telegramAccessGranted: false }, { headers: { "Cache-Control": "no-store" } });
  } catch { return Response.json({ error: "Vérification SasPay indisponible" }, { status: 503 }); }
}
