import { requestedTitles } from "../data/selection.ts";
import type { Kind } from "../data/catalogue.ts";

export const RESOLUTION_VERSION = 2;
export type Reference = { kind: Kind; id: number; expectedTitle?: string; year?: number; season?: number; episode?: number };
export type Candidate = { query: string; kind?: Kind; year?: number; season?: number; episode?: number };
export type Pending = { input: string; reason: string; candidates?: { kind: Kind; id: number; title: string; year?: number }[] };
export type Resolution = { titles: Reference[]; pending: string[]; review: Pending[]; ignored: string[] };

type Item = { id: number; media_type?: string; title?: string; name?: string; original_title?: string; original_name?: string; release_date?: string; first_air_date?: string };
export const normalizeTitle = (s: string) => s.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

// Ces alias corrigent des graphies du corpus ; ils désignent un titre, jamais un ID supposé.
const aliases: Record<string, string> = {
  maitresdelunivers: "Les Maîtres de l’univers",
  adifferentworldt: "A Different World", aknightofthesevenkingdom: "A Knight of the Seven Kingdoms",
  houseofdragon: "House of the Dragon", houseofdagon: "House of the Dragon",
  everybodyhateschris: "Tout le monde déteste Chris", dragonballsuperbeerus: "Dragon Ball Super",
  nanatsunotaizai: "The Seven Deadly Sins", nantsunotaizai: "The Seven Deadly Sins",
  nanatsunotaizai4fundonoshinpan: "The Seven Deadly Sins",
  theapothecarydiaries: "Les Carnets de l’apothicaire", supermanandlois: "Superman et Loïs",
  kungfukiller: "Kung Fu Jungle", kunfukiller: "Kung Fu Jungle", lesamaritain: "Le Samaritain",
  avatarangthelastairbender: "Avatar : Le Dernier Maître de l’air",
  avataraangthelastairbender: "Avatar Aang The Last Airbender",
  avatarthelastairbender: "Avatar : Le Dernier Maître de l’air",
  thefaultinourstars: "Nos étoiles contraires", theflash: "Flash", thenun: "La Nonne",
  shreek1: "Shrek", shreek2: "Shrek 2", shreeek3: "Shrek le troisième", shreeek4: "Shrek 4 : Il était une fin",
  ipman1: "Ip Man", johnwick3: "John Wick : Parabellum", johnwickchapter2: "John Wick 2", johnwickchapter4: "John Wick : Chapitre 4",
  sonicthehedgehog3: "Sonic 3, le film",
  sullivanscrossing: "Sullivan’s Crossing", marvelsthepunisher: "Marvel’s The Punisher",
  theamazinspiderman2: "The Amazing Spider-Man : Le Destin d’un héros", theamazingspiderman2: "The Amazing Spider-Man : Le Destin d’un héros",
  miraculous: "Miraculous : Les Aventures de Ladybug et Chat Noir",
  jujutsukaisenthecullinggame: "Jujutsu Kaisen", matchboxthemovie: "Matchbox",
  harrypotter1: "Harry Potter à l’école des sorciers", harrypotter2: "Harry Potter et la Chambre des secrets",
  harrypotter3: "Harry Potter et le Prisonnier d’Azkaban", harrypotter4etlacoupedefeu: "Harry Potter et la Coupe de feu",
  harrypotter5: "Harry Potter et l’Ordre du Phénix", harrypotter6: "Harry Potter et le Prince de sang-mêlé",
  harrypotter7: "Harry Potter et les Reliques de la Mort — Partie 1", harrypotter8: "Harry Potter et les Reliques de la Mort — Partie 2",
};

