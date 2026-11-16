import { premiumAuthEnabled, premiumEnvironment } from "@/lib/premium-auth";
import { premiumIdentity } from "@/lib/premium-session";
import { premiumRedis } from "@/lib/premium-redis";
import { subscriptionAccount } from "@/lib/subscription-account";
import { premiumChannelAccessEnabled } from "@/lib/premium-channel-access";

export async function GET() {
  const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };
  if (!premiumAuthEnabled()) return new Response(null, { status: 404, headers });
  try {
    const identity = await premiumIdentity();
    if (!identity) return Response.json({ error: "Connexion Telegram requise" }, { status: 401, headers });
    const environment = premiumEnvironment();
    const account = subscriptionAccount(await premiumRedis(environment).listOrders(identity.telegramUserId), environment, identity.telegramUserId);
    return Response.json({ ...account, channelAccessAvailable: account.status === "active" && premiumChannelAccessEnabled() }, { headers });
  } catch { return Response.json({ error: "Abonnement momentanément indisponible" }, { status: 503, headers }); }
}
