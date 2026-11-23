import { premiumRateLimit, requestRateSubject } from "@/lib/premium-rate-limit";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { isPremiumSameOrigin, premiumAuthEnabled, premiumAuthStore, premiumCookieName, premiumEnvironment,
  premiumSiteOrigin, PREMIUM_SESSION_TTL } from "@/lib/premium-auth";

export async function POST(request: Request) {
  if (!premiumAuthEnabled()) return new Response(null, { status: 404 });
  try {
    if (!isPremiumSameOrigin(request)) return NextResponse.json({ error: "Origine refusée" }, { status: 403 });
    const limited = await premiumRateLimit("auth-start", requestRateSubject(request));
    if (limited) return limited;
    const auth = premiumAuthStore(premiumEnvironment());
    const previous = (await cookies()).get(premiumCookieName())?.value;
    if (previous) await auth.logout(previous);
    const challenge = await auth.start();
    const response = NextResponse.json({ telegramUrl: challenge.url }, { headers: { "Cache-Control": "no-store" } });
    response.cookies.set(premiumCookieName(), challenge.token, { httpOnly: true, sameSite: "lax", path: "/",
      secure: new URL(premiumSiteOrigin()).protocol === "https:", maxAge: PREMIUM_SESSION_TTL });
    return response;
  } catch { return NextResponse.json({ error: "Connexion Telegram indisponible. Réessayez plus tard." }, { status: 503 }); }
}
