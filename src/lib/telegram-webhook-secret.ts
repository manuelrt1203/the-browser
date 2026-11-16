import { timingSafeEqual } from "node:crypto";

export function hasTelegramWebhookSecret(env = process.env) {
  return Boolean(env.TELEGRAM_WEBHOOK_SECRET || env.TELEGRAM_WEBHOOK_SECRET_NEXT);
}

/** NEXT is a temporary rotation slot; keeping the current value accepts queued deliveries. */
export function validTelegramWebhookSecret(supplied: string, env = process.env) {
  const received = Buffer.from(supplied);
  let accepted = 0;
  for (const secret of [env.TELEGRAM_WEBHOOK_SECRET, env.TELEGRAM_WEBHOOK_SECRET_NEXT]) {
    if (!secret) continue;
    const expected = Buffer.from(secret);
    if (received.length === expected.length) accepted |= Number(timingSafeEqual(received, expected));
  }
  return accepted === 1;
}
