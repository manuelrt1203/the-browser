import { premiumChannelAccessEnabled, withChannelAccess } from "@/lib/premium-channel-access";
import { premiumIdentity } from "@/lib/premium-session";
import { isPremiumSameOrigin } from "@/lib/premium-auth";

export async function POST(request: Request) {
  if (!premiumChannelAccessEnabled()) return new Response(null, { status: 404 });
  try {
    if (!isPremiumSameOrigin(request)) return new Response(null, { status: 403 });
    const identity = await premiumIdentity();
    if (!identity) return new Response(null, { status: 401 });
    const result = await withChannelAccess(identity.telegramUserId, service => service.invite(identity.telegramUserId));
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch { return Response.json({ error: "Accès indisponible. Vérifiez votre abonnement ou réessayez plus tard." }, { status: 503 }); }
}
