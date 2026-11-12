import { cacheLife, cacheTag } from "next/cache";
import type { Kind, Title } from "@/data/catalogue";
import { selection } from "@/data/selection";

import { hasCatalogueStorage, readChannelState } from "@/lib/telegram-store";

const API = "https://api.themoviedb.org/3";
const IMAGE_BASE = "https://image.tmdb.org/t/p/w342";

type TmdbItem = {
  id: number;
  title?: string;
  name?: string;
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

async function fetchTitle(kind: Kind, id: number): Promise<Title | null> {
  const path = kind === "film" ? "movie" : "tv";
  let item = await tmdb<TmdbItem>(`/${path}/${id}`);

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

  const channelPosts = hasCatalogueStorage()
    ? Object.values((await readChannelState()).posts)
    : [];
  const references = [...selection, ...channelPosts.flatMap((post) => post.titles)];
  const unique = [...new Map(references.map((ref) => [`${ref.kind}:${ref.id}`, ref])).values()];

  const results = await Promise.allSettled(
    unique.map(({ kind, id }) => fetchTitle(kind, id)),
  );

  const titles: Title[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      if (result.value) titles.push(result.value);
    } else if (!(result.reason instanceof TmdbError && result.reason.status === 404)) {
      // Une erreur autre qu'un identifiant inconnu : on ne met pas un catalogue incomplet en cache.
      throw result.reason;
    }
  }
  return titles;
}

/** Résolution prudente : titre exact unique, sinon conserver la ligne à identifier. */
export async function resolveTelegramTitle(line: string): Promise<{ kind: Kind; id: number } | null> {
  const query = line.replace(/^\s*[-•#🎥]+\s*/u, "").replace(/\\$/, "").trim();
  if (!query || query.length > 180 || /https?:\/\//i.test(query)) return null;
  const token = process.env.TMDB_READ_TOKEN;
  if (!token) return null;
  const url = new URL(`${API}/search/multi`);
  url.searchParams.set("query", query);
  url.searchParams.set("language", "fr-FR");
  url.searchParams.set("include_adult", "false");
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error("Recherche TMDB indisponible");
  const data = await response.json() as { results: (TmdbItem & { media_type: string; original_title?: string; original_name?: string })[]; total_pages: number };
  const normalize = (value: string) => value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  const matches = data.results.filter((item) =>
    ["movie", "tv"].includes(item.media_type) &&
    [item.title, item.name, item.original_title, item.original_name].some((name) => name && normalize(name) === normalize(query)),
  );
  if (data.total_pages > 1 || matches.length !== 1) return null;
  return { kind: matches[0].media_type === "movie" ? "film" : "serie", id: matches[0].id };
}
