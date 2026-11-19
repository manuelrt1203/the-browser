import { premiumMaintenanceAuthorized } from "@/lib/premium-maintenance-auth";
import { telegramCopyEnabled, telegramCopyService } from "@/lib/telegram-copy";
import { premiumRedisCommand } from "@/lib/premium-redis";
export const maxDuration = 300;
export async function GET(request: Request) {
  const headers = { "Cache-Control": "private, no-store" };
  if (!telegramCopyEnabled()) return new Response(null, { status: 404 });
  if (!await premiumMaintenanceAuthorized(request.headers.get("authorization") ?? "")) return new Response(null, { status: 401 });
  return Response.json({ enabled: true, pendingJobs: await premiumRedisCommand(["LLEN", "the-browser:{telegram-copy-jobs}:queue"]) }, { headers });
}
export async function POST(request: Request) {
  const headers = { "Cache-Control": "private, no-store" };
  if (!telegramCopyEnabled()) return new Response(null, { status: 404 });
  if (!await premiumMaintenanceAuthorized(request.headers.get("authorization") ?? "")) return new Response(null, { status: 401 });
  try { return Response.json(await telegramCopyService().worker(), { headers }); }
  catch { return Response.json({ error: "Copie à reprendre" }, { status: 503, headers }); }
}