export function parseCandidate(input: string): Candidate | null {
  let text = input.normalize("NFKC").replace(/\bS[Oo](?=\d)/g, "S0").trim();
  if (/(?:ajoute.*(?:dossier|canal)|abonnez|rejoignez|liens dans le canal|dossier complet)/i.test(text)) return null;
  if (!text || /^\d+$/.test(text) || /^(?:index-v\d+-a\d+|sticker(?:\s+webp)?)$/i.test(text) || /https?:\/\//i.test(text)) return null;
  const seasonEpisode = text.match(/\bS(?:aison)?\s*(\d+)\s*[|._ -]*(?:[ÉE]P?(?:ISODE)?)\s*(\d+)/i);
  const season = seasonEpisode?.[1] ?? text.match(/\bS(?:aison)?\s*(\d+)/i)?.[1];
  const episode = seasonEpisode?.[2] ?? text.match(/\b[ÉE]P?(?:ISODE)?\s*(\d+)/i)?.[1];
  const year = text.match(/\b((?:19|20)\d{2})\b/)?.[1];
  const isFilm = /^\s*film\b/i.test(text);
  text = text.replace(/\.(?:mp4|mkv|avi|mov|mpg|mpeg|webm|m4v|ts)$/i, "")
    .replace(/\[[^\]]*\]/g, " ").replace(/@[\p{L}\p{N}_]+@/gu, " ").replace(/@[\p{L}\p{N}_]+/gu, " ")
    .replace(/(?:Oxtorrent[ ._]Com|Torrent911[ ._]com)/gi, " ")
    .replace(/[._|]/g, " ")
    .replace(/\(\s*live[ -]?action\s*\)/gi, " ")
    .replace(/^[^\p{L}\p{N}]*ACTION\s+ZONE[^\p{L}\p{N}]*/iu, "")
    .replace(/^\s*(?:voir|film)\s+/i, "")
    .replace(/\b(?:S(?:aison)?\s*\d+\s*[- ]*(?:[ÉE]P?(?:ISODE)?)\s*\d+|S(?:aison)?\s*\d+)\b.*$/i, "")
    .replace(/\b[ÉE]P?(?:ISODE)?\s*\d+\s*/gi, " ")
    .replace(/\b(?:19|20)\d{2}\b/g, " ")
    .replace(/\b(?:film\s+complet|vfq?|vostfr|french|truefrench|multi|hdcam|hdtv|web[ -]?rip|web[ -]?dl|webrip|h26[45]|x26[45]|\d{3,4}p|galaxy)\b.*$/i, "")
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "").replace(/\s+/g, " ").trim();
  if (!text || text.length > 180 || text.split(/\s+/).length > 16 || /^\d+$/.test(text)) return null;
  const key = normalizeTitle(text);
  text = aliases[key] ?? text;
  const known = requestedTitles.filter((t) => normalizeTitle(t.title.replace(/\s*\(\d{4}\)$/, "")) === normalizeTitle(text));
  let kind: Kind | undefined = season || episode ? "serie" : isFilm ? "film" : undefined;
  let inferredYear = year ? Number(year) : undefined;
  if (known.length === 1 && (!kind || known[0].kind === kind)) {
    kind ??= known[0].kind;
    inferredYear ??= known[0].year ?? (Number(known[0].title.match(/\((\d{4})\)$/)?.[1]) || undefined);
  }
  return { query: text, ...(kind ? { kind } : {}), ...(inferredYear ? { year: inferredYear } : {}), ...(season ? { season: Number(season) } : {}), ...(episode ? { episode: Number(episode) } : {}) };
}

