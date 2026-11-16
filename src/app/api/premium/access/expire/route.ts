import { premiumMaintenanceAuthorized } from "@/lib/premium-maintenance-auth";
import { expireChannelAccessBatch, premiumChannelAccessEnabled } from "@/lib/premium-channel-access";

export async function POST(request: Request) {
  if (!premiumChannelAccessEnabled()) return new Response(null, { status: 404 });
  if (!await premiumMaintenanceAuthorized(request.headers.get("authorization") ?? "")) return new Response(null, { status: 401 });
  try {
    const cursor = new URL(request.url).searchParams.get("cursor") ?? "0";
    return Response.json(await expireChannelAccessBatch(cursor), { headers: { "Cache-Control": "no-store" } });
  } catch { return Response.json({ error: "Traitement différé" }, { status: 503 }); }
}
