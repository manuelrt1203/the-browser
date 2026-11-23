import { premiumRateLimit, requestRateSubject } from "@/lib/premium-rate-limit";
import { cookies } from "next/headers";
import { premiumAuthEnabled, premiumAuthStore, premiumCookieName, premiumEnvironment, premiumSessionRevision } from "@/lib/premium-auth";

export async function GET(request: Request) {
  if (!premiumAuthEnabled()) return new Response(null, { status: 404 });
  try {
    const limited = await premiumRateLimit("auth-session", requestRateSubject(request));
    if (limited) return limited;
    const token = (await cookies()).get(premiumCookieName())?.value ?? "";
    const result = await premiumAuthStore(premiumEnvironment()).status(token);
    return Response.json({status: result.status, ...(result.status === "connected" ? {sessionRevision: premiumSessionRevision(token)} : {})}, { headers: { "Cache-Control": "no-store" } });
  } catch { return Response.json({ error: "Connexion indisponible" }, { status: 503 }); }
}