export class TmdbUnavailable extends Error { name = "TmdbUnavailable"; }
export async function tmdbRequest<T>(path: string, params: Record<string, string> = {}): Promise<T | null> {
  const token = process.env.TMDB_READ_TOKEN;
  if (!token || token === "[SENSITIVE]") throw new TmdbUnavailable("TMDB_READ_TOKEN manquant");
  const url = new URL(`https://api.themoviedb.org/3${path}`);
  url.searchParams.set("language", "fr-FR");
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  let response;
  try {
    response = await fetch(url, { headers: { Authorization: `Bearer ${token}`, accept: "application/json" }, signal: AbortSignal.timeout(8000) });
  } catch { throw new TmdbUnavailable("TMDB inaccessible"); }
  if (response.status === 404) return null;
  if (!response.ok) throw new TmdbUnavailable(`TMDB HTTP ${response.status}`);
  try { return await response.json() as T; }
  catch { throw new TmdbUnavailable("Réponse JSON TMDB invalide"); }
}
const itemYear = (item: Item, kind: Kind) => {
  const date = kind === "film" ? item.release_date : item.first_air_date;
  return date && /^\d{4}/.test(date) ? Number(date.slice(0, 4)) : undefined;
};
export function matchesCandidate(item: Item, kind: Kind, candidate: Candidate): boolean {
  const known = requestedTitles.find((t) => normalizeTitle(t.title) === normalizeTitle(candidate.query) && (!candidate.kind || candidate.kind === t.kind));
  const expected = [candidate.query, ...(known?.aliases ?? [])].map(normalizeTitle);
  return Number.isSafeInteger(item.id) && item.id > 0 && (!candidate.kind || candidate.kind === kind) && (!candidate.year || candidate.year === itemYear(item, kind)) &&
    [item.title, item.name, item.original_title, item.original_name].some((name) => name && expected.includes(normalizeTitle(name)));
}
const reference = (item: Item, kind: Kind): Reference => ({ kind, id: item.id, expectedTitle: (item.original_title ?? item.original_name ?? item.title ?? item.name)!, ...(itemYear(item, kind) ? { year: itemYear(item, kind) } : {}) });

type Decision = { title?: Reference; reason?: string; candidates?: Pending["candidates"] };
export function createResolver() {
  const memo = new Map<string, Promise<Decision>>();
  const episodes = new Map<string, Promise<boolean>>();
  async function resolveUncached(candidate: Candidate): Promise<Decision> {
    const endpoint = candidate.kind === "film" ? "/search/movie" : candidate.kind === "serie" ? "/search/tv" : "/search/multi";
    const items: Item[] = [];
    let pages = 1;
    for (let page = 1; page <= Math.min(pages, 3); page++) {
      const data = await tmdbRequest<{ results: Item[]; total_pages: number }>(endpoint, { query: candidate.query, page: String(page), include_adult: "false" });
      if (!data || !Array.isArray(data.results) || !Number.isSafeInteger(data.total_pages) || data.total_pages < 0) throw new TmdbUnavailable("Réponse TMDB invalide");
      pages = data.total_pages;
      items.push(...data.results);
    }
    if (pages > 3) return { reason: "recherche-incomplete" };
    const matches = new Map<string, { item: Item; kind: Kind }>();
    for (const item of items) {
      const kind = candidate.kind ?? (item.media_type === "movie" ? "film" : item.media_type === "tv" ? "serie" : undefined);
      if (kind && matchesCandidate(item, kind, candidate)) matches.set(`${kind}:${item.id}`, { item, kind });
    }
    if (matches.size !== 1) return { reason: matches.size ? "ambigu" : "introuvable", candidates: [...matches.values()].map(({ item, kind }) => ({ kind, id: item.id, title: (item.title ?? item.name)!, year: itemYear(item, kind) })) };
    const { item, kind } = [...matches.values()][0];
    // Vérifier le détail : l’ID, le type, le titre et l’année doivent encore correspondre.
    const detail = await tmdbRequest<Item>(`/${kind === "film" ? "movie" : "tv"}/${item.id}`);
    if (!detail || detail.id !== item.id || !matchesCandidate(detail, kind, candidate)) return { reason: "fiche-incoherente" };
    return { title: reference(detail, kind) };
  }
  return async (candidate: Candidate): Promise<Decision> => {
    const key = JSON.stringify([normalizeTitle(candidate.query), candidate.kind, candidate.year]);
    let pending = memo.get(key);
    if (!pending) { pending = resolveUncached(candidate); memo.set(key, pending); pending.catch(() => memo.delete(key)); }
    const decision = await pending;
    if (decision.title?.kind === "serie" && candidate.season !== undefined && candidate.episode !== undefined) {
      const episodeKey = `${decision.title.id}:${candidate.season}:${candidate.episode}`;
      let check = episodes.get(episodeKey);
      if (!check) {
        check = tmdbRequest<{ season_number: number; episode_number: number }>(`/tv/${decision.title.id}/season/${candidate.season}/episode/${candidate.episode}`)
          .then((item) => Boolean(item && item.season_number === candidate.season && item.episode_number === candidate.episode));
        episodes.set(episodeKey, check);
        check.catch(() => episodes.delete(episodeKey));
      }
      if (!await check) return { title: decision.title, reason: "episode-non-verifie" };
    }
    return decision.title ? { ...decision, title: { ...decision.title,
      ...(candidate.season !== undefined ? { season: candidate.season } : {}),
      ...(candidate.episode !== undefined ? { episode: candidate.episode } : {}),
    } } : decision;
  };
}

