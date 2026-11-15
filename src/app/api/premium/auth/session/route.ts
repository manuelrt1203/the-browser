import { cookies } from "next/headers";
import { premiumAuthEnabled, premiumAuthStore, premiumCookieName, premiumEnvironment } from "@/lib/premium-auth";

export async function GET() {
  if (!premiumAuthEnabled()) return new Response(null, { status: 404 });
  try {
    const token = (await cookies()).get(premiumCookieName())?.value ?? "";
    const result = await premiumAuthStore(premiumEnvironment()).status(token);
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch { return Response.json({ error: "Connexion indisponible" }, { status: 503 }); }
}
