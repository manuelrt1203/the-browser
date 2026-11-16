import { premiumIdentity } from "@/lib/premium-session";
import { saspayTestClient, saspayTestEnabled } from "@/lib/saspay";

export async function GET() {
  if (!saspayTestEnabled()) return new Response(null, { status: 404 });
  try {
    if (!(await premiumIdentity())) return Response.json({ error: "Connexion Telegram requise" }, { status: 401 });
    return Response.json({ networks: await saspayTestClient().networks() }, { headers: { "Cache-Control": "no-store" } });
  } catch { return Response.json({ error: "SasPay de test indisponible. Vérifiez la configuration serveur." }, { status: 503 }); }
}
