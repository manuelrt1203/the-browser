import {premiumMaintenanceAuthorized} from "@/lib/premium-maintenance-auth";
import {telegramFreeReadiness} from "@/lib/telegram-free";
export async function GET(request: Request) {
  const headers = {"Cache-Control": "private, no-store"};
  if (!await premiumMaintenanceAuthorized(request.headers.get("authorization") ?? "")) return new Response(null, {status: 401, headers});
  try { return Response.json(await telegramFreeReadiness(), {headers}); }
  catch { return Response.json({ready: false, error: "Vérification Telegram indisponible"}, {status: 503, headers}); }
}