export async function resolvePublication(
  input: { text?: string; fileName?: string; links?: string[] },
  resolve = createResolver(),
): Promise<Resolution> {
  const result: Resolution = { titles: [], pending: [], review: [], ignored: [] };
  const texts = [...new Set([...(input.text ?? "").split(/\r?\n/), input.fileName ?? "", ...(input.links ?? [])].map((s) => s.trim()).filter(Boolean))];
  const explicit = texts.flatMap((line) => [...line.matchAll(/https:\/\/(?:www\.)?themoviedb\.org\/(movie|tv)\/(\d+)(?=$|[\s/?#-])/g)]);
  if (explicit.length) {
    const seen = new Set<string>();
    for (const match of explicit) {
      if (seen.has(`${match[1]}:${match[2]}`)) continue;
      seen.add(`${match[1]}:${match[2]}`);
      const kind = match[1] === "movie" ? "film" : "serie";
      const id = Number(match[2]);
      if (!Number.isSafeInteger(id) || id <= 0) continue;
      const item = await tmdbRequest<Item>(`/${match[1]}/${id}`);
      if (item && item.id === id && (item.title || item.name)) result.titles.push(reference(item, kind));
      else result.review.push({ input: match[0], reason: "lien-tmdb-invalide" });
    }
  } else {
    const parsedLines = texts.slice(0, 8).map((line) => ({ line, candidate: parseCandidate(line) }));
    for (const { line, candidate } of parsedLines) {
      if (!candidate) { result.ignored.push(line); continue; }
      const related = parsedLines.flatMap((item) => item.candidate && normalizeTitle(item.candidate.query) === normalizeTitle(candidate.query) ? [item.candidate] : []);
      const years = [...new Set(related.flatMap((c) => c.year === undefined ? [] : [c.year]))];
      const kinds = [...new Set(related.flatMap((c) => c.kind === undefined ? [] : [c.kind]))];
      const enriched = { ...candidate, ...(candidate.year === undefined && years.length === 1 ? { year: years[0] } : {}), ...(candidate.kind === undefined && kinds.length === 1 ? { kind: kinds[0] } : {}) };
      const decision = await resolve(enriched);
      if (decision.title) result.titles.push(decision.title);
      if (!decision.title || decision.reason) result.review.push({ input: line, reason: decision.reason ?? "non-resolu", ...(decision.candidates ? { candidates: decision.candidates } : {}) });
    }
    for (const line of texts.slice(8)) result.review.push({ input: line, reason: "trop-de-lignes-a-traiter" });
    // Une légende et un nom de fichier qui identifient deux œuvres ne sont pas fusionnés au hasard.
    const unique = new Set(result.titles.map((t) => `${t.kind}:${t.id}`));
    const seasons = new Set(result.titles.flatMap((t) => t.season === undefined ? [] : [t.season]));
    const episodes = new Set(result.titles.flatMap((t) => t.episode === undefined ? [] : [t.episode]));
    if (input.fileName && (unique.size > 1 || seasons.size > 1 || episodes.size > 1)) {
      result.review.push({ input: input.fileName, reason: "sources-contradictoires" });
      result.titles = [];
    }
  }
  if (input.fileName && /\.(?:mp4|mkv|avi|mov|mpg|mpeg|webm|m4v)$/i.test(input.fileName) && !result.titles.length && !result.review.length) {
    result.review.push({ input: input.fileName, reason: "fichier-sans-titre-identifiable" });
  }
  result.titles = [...new Map(result.titles.map((t) => [`${t.kind}:${t.id}:${t.season ?? ""}:${t.episode ?? ""}`, t])).values()];
  result.pending = [...new Set(result.review.map((item) => item.input))];
  return result;
}
