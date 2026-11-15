import { createHash, randomBytes } from "node:crypto";
import { premiumRedisCommand, PremiumStorageError } from "./premium-redis.ts";

const CHALLENGE_TTL = 600;
export const PREMIUM_SESSION_TTL = 86400;
export type PremiumIdentity = { telegramUserId: string };
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const validToken = (value: string) => /^[A-Za-z0-9_-]{43}$/.test(value);
const validCode = (value: string) => /^[A-Za-z0-9_-]{32}$/.test(value);
const validUser = (value: string) => /^[1-9]\d{0,15}$/.test(value) && Number.isSafeInteger(Number(value));

export function premiumEnvironment(): "test" | "live" {
  const value = process.env.PREMIUM_ENVIRONMENT ?? "test";
  if (value !== "test" && value !== "live") throw new PremiumStorageError("ENVIRONMENT");
  return value;
}
export function premiumAuthEnabled() { return process.env.PREMIUM_TELEGRAM_AUTH_ENABLED === "1"; }
export function premiumCookieName() { return `tb_premium_${premiumEnvironment()}_session`; }
export function premiumSiteOrigin() {
  const origin = new URL(process.env.SITE_URL ?? "");
  if (origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash ||
      (origin.protocol !== "https:" && !(process.env.NODE_ENV === "development" && origin.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(origin.hostname)))) throw new Error("SITE_URL invalide");
  return origin.origin;
}
export function isPremiumSameOrigin(request: Request) {
  return request.headers.get("origin") === premiumSiteOrigin();
}

const CREATE_CHALLENGE = `
if redis.call('EXISTS', KEYS[1]) == 1 or redis.call('EXISTS', KEYS[2]) == 1 then return 0 end
redis.call('SET', KEYS[1], 'pending', 'EX', ARGV[1])
redis.call('SET', KEYS[2], ARGV[2], 'EX', ARGV[1])
return 1
`;

const CLAIM = `
if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end
local current = redis.call('GET', KEYS[2])
if not current then return 0 end
if current == 'pending' then
  redis.call('SET', KEYS[2], 'candidate:' .. ARGV[2], 'KEEPTTL')
  return 1
end
if current == 'candidate:' .. ARGV[2] then return 1 end
return 0
`;

const CONFIRM = `
if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end
local current = redis.call('GET', KEYS[2])
if current ~= 'candidate:' .. ARGV[2] then return 0 end
redis.call('SET', KEYS[2], 'connected:' .. ARGV[2], 'EX', ARGV[3])
redis.call('DEL', KEYS[1])
return 1
`;

/** Session/challenge material is only stored as SHA-256 hashes. No local or implicit login fallback. */
export function premiumAuthStore(environment: "test" | "live") {
  if (environment !== "test" && environment !== "live") throw new PremiumStorageError("ENVIRONMENT");
  const prefix = `the-browser:{premium:${environment}}:auth:`;
  const sessionPrefix = `${prefix}session:`;
  const codeKey = (code: string) => `${prefix}challenge:${hash(code)}`;

  async function start() {
    const token = randomBytes(32).toString("base64url");
    const code = randomBytes(24).toString("base64url");
    const result = await premiumRedisCommand(["EVAL", CREATE_CHALLENGE, 2, sessionPrefix + hash(token), codeKey(code), CHALLENGE_TTL, hash(token)]);
    if (result !== 1) throw new PremiumStorageError("AUTH_CREATE");
    return { token, code, url: `https://t.me/Thebrowser365_bot?start=premium_${environment}_${code}` };
  }
  async function status(token: string) {
    if (!validToken(token)) return { status: "anonymous" as const };
    const value = await premiumRedisCommand(["GET", sessionPrefix + hash(token)]);
    if (value === null) return { status: "anonymous" as const };
    if (value === "pending" || (typeof value === "string" && /^candidate:[1-9]\d{0,15}$/.test(value))) return { status: "pending" as const };
    if (typeof value === "string" && value.startsWith("connected:") && validUser(value.slice(10))) {
      return { status: "connected" as const, telegramUserId: value.slice(10) };
    }
    throw new PremiumStorageError("AUTH_CORRUPT");
  }
  async function claim(code: string, user: string) {
    if (!validCode(code) || !validUser(user)) return false;
    const sessionHash = await premiumRedisCommand(["GET", codeKey(code)]);
    if (sessionHash === null) return false;
    if (typeof sessionHash !== "string" || !/^[0-9a-f]{64}$/.test(sessionHash)) throw new PremiumStorageError("AUTH_CORRUPT");
    return (await premiumRedisCommand(["EVAL", CLAIM, 2, codeKey(code), sessionPrefix + sessionHash, sessionHash, user])) === 1;
  }
  async function confirm(code: string, user: string) {
    if (!validCode(code) || !validUser(user)) return false;
    const sessionHash = await premiumRedisCommand(["GET", codeKey(code)]);
    if (sessionHash === null) return false;
    if (typeof sessionHash !== "string" || !/^[0-9a-f]{64}$/.test(sessionHash)) throw new PremiumStorageError("AUTH_CORRUPT");
    return (await premiumRedisCommand(["EVAL", CONFIRM, 2, codeKey(code), sessionPrefix + sessionHash, sessionHash, user, PREMIUM_SESSION_TTL])) === 1;
  }
  async function logout(token: string) {
    if (validToken(token)) await premiumRedisCommand(["DEL", sessionPrefix + hash(token)]);
  }
  return { start, status, claim, confirm, logout };
}

