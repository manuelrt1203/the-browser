import { premiumSalesEnabled, liveProviderEnabled } from "@/lib/premium-sales";
import { premiumIdentity } from "@/lib/premium-session";
import { saspayLiveClient } from "@/lib/saspay";
export async function GET() {
  if (!premiumSalesEnabled() || !liveProviderEnabled("saspay")) return new Response(null, { status: 404 });
  try {
    if (!await premiumIdentity()) return new Response(null, { status: 401 });
    return Response.json({ networks: await saspayLiveClient().networks() }, { headers: { "Cache-Control": "private, no-store" } });
  } catch { return new Response(null, { status: 503 }); }
}
