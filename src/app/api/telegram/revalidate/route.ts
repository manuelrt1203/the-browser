import { timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";

export async function POST(request: Request) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret) return new Response(null, { status: 503 });
  const supplied = Buffer.from(request.headers.get("x-telegram-bot-api-secret-token") ?? "");
  const expected = Buffer.from(secret);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return new Response(null, { status: 401 });
  revalidateTag("catalogue", { expire: 0 });
  return Response.json({ ok: true });
}
