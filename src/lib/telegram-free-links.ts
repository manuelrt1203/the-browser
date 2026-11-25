export const FREE_BOT = "Thebrowser365_bot";
export const validFreeToken = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9_-]{24}$/.test(value);
export const freeAssetUrl = (token: string) => validFreeToken(token) ? `https://t.me/${FREE_BOT}?start=free_${token}` : null;
export const freePostUrl = (messageId: number) => Number.isSafeInteger(messageId) && messageId > 0 ? `https://t.me/${FREE_BOT}?start=free_post_${messageId}` : null;
export function telegramFreeEnabled(env = process.env) {
  return env.VERCEL === "1" && env.VERCEL_ENV === "production" && env.TELEGRAM_FREE_GATE_ENABLED === "1" && /^-100[1-9]\d*$/.test(env.TELEGRAM_CHANNEL_ID ?? "");
}
