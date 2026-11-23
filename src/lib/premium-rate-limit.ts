import {createHash} from "node:crypto";
import {isIP} from "node:net";
import {premiumEnvironment} from "./premium-auth.ts";
import {premiumRedisCommand} from "./premium-redis.ts";

export const PREMIUM_LIMITS = {
  "auth-start": {maximum: 20, seconds: 600},
  "auth-session": {maximum: 120, seconds: 60},
  "payment-create": {maximum: 12, seconds: 60},
  "subscription": {maximum: 30, seconds: 60},
  "payment-status": {maximum: 30, seconds: 60},
  "payment-cancel": {maximum: 12, seconds: 60},
  "channel-invite": {maximum: 10, seconds: 60},
} as const;
const COUNT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
local ttl = redis.call('TTL', KEYS[1])
if ttl < 0 then redis.call('EXPIRE', KEYS[1], ARGV[1]); ttl = tonumber(ARGV[1]) end
return {count, ttl}
`;
export function requestRateSubject(request: Request, env = process.env) {
  // Vercel overwrites this header at its ingress. Outside Vercel, never trust a
  // caller-supplied forwarding header. Missing IPs share a bounded fallback.
  const ip = env.VERCEL === "1" ? request.headers.get("x-vercel-forwarded-for")?.trim() : undefined;
  return ip && isIP(ip) ? `ip:${ip}` : "unattributed";
}
export async function premiumRateLimit(scope: keyof typeof PREMIUM_LIMITS, subject: string,
  command = premiumRedisCommand, environment = premiumEnvironment()): Promise<Response | null> {
  const rule = PREMIUM_LIMITS[scope];
  const digest = createHash("sha256").update(subject).digest("hex");
  const key = `the-browser:{premium:${environment}}:rate:${scope}:${digest}`;
  try {
    const result = await command(["EVAL", COUNT, 1, key, rule.seconds]);
    if (!Array.isArray(result) || result.length !== 2 || result.some(v => !Number.isSafeInteger(v) || v < 0)) throw new Error();
    if (result[0] <= rule.maximum) return null;
    return Response.json({error: "Trop de demandes. Patientez avant de réessayer."}, {status: 429,
      headers: {"Retry-After": String(Math.max(1, result[1])), "Cache-Control": "private, no-store"}});
  } catch {
    // A Redis outage must not turn off protection on sensitive operations.
    return Response.json({error: "Service momentanément indisponible."}, {status: 503, headers: {"Cache-Control": "private, no-store"}});
  }
}
