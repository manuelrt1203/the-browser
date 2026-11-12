import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";

export type ChannelPost = {
  messageId: number;
  version: number;
  updateId: number;
  text: string;
  titles: { kind: "film" | "serie"; id: number }[];
  pending: string[];
};
type State = { posts: Record<string, ChannelPost> };
const queues = new Map<string, Promise<unknown>>();
export function catalogueFile() {
  const directory = process.env.CATALOGUE_DATA_DIR;
  if (!directory) throw new Error("CATALOGUE_DATA_DIR manquant");
  return join(directory, "telegram-catalogue.json");
}
export function hasCatalogueStorage(): boolean {
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) return true;
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) return true;
  return !process.env.VERCEL && Boolean(process.env.CATALOGUE_DATA_DIR);
}

function redisConfiguration() {
  const useKV = Boolean(process.env.KV_REST_API_URL || process.env.KV_REST_API_TOKEN);
  const url = useKV ? process.env.KV_REST_API_URL : process.env.UPSTASH_REDIS_REST_URL;
  const token = useKV ? process.env.KV_REST_API_TOKEN : process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url && !token) return null;
  if (!url || !token) throw new Error("Configuration Redis incomplète");
  const endpoint = new URL(url);
  if (endpoint.protocol !== "https:" || endpoint.username || endpoint.password || endpoint.search || endpoint.hash) {
    throw new Error("Redis nécessite une URL HTTPS sans identifiants");
  }
  return { url: endpoint.toString(), token };
}

