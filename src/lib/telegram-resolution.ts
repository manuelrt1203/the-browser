import { requestedTitles } from "../data/selection.ts";
import { verifiedEpisodeSources, ownerVerifiedEpisodes, verifiedTitleSources } from "../data/telegram-corrections.ts";
import type { Kind } from "../data/catalogue.ts";

export const RESOLUTION_VERSION = 7;
export type Reference = { kind: Kind; id: number; expectedTitle?: string; verifiedNames?: string[]; year?: number; season?: number; episode?: number; sourceEpisode?: { season: number; episode: number; verifiedBy: "owner" } };
export type Candidate = { query: string; kind?: Kind; year?: number; season?: number; episode?: number };
export type Pending = { input: string; reason: string; candidates?: { kind: Kind; id: number; title: string; year?: number }[] };
export type Resolution = { titles: Reference[]; pending: string[]; review: Pending[]; ignored: string[] };

type Item = { id: number; media_type?: string; title?: string; name?: string; original_title?: string; original_name?: string; release_date?: string; first_air_date?: string };
export const normalizeTitle = (s: string) => s.replace(/(\d+)(?:ème|eme|ère|ere)/gi, "$1e").normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

// Ces alias corrigent des graphies du corpus ; ils désignent un titre, jamais un ID supposé.
const aliases: Record<string, string> = {
  maitresdelunivers: "Les Maîtres de l’univers",
  adifferentworldt: "A Different World", aknightofthesevenkingdom: "A Knight of the Seven Kingdoms",
  houseofdragon: "House of the Dragon", houseofdagon: "House of the Dragon",
  everybodyhateschris: "Tout le monde déteste Chris", dragonballsuperbeerus: "Dragon Ball Super",
  nanatsunotaizai: "The Seven Deadly Sins", nantsunotaizai: "The Seven Deadly Sins",
  nanatsunotaizai4fundonoshinpan: "The Seven Deadly Sins",
  theapothecarydiaries: "Les Carnets de l’apothicaire", supermanandlois: "Superman et Loïs", supermanetlois: "Superman et Loïs",
  kungfukiller: "Kung Fu Jungle", kunfukiller: "Kung Fu Jungle", lesamaritain: "Le Samaritain",
  avatarangthelastairbender: "Avatar : Le Dernier Maître de l’air",
  avataraangthelastairbender: "Avatar Aang The Last Airbender",
  avatarthelastairbender: "Avatar : Le Dernier Maître de l’air",
  thefaultinourstars: "Nos étoiles contraires", theflash: "Flash", thenun: "La Nonne",
  shreek1: "Shrek", shreek2: "Shrek 2", shreeek3: "Shrek le troisième", shreeek4: "Shrek 4 : Il était une fin",
  ipman1: "Ip Man", johnwick3: "John Wick : Parabellum", johnwickchapter2: "John Wick 2", johnwickchapter4: "John Wick : Chapitre 4",
  sonicthehedgehog3: "Sonic 3, le film", sonic3: "Sonic 3, le film",
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
  if (/^(?:synopsis\s*[^\p{L}\p{N}]*|[ée]pisodes?\s+\d+(?:\s*(?:et|à|,|-)?\s*\d+)*)$/iu.test(text)) return null;
  const label = text.replace(/^[^\p{L}\p{N}#]+/u, "");
  if (/^(?:(?:langue|taille|qualit[ée]|synopsis|code promo|disponible sur|rappel)\s*:|(?:bon|excellent) visionnage|tout(?:e?s)? nos (?:cha[iî]nes|canaux)|version convertie|cliqu(?:er|ez) sur le lien|accès à différents canaux|découvrez une sélection|l.accès est|ma cha[iî]ne youtube|veuillez|pour (?:faire appara[iî]tre|tout problème)|en cas de problème|mais comme|#film\s*\||(?:19|20)\d{2}\s*[‧·])/i.test(label)) return null;
  if (/(?:ajoute.*(?:dossier|canal)|abonnez|abonne[ -]+(?:toi|vous)|rejoignez|liens dans le canal|dossier complet)/i.test(text)) return null;
  if (!text || /^\d+$/.test(text) || /^(?:index-v\d+-a\d+(?:\.(?:mkv|mp4))?|sticker(?:[ .]webp)?)$/i.test(text) || /https?:\/\//i.test(text)) return null;
  if (/^la saison \d+ arrive bient[oô]t/iu.test(label)) return null;
  const seasonEpisode = text.match(/\bS(?:aison)?\s*(\d+)\s*[|._ -]*(?:[ÉE]P?(?:ISODE)?)\s*(\d+)/i);
  const season = seasonEpisode?.[1] ?? text.match(/\bS(?:aison)?\s*(\d+)/i)?.[1];
  const episode = seasonEpisode?.[2] ?? text.match(/\b[ÉE]P?(?:ISODE)?\s*[-:]?\s*(\d+)/i)?.[1];
  const episodeTail = text.match(/\b(?:S(?:aison)?\s*\d+\s*[|._ -]*)?[ÉE]P?(?:ISODES?)?\s*[-:]?\s*\d+([\s\S]*)/i)?.[1];
  const multipleEpisodes = [...text.matchAll(/\bS\d+\s*[|._ -]*E\d+/gi)].length > 1 || episodeTail !== undefined && /^\s*(?:\d+\s*)*(?:et|à|,|-)\s*\d+/i.test(episodeTail);
  const year = text.match(/\b((?:19|20)\d{2})\b/)?.[1];
  const isFilm = /^\s*film\b/i.test(text);
  text = text.replace(/\.(?:mp4|mkv|avi|mov|mpg|mpeg|webm|m4v|ts)$/i, "")
    .replace(/\[[^\]]*\]/g, " ").replace(/@[\p{L}\p{N}_]+@/gu, " ").replace(/@[\p{L}\p{N}_]+/gu, " ")
    .replace(/(?:Oxtorrent[ ._]Com|Torrent911[ ._]com)/gi, " ")
    .replace(/[._|]/g, " ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/(\d+)(?:ème|eme)/gi, "$1e")
    .replace(/^\s*F\s+(?=John Wick)/i, "")
    .replace(/^\s*film\s*\d+\s*:\s*/i, "")
    .replace(/^[^\p{L}\p{N}]*ACTION[ -]+ZONE[^\p{L}\p{N}]*/iu, "")
    .replace(/^\s*(?:voir|film)\s+/i, "")
    .replace(/^la saison \d+ compl[eè]te de /i, "")
    .replace(/\b(?:S(?:aison)?\s*\d+\s*[- ]*(?:[ÉE]P?(?:ISODE)?)\s*\d+|S(?:aison)?\s*\d+)\b.*$/i, "")
    .replace(/\b[ÉE]P?(?:ISODE)?\s*[-:]?\s*\d+(?:\s*(?:et|à|,|-)\s*\d+)*\s*/gi, " ")
    .replace(/\b(?:19|20)\d{2}\b/g, " ")
    .replace(/\b(?:film\s+complet|vfq?|vostfr|french|truefrench|multi|hdcam|hdtv|web[ -]?rip|web[ -]?dl|webrip|h26[45]|x26[45]|\d{3,4}p|galaxy)\b.*$/i, "")
    .replace(/\s+(?:saison finale?|le final de la saison).*$/i, "")
    .replace(/\bfilm\s*$/i, "")
    .replace(/\bFR\s*$/i, "")
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "").replace(/\s+/g, " ").trim();
  if (!text || text.length > 180 || text.split(/\s+/).length > 16 || /^\d+$/.test(text)) return null;
  const key = normalizeTitle(text);
  text = key === "thepunisher" && (season || episode) ? "Marvel’s The Punisher" : aliases[key] ?? text;
  const known = requestedTitles.filter((t) => [t.title.replace(/\s*\(\d{4}\)$/, ""), ...(t.aliases ?? [])].some((name) => normalizeTitle(name) === normalizeTitle(text)));
  let kind: Kind | undefined = season || episode ? "serie" : isFilm ? "film" : undefined;
  let inferredYear = year ? Number(year) : undefined;
  if (known.length === 1 && (!kind || known[0].kind === kind)) {
    text = known[0].title.replace(/\s*\(\d{4}\)$/, "");
    kind ??= known[0].kind;
    inferredYear ??= known[0].year ?? (Number(known[0].title.match(/\((\d{4})\)$/)?.[1]) || undefined);
  }
  return { query: text, ...(kind ? { kind } : {}), ...(inferredYear ? { year: inferredYear } : {}), ...(season ? { season: Number(season) } : {}), ...(episode && !multipleEpisodes && Number(episode) > 0 ? { episode: Number(episode) } : {}) };
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
const reference = (item: Item, kind: Kind): Reference => ({ kind, id: item.id, verifiedNames: [...new Set([item.title, item.name, item.original_title, item.original_name].filter((name): name is string => Boolean(name)))], expectedTitle: (item.original_title ?? item.original_name ?? item.title ?? item.name)!, ...(itemYear(item, kind) ? { year: itemYear(item, kind) } : {}) });

type Decision = { title?: Reference; reason?: string; candidates?: Pending["candidates"] };
export function createResolver() {
  const memo = new Map<string, Promise<Decision>>();
  const episodes = new Map<string, Promise<boolean>>();
  async function resolveUncached(candidate: Candidate): Promise<Decision> {
    const known = requestedTitles.filter((t) => t.id !== undefined && (!candidate.kind || t.kind === candidate.kind) &&
      [t.title, ...(t.aliases ?? [])].some((name) => normalizeTitle(name) === normalizeTitle(candidate.query)) && (!candidate.year || t.year === candidate.year));
    if (known.length === 1) {
      const detail = await tmdbRequest<Item>(`/${known[0].kind === "film" ? "movie" : "tv"}/${known[0].id}`);
      if (detail && detail.id === known[0].id && matchesCandidate(detail, known[0].kind, candidate)) {
        const requiredCast = known[0].cast ?? [];
        const credits = requiredCast.length ? await tmdbRequest<{ cast: { name: string }[] }>(`/movie/${detail.id}/credits`) : null;
        if (!requiredCast.length || requiredCast.every((name) => credits?.cast?.some((actor) => normalizeTitle(actor.name) === normalizeTitle(name)))) return { title: reference(detail, known[0].kind) };
        return { reason: "casting-incoherent" };
      }
      // Un ancien ID ne peut pas être utilisé s’il ne valide plus le titre et l’année.
    }
    // Un casting confirmé par le propriétaire réduit les homonymes sans les classer
    // par popularité. La filmographie et le casting du film sont tous deux contrôlés.
    const context = requestedTitles.find((t) => (!candidate.kind || candidate.kind === t.kind) &&
      normalizeTitle(t.title.replace(/\s*\(\d{4}\)$/, "")) === normalizeTitle(candidate.query));
    const cast = context?.cast ?? [];
    if (cast.length && context?.id === undefined && candidate.kind !== "serie") {
      let pool: Item[] | undefined;
      for (const name of cast) {
        const people = await tmdbRequest<{ results: { id: number; name: string }[]; total_pages: number }>("/search/person", { query: name, language: "en-US" });
        const exact = people?.results?.filter((p) => typeof p.name === "string" && Number.isSafeInteger(p.id) && normalizeTitle(p.name) === normalizeTitle(name)) ?? [];
        if (people?.total_pages !== 1 || exact.length !== 1) return { reason: "acteur-ambigu" };
        const credits = await tmdbRequest<{ cast: Item[] }>(`/person/${exact[0].id}/movie_credits`, { language: "en-US" });
        if (!credits || !Array.isArray(credits.cast)) throw new TmdbUnavailable("Filmographie TMDB invalide");
        pool = pool ? pool.filter((item) => credits.cast.some((credit) => credit.id === item.id)) : credits.cast;
      }
      const matches = [...new Map((pool ?? []).filter((item) => matchesCandidate(item, "film", candidate)).map((item) => [item.id, item])).values()];
      if (matches.length !== 1) return { reason: matches.length ? "ambigu" : "casting-sans-correspondance" };
      const detail = await tmdbRequest<Item>(`/movie/${matches[0].id}`, { language: "en-US" });
      const credits = await tmdbRequest<{ cast: { name: string }[] }>(`/movie/${matches[0].id}/credits`);
      if (!detail || detail.id !== matches[0].id || !matchesCandidate(detail, "film", candidate) ||
        !cast.every((name) => credits?.cast?.some((actor) => normalizeTitle(actor.name) === normalizeTitle(name)))) return { reason: "casting-incoherent" };
      return { title: reference(detail, "film") };
    }
    const endpoint = candidate.kind === "film" ? "/search/movie" : candidate.kind === "serie" ? "/search/tv" : "/search/multi";
    for (const language of ["fr-FR", "en-US"]) {
      const items: Item[] = [];
      let pages = 1;
      for (let page = 1; page <= Math.min(pages, 3); page++) {
        const data = await tmdbRequest<{ results: Item[]; total_pages: number }>(endpoint, { query: candidate.query, language, page: String(page), include_adult: "false",
          ...(candidate.year && candidate.kind === "film" ? { primary_release_year: String(candidate.year) } : {}),
          ...(candidate.year && candidate.kind === "serie" ? { first_air_date_year: String(candidate.year) } : {}),
        });
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
      if (matches.size === 0 && language === "fr-FR") continue;
      if (matches.size !== 1) return { reason: matches.size ? "ambigu" : "introuvable", candidates: [...matches.values()].map(({ item, kind }) => ({ kind, id: item.id, title: (item.title ?? item.name)!, year: itemYear(item, kind) })) };
      const { item, kind } = [...matches.values()][0];
      // Vérifier le détail : l’ID, le type, le titre et l’année doivent encore correspondre.
      const detail = await tmdbRequest<Item>(`/${kind === "film" ? "movie" : "tv"}/${item.id}`, { language });
      if (!detail || detail.id !== item.id || !matchesCandidate(detail, kind, candidate)) return { reason: "fiche-incoherente" };
      return { title: reference(detail, kind) };
    }
    return { reason: "introuvable" };
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
  input: { text?: string; fileName?: string; links?: string[]; channelId?: string; messageId?: number },
  resolve = createResolver(),
): Promise<Resolution> {
  const result: Resolution = { titles: [], pending: [], review: [], ignored: [] };
  const captionLines = (input.text ?? "").split(/\r?\n/).flatMap((line) => !/https?:\/\//i.test(line) && line.includes(" / ") ? line.split(" / ") : [line]);
  const metadataYears = [...new Set(captionLines.flatMap((line) => { const match = line.trim().match(/^((?:19|20)\d{2})\s*[‧·]/); return match ? [Number(match[1])] : []; }))];
  const texts = [...new Set([input.fileName ?? "", ...captionLines, ...(input.links ?? [])].map((s) => s.trim()).filter(Boolean))];
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
    const titleHint = verifiedTitleSources.find((source) => source.channelId === input.channelId && source.messageId === input.messageId && source.text === input.text && source.fileName === (input.fileName ?? null));
    const allLines = texts.map((line) => ({ line, candidate: parseCandidate(line) }));
    result.ignored.push(...allLines.filter((item) => !item.candidate).map((item) => item.line));
    const usefulLines = allLines.filter((item) => item.candidate);
    const parsedLines = usefulLines.slice(0, 8);
    for (const { line, candidate } of parsedLines) {
      if (!candidate) { result.ignored.push(line); continue; }
      const related = parsedLines.flatMap((item) => item.candidate && normalizeTitle(item.candidate.query) === normalizeTitle(candidate.query) ? [item.candidate] : []);
      const years = [...new Set(related.flatMap((c) => c.year === undefined ? [] : [c.year]))];
      const kinds = [...new Set(related.flatMap((c) => c.kind === undefined ? [] : [c.kind]))];
      const yearHint = years.length === 1 ? years[0] : metadataYears.length === 1 && candidate.kind !== "serie" && candidate.season === undefined ? metadataYears[0] : undefined;
      const enriched = { ...candidate, ...(candidate.year === undefined && yearHint !== undefined ? { year: yearHint } : {}), ...(candidate.kind === undefined && kinds.length === 1 ? { kind: kinds[0] } : {}), ...(titleHint ? { kind: titleHint.kind, year: titleHint.year } : {}) };
      const decision = await resolve(enriched);
      if (decision.title) result.titles.push(decision.title);
      if (!decision.title || decision.reason) result.review.push({ input: line, reason: decision.reason ?? "non-resolu", ...(decision.candidates ? { candidates: decision.candidates } : {}) });
    }
    for (const { line } of usefulLines.slice(8)) result.review.push({ input: line, reason: "trop-de-lignes-a-traiter" });
    // Une traduction et son titre original peuvent désigner la même fiche vérifiée.
    // Retirer seulement l’ambiguïté dont le titre figure effectivement dans cette fiche.
    const resolved = new Map(result.titles.map((ref) => [`${ref.kind}:${ref.id}`, ref]));
    if (resolved.size === 1) {
      const ref = [...resolved.values()][0];
      result.review = result.review.filter((issue) => {
        if (issue.reason !== "ambigu" || !issue.candidates?.some((item) => item.id === ref.id && item.kind === ref.kind)) return true;
        const query = parseCandidate(issue.input)?.query;
        return !query || !ref.verifiedNames?.some((name) => normalizeTitle(name) === normalizeTitle(query));
      });
    }
    // Une légende et un nom de fichier qui identifient deux œuvres ne sont pas fusionnés au hasard.
    const unique = new Set(result.titles.map((t) => `${t.kind}:${t.id}`));
    const seasons = new Set(result.titles.flatMap((t) => t.season === undefined ? [] : [t.season]));
    const episodes = new Set(result.titles.flatMap((t) => t.episode === undefined ? [] : [t.episode]));
    if (input.fileName && unique.size > 1) {
      result.review.push({ input: input.fileName, reason: "sources-contradictoires" });
      result.titles = [];
    } else if (input.fileName && (seasons.size > 1 || episodes.size > 1)) {
      const confirmed = verifiedEpisodeSources.some((source) => source.channelId === input.channelId && source.messageId === input.messageId && source.text === input.text && source.fileName === input.fileName);
      const caption = parseCandidate(input.text ?? "");
      const verifiedCaption = confirmed && caption?.season !== undefined && caption.episode !== undefined
        ? result.titles.filter((ref) => ref.season === caption.season && ref.episode === caption.episode)
        : [];
      if (verifiedCaption.length) result.titles = verifiedCaption;
      else {
      result.review.push({ input: input.fileName, reason: "episodes-contradictoires" });
      // Le titre est confirmé des deux côtés, mais aucun numéro n’est certifié.
      result.titles = result.titles.map(({ kind, id, expectedTitle, year }) => ({ kind, id, expectedTitle, year }));
      }
    }
  }
  const ownerRecord = ownerVerifiedEpisodes.find((source) => source.channelId === input.channelId && source.messageId === input.messageId && source.text === input.text && source.fileName === input.fileName);
  const sourceNumber = ownerRecord ? parseCandidate(ownerRecord.fileName) : null;
  if (ownerRecord && sourceNumber?.season !== undefined && sourceNumber.episode !== undefined &&
    result.titles.length && result.titles.every((ref) => ref.kind === ownerRecord.kind && ref.id === ownerRecord.id)) {
    result.titles = result.titles.map((ref) => ref.season !== undefined && ref.episode !== undefined ? ref : {
      ...ref, sourceEpisode: { season: sourceNumber.season!, episode: sourceNumber.episode!, verifiedBy: "owner" },
    });
    result.review = result.review.filter((issue) => issue.reason !== "episode-non-verifie");
  }
  if (input.fileName && /\.(?:mp4|mkv|avi|mov|mpg|mpeg|webm|m4v)$/i.test(input.fileName) && !result.titles.length && !result.review.length) {
    result.review.push({ input: input.fileName, reason: "fichier-sans-titre-identifiable" });
  }
  result.titles = [...new Map(result.titles.map((t) => [`${t.kind}:${t.id}:${t.season ?? ""}:${t.episode ?? ""}`, t])).values()];
  result.pending = [...new Set(result.review.map((item) => item.input))];
  return result;
}
