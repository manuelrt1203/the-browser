import { randomUUID } from "node:crypto";
import { premiumMaintenanceAuthorized } from "@/lib/premium-maintenance-auth";
import { expireChannelAccessBatch, premiumChannelAccessEnabled } from "@/lib/premium-channel-access";
import { premiumRedisCommand } from "@/lib/premium-redis";
import { runExpirationSweep } from "@/lib/premium-expiration-sweep";

export const maxDuration = 300;
const prefix = "the-browser:{premium:live}:expiration-sweep:";
const lock = `${prefix}lock`, state = `${prefix}checkpoint`;
export async function POST(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  if (!premiumChannelAccessEnabled()) return new Response(null, { status: 404, headers });
  if (!await premiumMaintenanceAuthorized(request.headers.get("authorization") ?? "")) return new Response(null, { status: 401, headers });
  const token = randomUUID();
  let acquired = false;
  try {
    acquired = await premiumRedisCommand(["SET", lock, token, "NX", "EX", 360]) === "OK";
    if (!acquired) return Response.json({ error: "Contrôle déjà en cours" }, { status: 409, headers });
    const result = await runExpirationSweep({
      load: async () => {
        const raw = await premiumRedisCommand(["GET", state]);
        if (raw === null) return { cursor: "0", failed: 0 };
        if (typeof raw !== "string") throw new Error("Checkpoint invalide");
        return JSON.parse(raw);
      },
      save: async checkpoint => {
        const saved = await premiumRedisCommand(["EVAL", "if redis.call('GET',KEYS[1])~=ARGV[1] then return 0 end redis.call('SET',KEYS[2],ARGV[2]) return 1", 2,
          lock, state, token, JSON.stringify({ ...checkpoint, lastAttemptAt: new Date().toISOString() })]);
        if (saved !== 1) throw new Error("Verrou perdu");
      },
      batch: async cursor => {
        if (await premiumRedisCommand(["GET", lock]) !== token) throw new Error("Verrou perdu");
        return expireChannelAccessBatch(cursor);
      },
    });
    if (result.complete && result.failed === 0) await premiumRedisCommand(["SET", `${prefix}last-success`, new Date().toISOString()]);
    return Response.json(result, { status: result.complete && result.failed === 0 ? 200 : 503, headers });
  } catch { return Response.json({ error: "Contrôle à reprendre" }, { status: 503, headers }); }
  finally {
    if (acquired) await premiumRedisCommand(["EVAL", "if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('DEL',KEYS[1]) end return 0", 1, lock, token]).catch(() => {});
  }
}