async function redisCommand(command: (string | number)[]) {
  const config = redisConfiguration();
  if (!config) throw new Error("Redis non configuré");
  const response = await fetch(config.url, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.token}`, "Content-Type": "application/json" },
    body: JSON.stringify(command),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error("Stockage Redis indisponible");
  const data = await response.json() as { result?: unknown; error?: string };
  if (data.error || !("result" in data)) throw new Error("Commande Redis refusée");
  return data.result;
}

function redisKey() {
  const channel = process.env.TELEGRAM_CHANNEL_ID;
  if (!channel || !/^-100\d+$/.test(channel)) throw new Error("ID de canal invalide");
  return `the-browser:telegram:${channel}`;
}

// Redis exécute cette comparaison et l’écriture en une seule opération atomique,
// même lorsque plusieurs fonctions Vercel reçoivent des événements simultanés.
const SAVE_POST_SCRIPT = `
local old = redis.call('HGET', KEYS[1], ARGV[1])
local incoming = cjson.decode(ARGV[2])
if old then
  local current = cjson.decode(old)
  if current.version > incoming.version or
    (current.version == incoming.version and current.updateId >= incoming.updateId) then
    return 0
  end
end
redis.call('HSET', KEYS[1], ARGV[1], ARGV[2])
return 1
`;

function validateState(value: unknown): asserts value is State {
  if (!value || typeof value !== "object" || !("posts" in value) || !value.posts || typeof value.posts !== "object") throw new Error("Catalogue invalide");
  for (const post of Object.values(value.posts)) {
    if (!post || !Number.isSafeInteger(post.messageId) || !Number.isSafeInteger(post.version) || !Number.isSafeInteger(post.updateId) ||
      typeof post.text !== "string" || !Array.isArray(post.titles) || !Array.isArray(post.pending) ||
      !post.pending.every((line: unknown) => typeof line === "string") ||
      !post.titles.every((title: { kind?: unknown; id?: number }) => title && (title.kind === "film" || title.kind === "serie") && Number.isSafeInteger(title.id) && title.id! > 0)) {
      throw new Error("Publication stockée invalide");
    }
  }
}

export async function readChannelState(file?: string): Promise<State> {
  if (!file && redisConfiguration()) {
    const fields = await redisCommand(["HGETALL", redisKey()]);
    if (!Array.isArray(fields) || fields.length % 2 !== 0) throw new Error("Réponse Redis invalide");
    const state: State = { posts: {} };
    for (let i = 0; i < fields.length; i += 2) {
      if (typeof fields[i] !== "string" || typeof fields[i + 1] !== "string") throw new Error("Réponse Redis invalide");
      state.posts[fields[i]] = JSON.parse(fields[i + 1]);
    }
    validateState(state);
    return state;
  }
  if (!file && process.env.VERCEL) throw new Error("Redis requis sur Vercel");
  file ??= catalogueFile();
  try {
    const state: unknown = JSON.parse(await readFile(/* turbopackIgnore: true */ file, "utf8"));
    validateState(state);
    return state;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { posts: {} };
    throw error;
  }
}
/** Redis partagé sur Vercel ; fichier atomique pour le développement avec une seule instance. */
export async function saveChannelPost(channel: string, post: ChannelPost, file?: string) {
  validateState({ posts: { post } });
  if (!file && redisConfiguration()) {
    if (channel !== process.env.TELEGRAM_CHANNEL_ID) throw new Error("Canal non autorisé");
    const result = await redisCommand(["EVAL", SAVE_POST_SCRIPT, 1, redisKey(), `${channel}:${post.messageId}`, JSON.stringify(post)]);
    if (result !== 0 && result !== 1) throw new Error("Réponse Redis invalide");
    return result === 1;
  }
  if (!file && process.env.VERCEL) throw new Error("Redis requis sur Vercel");
  const targetFile = file ?? catalogueFile();
  const previous = queues.get(targetFile) ?? Promise.resolve();
  const operation = previous.catch(() => {}).then(async () => {
    const state = await readChannelState(targetFile);
    const key = `${channel}:${post.messageId}`;
    const existing = state.posts[key];
    if (existing && (existing.version > post.version ||
      (existing.version === post.version && existing.updateId >= post.updateId))) return false;
    state.posts[key] = post;
    await mkdir(dirname(targetFile), { recursive: true });
    const temporary = `${targetFile}.${randomUUID()}.tmp`;
    await writeFile(temporary, JSON.stringify(state), { mode: 0o600 });
    await rename(temporary, targetFile);
    return true;
  });
  queues.set(targetFile, operation);
  try { return await operation; }
  finally { if (queues.get(targetFile) === operation) queues.delete(targetFile); }
}

/** Format explicite : une référence TMDB par ligne. Les autres lignes restent en attente. */
export function parseChannelText(text: string) {
  const titles: ChannelPost["titles"] = [];
  const pending: string[] = [];
  for (const line of text.split(/\r?\n/).map((s) => s.trim()).filter(Boolean)) {
    const matches = [...line.matchAll(/https:\/\/(?:www\.)?themoviedb\.org\/(movie|tv)\/(\d+)(?=$|[\s/?#-])/g)];
    if (!matches.length) { pending.push(line); continue; }
    for (const match of matches) {
      const id = Number(match[2]);
      const kind = match[1] === "movie" ? "film" : "serie";
      if (Number.isSafeInteger(id) && id > 0 && !titles.some((t) => t.kind === kind && t.id === id)) titles.push({ kind, id });
    }
  }
  return { titles, pending };
}

export function cleanTelegramTitle(value: string): string {
  return value.normalize("NFKC")
    .replace(/\.[a-z0-9]{2,4}$/i, "")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/[._|]/g, " ")
    .replace(/\b(?:s\s*\d+\s*e\s*\d+|saison\s*\d+|season\s*\d+|s\d+|[ée]pisode\s*\d+|ep?\s*\d+)\b.*$/i, "")
    .replace(/\b(?:vf|vostfr|french|truefrench|webrip|webdl|h264|x264|mp4)\b.*$/i, "")
    .trim();
}
export function matchKnownTitle(value: string, known: { title: string; kind: "film" | "serie"; id?: number }[]) {
  const normalize = (s: string) => cleanTelegramTitle(s).normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  const aliases: Record<string, string> = {
    houseofdragon: "houseofthedragon", houseofdagon: "houseofthedragon",
    everybodyhateschris: "toutlemondedetestechris", from: "from",
    nanatsunotaizai: "thesevendeadlysins", nantsunotaizai: "thesevendeadlysins",
    theapothecarydiaries: "lescarnetsdelapothicaire", supermanandlois: "supermanetlois",
    kungfukiller: "kungfujungle",
  };
  const name = normalize(value);
  const matches = known.filter((title) => title.id !== undefined && normalize(title.title) === (aliases[name] ?? name));
  if (matches.length !== 1) return null;
  return { kind: matches[0].kind, id: matches[0].id! };
}
