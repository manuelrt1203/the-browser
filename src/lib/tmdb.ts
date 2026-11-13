import { publicationsForTitle, sortCatalogue } from "./catalogue-links.ts";
import { cacheLife, cacheTag } from "next/cache";
import type { Kind, Title } from "@/data/catalogue";
import { requestedTitles, revokedLegacyReferences } from "@/data/selection";
import { normalizeTitle } from "./telegram-resolution.ts";
import type { Reference } from "./telegram-resolution.ts";

import { hasCatalogueStorage, readChannelState } from "@/lib/telegram-store";

const API = "https://api.themoviedb.org/3";
const IMAGE_BASE = "https://image.tmdb.org/t/p/w342";

type TmdbItem = {
  id: number;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  release_date?: string;
  first_air_date?: string;
  overview?: string;
  poster_path?: string | null;
  genres?: { id: number; name: string }[];
};

class TmdbError extends Error {
  constructor(
    readonly status: number,
    path: string,
  ) {
    super(`TMDB a répondu ${status} pour ${path}`);
  }
}

export function hasTmdbToken(): boolean {
  return Boolean(process.env.TMDB_READ_TOKEN);
}

async function tmdb<T>(path: string, language = "fr-FR"): Promise<T> {
  const token = process.env.TMDB_READ_TOKEN;
  if (!token) throw new Error("TMDB_READ_TOKEN manquant");

  const url = new URL(`${API}${path}`);
  url.searchParams.set("language", language);

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new TmdbError(response.status, path);
  return (await response.json()) as T;
}

function toTitle(item: TmdbItem, kind: Kind): Title | null {
  const name = (kind === "film" ? item.title : item.name)?.trim();
  if (!name) return null;

  const date = kind === "film" ? item.release_date : item.first_air_date;
  const year = date && /^\d{4}/.test(date) ? Number(date.slice(0, 4)) : null;
  const path = kind === "film" ? "movie" : "tv";

  return {
    id: `${kind}-${item.id}`,
    title: name,
    kind,
    year,
    genres: (item.genres ?? []).map((g) => g.name),
    synopsis: item.overview?.trim() || "Pas de synopsis disponible.",
    poster: item.poster_path ? `${IMAGE_BASE}${item.poster_path}` : undefined,
    watchUrl: `https://www.themoviedb.org/${path}/${item.id}/watch?locale=FR`,
  };
}

async function fetchTitle(ref: Reference): Promise<Title | null> {
  const { kind, id } = ref;
  const path = kind === "film" ? "movie" : "tv";
  let item = await tmdb<TmdbItem>(`/${path}/${id}`);

  if (item.id !== id) return null;
  const expected = requestedTitles.find((t) => t.kind === kind && t.id === id);
  const names = [ref.expectedTitle, expected?.title, ...(expected?.aliases ?? [])].filter((name): name is string => Boolean(name));
  const actual = [item.title, item.name, item.original_title, item.original_name].filter((name): name is string => Boolean(name));
  const date = kind === "film" ? item.release_date : item.first_air_date;
  const year = ref.year ?? expected?.year;
  if ((names.length && !names.some((name) => actual.some((value) => normalizeTitle(value) === normalizeTitle(name)))) ||
    (year && Number(date?.slice(0, 4)) !== year)) return null;

  // Synopsis absent en français : on prend la version anglaise plutôt que rien.
  if (!item.overview?.trim()) {
    const english = await tmdb<TmdbItem>(`/${path}/${id}`, "en-US");
    item = { ...item, overview: english.overview };
  }
  return toTitle(item, kind);
}

/** Les titres de `selection`, dans l'ordre, avec affiche et synopsis TMDB. */
export async function getCatalogue(): Promise<Title[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("catalogue");

  const storedPosts = hasCatalogueStorage() ? (await readChannelState()).posts : {};
  const channelPosts = Object.values(storedPosts);
  const selection: Reference[] = requestedTitles.flatMap(({ kind, id, year }) => id === undefined ? [] : [{ kind, id, year }]);
  // Les mauvais IDs restent parfois dans Redis après correction du code : exclure
  // ces anciennes associations jusqu’à la réanalyse, sans supprimer les messages.
  const references = [...selection, ...channelPosts.flatMap((post) => post.titles.filter((ref) =>
    (post.resolutionVersion ?? 0) >= 2 || !revokedLegacyReferences.has(`${ref.kind}:${ref.id}`),
  ))];
  const unique = [...new Map(references.map((ref) => [`${ref.kind}:${ref.id}`, ref])).values()];

  const results: PromiseSettledResult<Title | null>[] = new Array(unique.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(4, unique.length) }, async () => {
    while (next < unique.length) {
      const index = next++;
      try { results[index] = { status: "fulfilled", value: await fetchTitle(unique[index]) }; }
      catch (reason) { results[index] = { status: "rejected", reason }; }
    }
  }));

  const titles: Title[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      if (result.value) {
        const title = result.value;
        const episodes = channelPosts.flatMap((post) => post.titles)
          .filter((ref) => `${ref.kind}-${ref.id}` === title.id && ref.season !== undefined && ref.episode !== undefined)
          .map((ref) => ({ season: ref.season!, episode: ref.episode! }));
        if (episodes.length) title.episodes = [...new Map(episodes.map((item) => [`${item.season}:${item.episode}`, item])).values()]
          .sort((a, b) => a.season - b.season || a.episode - b.episode);
        const sourceEpisodes = channelPosts.flatMap((post) => post.titles)
          .filter((ref) => `${ref.kind}-${ref.id}` === title.id && ref.sourceEpisode?.verifiedBy === "owner")
          .map((ref) => ({ season: ref.sourceEpisode!.season, episode: ref.sourceEpisode!.episode }));
        if (sourceEpisodes.length) title.sourceEpisodes = [...new Map(sourceEpisodes.map((ep) => [`${ep.season}:${ep.episode}`, ep])).values()]
          .sort((a, b) => a.season - b.season || a.episode - b.episode);
        const publications = publicationsForTitle(title.id, storedPosts);
        if (publications.length) {
          title.telegramUrl = publications[0].url;
          title.telegramPublications = publications;
        }
        titles.push(title);
      }
    } else if (!(result.reason instanceof TmdbError && result.reason.status === 404)) {
      // Une erreur autre qu'un identifiant inconnu : on ne met pas un catalogue incomplet en cache.
      throw result.reason;
    }
  }
  return sortCatalogue(titles);
}
