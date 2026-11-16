import { revalidateTag } from "next/cache";
import { hasTelegramWebhookSecret, validTelegramWebhookSecret } from "@/lib/telegram-webhook-secret";

export async function POST(request: Request) {
  if (!hasTelegramWebhookSecret()) return new Response(null, { status: 503 });
  if (!validTelegramWebhookSecret(request.headers.get("x-telegram-bot-api-secret-token") ?? "")) return new Response(null, { status: 401 });
  revalidateTag("catalogue", { expire: 0 });
  return Response.json({ ok: true });
}