type TelegramUpdate = {
  message?: { chat?: { id?: number; type?: string }; from?: { id?: number; is_bot?: boolean }; text?: string };
  callback_query?: { id?: string; from?: { id?: number; is_bot?: boolean }; data?: string;
    message?: { chat?: { id?: number; type?: string } } };
};

/** Call only after verifying the Telegram webhook secret. Replies are Bot API webhook responses. */
export async function premiumTelegramReply(update: TelegramUpdate) {
  if (!premiumAuthEnabled()) return null;
  const environment = premiumEnvironment();
  const auth = premiumAuthStore(environment);
  const message = update.message;
  if (message?.chat?.type === "private" && Number.isSafeInteger(message.from?.id) &&
      message.from!.id! > 0 && !message.from?.is_bot && message.chat.id === message.from?.id) {
    const match = typeof message.text === "string" ? message.text.match(/^\/start(?:@Thebrowser365_bot)? premium_(test|live)_([A-Za-z0-9_-]{32})$/i) : null;
    if (!match || match[1].toLowerCase() !== environment) return null;
    const accepted = await auth.claim(match[2], String(message.from!.id));
    if (!accepted) return { method: "sendMessage", chat_id: message.chat.id, text: "Cette demande de connexion a expiré ou a déjà été utilisée. Recommencez depuis le site The Browser." };
    return { method: "sendMessage", chat_id: message.chat.id,
      text: "Confirmez la connexion de votre compte Telegram au navigateur où vous venez d’ouvrir The Browser. Si vous n’avez pas demandé cette connexion, ne confirmez pas. Cette action ne donne aucun accès Premium et ne déclenche aucun paiement.",
      reply_markup: { inline_keyboard: [[{ text: "Confirmer ma connexion", callback_data: `premium_${environment}_${match[2]}` }]] } };
  }
  const callback = update.callback_query;
  if (typeof callback?.id === "string" && callback.id.length <= 200 && callback.message?.chat?.type === "private" &&
      Number.isSafeInteger(callback.from?.id) && callback.from!.id! > 0 && !callback.from?.is_bot && callback.message.chat.id === callback.from?.id) {
    const match = typeof callback.data === "string" ? callback.data.match(/^premium_(test|live)_([A-Za-z0-9_-]{32})$/) : null;
    if (!match || match[1] !== environment) return null;
    const accepted = await auth.confirm(match[2], String(callback.from!.id));
    return { method: "answerCallbackQuery", callback_query_id: callback.id,
      text: accepted ? "Compte associé. Revenez sur The Browser." : "Demande expirée ou déjà utilisée. Recommencez depuis le site.", show_alert: true };
  }
  return null;
}
