import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { isPremiumSameOrigin, premiumAuthEnabled, premiumAuthStore, premiumCookieName, premiumEnvironment,
  premiumSiteOrigin } from "@/lib/premium-auth";

export async function POST(request: Request) {
  if (!premiumAuthEnabled()) return new Response(null, { status: 404 });
  try {
    if (!isPremiumSameOrigin(request)) return NextResponse.json({ error: "Origine refusée" }, { status: 403 });
    const name = premiumCookieName();
    const token = (await cookies()).get(name)?.value ?? "";
    await premiumAuthStore(premiumEnvironment()).logout(token);
    const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
    response.cookies.set(name, "", { httpOnly: true, sameSite: "lax", path: "/", secure: new URL(premiumSiteOrigin()).protocol === "https:", maxAge: 0 });
    return response;
  } catch { return NextResponse.json({ error: "Déconnexion indisponible" }, { status: 503 }); }
}
