import { randomUUID } from "node:crypto";
import { premiumRedisCommand } from "./premium-redis.ts";
import { readChannelState } from "./telegram-store.ts";
import { copyCommand, findCopyPlans, type CopyPlan } from "./telegram-copy-plan.ts";

type Job = { plan: CopyPlan; source: string; target: string; user: number; status: "queued" | "running" | "done" | "blocked";
  index: number; copied: number; skipped: number; posterDone: boolean; notBefore?: number };
type Bot = (method: string, body: Record<string, unknown>) => Promise<Record<string, unknown>>;
type Dependencies = { redis: typeof premiumRedisCommand; bot: Bot; catalogue: typeof readChannelState;
  poster: (plan: CopyPlan) => Promise<string | null>; pause: (ms: number) => Promise<void>; now: () => number };
const prefix = "the-browser:{telegram-copy-jobs}:", queue = prefix + "queue", lock = prefix + "lock";
export function telegramCopyEnabled(env = process.env) {
  return env.VERCEL === "1" && env.VERCEL_ENV === "production" && env.TELEGRAM_COPY_ENABLED === "1" &&
    /^-100\d+$/.test(env.TELEGRAM_CHANNEL_ID ?? "") && /^-100\d+$/.test(env.TELEGRAM_PREMIUM_CHANNEL_ID ?? "") && env.TELEGRAM_CHANNEL_ID !== env.TELEGRAM_PREMIUM_CHANNEL_ID;
}
export class TelegramCopyRateLimit extends Error {
  readonly seconds: number;
  constructor(seconds: number) { super("RATE_LIMIT"); this.seconds = seconds; }
}
async function telegram(method: string, body: Record<string, unknown>) {
  let response, data;
  try {
    response = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body), redirect: "error", signal: AbortSignal.timeout(50_000) });
    data = await response.json();
  } catch { throw new Error("TELEGRAM_UNCERTAIN"); }
  if (!response.ok || !data.ok) {
    if (response.status === 429 && Number.isInteger(data.parameters?.retry_after) && data.parameters.retry_after > 0) throw new TelegramCopyRateLimit(data.parameters.retry_after);
    throw new Error("TELEGRAM_REJECTED");
  }
  return data.result as Record<string, unknown>;
}
async function poster(plan: CopyPlan) {
  const response = await fetch(`https://api.themoviedb.org/3/${plan.kind === "serie" ? "tv" : "movie"}/${plan.id}?language=fr-FR`, {
    headers: { Authorization: `Bearer ${process.env.TMDB_READ_TOKEN ?? ""}` }, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error("POSTER_UNAVAILABLE");
  const detail = await response.json();
  if (detail.id !== plan.id) throw new Error("POSTER_MISMATCH");
  return /^\/[A-Za-z0-9_.-]+$/.test(detail.poster_path ?? "") ? `https://image.tmdb.org/t/p/w780${detail.poster_path}` : null;
}

export function telegramCopyService(overrides: Partial<Dependencies> = {}, env = process.env) {
  const d: Dependencies = { redis: premiumRedisCommand, bot: telegram, catalogue: readChannelState, poster,
    pause: ms => new Promise(r => setTimeout(r, ms)), now: Date.now, ...overrides };
  const source = env.TELEGRAM_CHANNEL_ID!, target = env.TELEGRAM_PREMIUM_CHANNEL_ID!;
  async function authorized(user: number) {
    const configured = (env.TELEGRAM_COPY_ADMIN_IDS ?? "").split(",").map(v => v.trim()).filter(v => /^[1-9]\d*$/.test(v));
    if (configured.includes(String(user))) return true;
    // Ownership is rechecked against Telegram, never inferred from a username,
    // an incoming forwarded message, or general administrator permissions.
    for (const chat_id of [target, source]) if ((await d.bot("getChatMember", { chat_id, user_id: user })).status === "creator") return true;
    return false;
  }
  const reply = (user: number, text: string) => ({ method: "sendMessage", chat_id: user, text });
  const progress = (job: Job) => `${job.plan.title} : ${job.index}/${job.plan.messages.length} vidéos traitées (${job.copied} copiées, ${job.skipped} déjà présentes).`;
  async function command(update: { update_id?: number; message?: { text?: string; chat?: { type?: string; id?: number }; from?: { id?: number; is_bot?: boolean } } }) {
    const message = update.message, parsed = typeof message?.text === "string" ? copyCommand(message.text) : null;
    if (!parsed || !telegramCopyEnabled(env)) return null;
    const user = message?.from?.id;
    if (!Number.isSafeInteger(user) || !user || user < 1 || message?.from?.is_bot || message?.chat?.type !== "private" || message.chat.id !== user || !Number.isSafeInteger(update.update_id)) return null;
    if (!await authorized(user)) return { reply: reply(user, "Cette commande est réservée au propriétaire du canal et aux comptes autorisés."), wake: false };
    if (parsed.status) {
      const latest = await d.redis(["GET", prefix + "latest:" + user]);
      const raw = typeof latest === "string" && latest.startsWith(prefix + "job:") ? await d.redis(["GET", latest]) : null;
      if (!raw) return { reply: reply(user, "Aucune copie demandée. Exemple : /copier Tout le monde déteste Chris"), wake: false };
      const job: Job = JSON.parse(String(raw));
      return { reply: reply(user, `${progress(job)}\n${({ queued: "En attente de reprise automatique.", running: "Copie en cours.", done: "Copie terminée.", blocked: "Un envoi doit être vérifié dans le Premium avant toute reprise. Ne relancez pas une copie pour éviter un doublon." })[job.status]}`), wake: false };
    }
    if (!parsed.query) return { reply: reply(user, "Envoyez /copier suivi du titre. Exemples : /copier série Tout le monde déteste Chris ou /copier film John Wick : Chapitre 4. /copie affiche l’avancement."), wake: false };
    const plans = findCopyPlans(parsed.query, Object.values((await d.catalogue()).posts));
    if (!plans.length) return { reply: reply(user, "Aucune vidéo identifiée pour ce titre dans le canal public. Précisez le titre exact, le type ou l’année."), wake: false };
    if (plans.length > 1) return { reply: reply(user, "Plusieurs titres correspondent. Précisez votre choix :\n" + plans.slice(0, 8).map(p => `${p.title}${p.year ? ` (${p.year})` : ""} → /copier ${p.kind}-${p.id}`).join("\n")), wake: false };
    const plan = plans[0], key = prefix + `job:${plan.kind}:${plan.id}`;
    const job: Job = { plan, source, target, user, status: "queued", index: 0, copied: 0, skipped: 0, posterDone: false };
    const result = await d.redis(["EVAL", `
if redis.call('EXISTS',KEYS[1])==1 then return 'repeat' end
local old=redis.call('GET',KEYS[2])
redis.call('SET',KEYS[1],'1','EX',604800)
redis.call('SET',KEYS[4],KEYS[2])
if old and cjson.decode(old).status~='done' then return 'busy' end
redis.call('SET',KEYS[2],ARGV[1])
redis.call('RPUSH',KEYS[3],KEYS[2])
return 'queued'`, 4, prefix + "update:" + update.update_id, key, queue, prefix + "latest:" + user, JSON.stringify(job)]);
    const text = result === "queued" ? `${plan.title} : demande enregistrée pour ${plan.messages.length} vidéo(s), avec l’affiche si disponible. Les vidéos déjà copiées seront conservées sans doublon. Suivi : /copie.` : "Cette demande est déjà enregistrée ou nécessite une vérification. Suivi : /copie.";
    return { reply: reply(user, text), wake: true };
  }

  async function worker(budgetMs = 100_000) {
    if (!telegramCopyEnabled(env)) return { enabled: false };
    const token = randomUUID();
    if (await d.redis(["SET", lock, token, "NX", "EX", 240]) !== "OK") return { busy: true };
    const lease = async () => { if (await d.redis(["GET", lock]) !== token) throw new Error("LEASE_LOST"); };
    const finishAt = d.now() + budgetMs;
    try {
      while (d.now() < finishAt) {
        const key = await d.redis(["LINDEX", queue, 0]);
        if (key === null) return { idle: true };
        if (typeof key !== "string" || !key.startsWith(prefix + "job:")) throw new Error("JOB_INVALID");
        const raw = await d.redis(["GET", key]);
        if (typeof raw !== "string") throw new Error("JOB_MISSING");
        const job: Job = JSON.parse(raw);
        if (job.notBefore && d.now() < job.notBefore) return { deferred: true };
        const save = async (terminal = false) => {
          const saved = await d.redis(["EVAL", `if redis.call('GET',KEYS[1])~=ARGV[1] then return 0 end
redis.call('SET',KEYS[2],ARGV[2])
if ARGV[3]=='1' and redis.call('LINDEX',KEYS[3],0)==KEYS[2] then redis.call('LPOP',KEYS[3]) end
return 1`, 3, lock, key, queue, token, JSON.stringify(job), terminal ? "1" : "0"]);
          if (saved !== 1) throw new Error("LEASE_LOST");
        };
        async function sendOnce(registry: string, method: string, body: Record<string, unknown>) {
          const prior = await d.redis(["GET", registry]);
          if (prior) {
            const record = JSON.parse(String(prior));
            if (record.status !== "copied" || !Number.isSafeInteger(record.targetMessageId) || record.targetMessageId < 1) throw new Error("COPY_UNCERTAIN");
            return false;
          }
          await lease();
          const metadata = { source, target, titleId: job.plan.id, kind: job.plan.kind,
            ...(method === "copyMessage" ? { sourceMessageId: body.message_id, season: job.plan.messages[job.index]?.season, episode: job.plan.messages[job.index]?.episode } : {}) };
          const reservation = JSON.stringify({ ...metadata, status: "sending", startedAt: new Date(d.now()).toISOString() });
          if (await d.redis(["SET", registry, reservation, "NX"]) !== "OK") throw new Error("COPY_UNCERTAIN");
          let result;
          try { result = await d.bot(method, { chat_id: target, ...body, disable_notification: true }); }
          catch (error) {
            if (error instanceof TelegramCopyRateLimit) await d.redis(["EVAL", "if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('DEL',KEYS[1]) end return 0", 1, registry, reservation]);
            throw error;
          }
          if (!Number.isSafeInteger(result.message_id) || Number(result.message_id) < 1) throw new Error("COPY_UNCERTAIN");
          await d.redis(["SET", registry, JSON.stringify({ ...metadata, status: "copied", targetMessageId: result.message_id, completedAt: new Date(d.now()).toISOString() })]);
          await d.pause(1200);
          return true;
        }
        try {
          if (job.source !== source || job.target !== target || !await authorized(job.user)) throw new Error("OWNER_CHANGED");
          job.status = "running"; await save();
          const base = `the-browser:telegram-copy:${source}:${target}:`;
          if (!job.posterDone) {
            const posterKey = base + `poster:${job.plan.kind === "serie" ? "tv" : "movie"}:${job.plan.id}`;
            if (await d.redis(["GET", posterKey])) await sendOnce(posterKey, "sendPhoto", {});
            else {
              const image = await d.poster(job.plan);
              if (image) await sendOnce(posterKey, "sendPhoto", { photo: image, caption: `${job.plan.title}\n${job.plan.messages.length} vidéo(s)\nAffiche : TMDB` });
            }
            job.posterDone = true; await save();
          }
          while (job.index < job.plan.messages.length && d.now() < finishAt) {
            const message = job.plan.messages[job.index];
            const sent = await sendOnce(base + message.messageId, "copyMessage", { from_chat_id: source, message_id: message.messageId });
            if (sent) job.copied++; else job.skipped++;
            job.index++; await save();
          }
          job.status = job.index === job.plan.messages.length ? "done" : "queued";
          await save(job.status === "done");
          if (job.status === "done") await d.bot("sendMessage", { chat_id: job.user, text: `Copie terminée. ${progress(job)}` }).catch(() => {});
        } catch (error) {
          if (error instanceof TelegramCopyRateLimit) { job.status = "queued"; job.notBefore = d.now() + error.seconds * 1000; await save(); return { deferred: true }; }
          job.status = "blocked"; await save(true);
          await d.bot("sendMessage", { chat_id: job.user, text: `${progress(job)}\nCopie suspendue : un envoi ou les droits du canal doivent être vérifiés avant de poursuivre, afin d’éviter les doublons. Suivi : /copie.` }).catch(() => {});
        }
      }
      return { pending: true };
    } finally {
      await d.redis(["EVAL", "if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('DEL',KEYS[1]) end return 0", 1, lock, token]);
    }
  }
  return { command, worker, authorized };
}
