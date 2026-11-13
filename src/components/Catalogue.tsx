"use client";

import { useMemo, useState } from "react";
import { sortCatalogue } from "@/lib/catalogue-links";
import type { Kind, Title } from "@/data/catalogue";

type KindFilter = "tous" | Kind;

const KIND_LABELS: Record<KindFilter, string> = {
  tous: "Tout",
  film: "Films",
  serie: "Séries",
};

/** Normalise pour une recherche insensible à la casse et aux accents. */
function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/** Teinte stable (0-359) dérivée du titre, pour les affiches générées. */
function hueFor(text: string): number {
  let hash = 0;
  for (const char of text) {
    hash = (hash * 31 + char.codePointAt(0)!) % 360;
  }
  return hash;
}

function Poster({ item }: { item: Title }) {
  if (item.poster) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={item.poster}
        alt=""
        loading="lazy"
        referrerPolicy="no-referrer"
        className="h-full w-full object-cover"
      />
    );
  }
  const hue = hueFor(item.title);
  return (
    <div
      aria-hidden="true"
      className="flex h-full w-full items-end p-4"
      style={{
        background: `linear-gradient(160deg, hsl(${hue} 70% 35%), hsl(${(hue + 60) % 360} 70% 12%))`,
      }}
    >
      <span className="text-balance text-xl font-bold leading-tight text-white/90">
        {item.title}
      </span>
    </div>
  );
}

export function Catalogue({ items }: { items: Title[] }) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<KindFilter>("tous");
  const [genre, setGenre] = useState<string>("");

  const genres = useMemo(
    () =>
      [...new Set(items.flatMap((i) => i.genres))].sort((a, b) =>
        a.localeCompare(b, "fr"),
      ),
    [items],
  );

  const visible = useMemo(() => {
    const q = normalize(query.trim());
    return sortCatalogue(items.filter((i) => {
      if (kind !== "tous" && i.kind !== kind) return false;
      if (genre && !i.genres.includes(genre)) return false;
      if (!q) return true;
      return normalize(`${i.title} ${i.genres.join(" ")} ${i.year ?? ""}`).includes(q);
    }));
  }, [items, query, kind, genre]);

  return (
    <section aria-labelledby="catalogue-titre">
      <h2 id="catalogue-titre" className="sr-only">
        Catalogue
      </h2>

      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex-1">
          <label htmlFor="recherche" className="sr-only">
            Rechercher un film ou une série
          </label>
          <input
            id="recherche"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un titre, un genre, une année…"
            className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-base text-white placeholder:text-white/50 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-400/50"
          />
        </div>

        <div role="group" aria-label="Type de contenu" className="flex gap-2">
          {(Object.keys(KIND_LABELS) as KindFilter[]).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={kind === k}
              onClick={() => setKind(k)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 ${
                kind === k
                  ? "bg-violet-500 text-white"
                  : "bg-white/10 text-white/80 hover:bg-white/20"
              }`}
            >
              {KIND_LABELS[k]}
            </button>
          ))}
        </div>

        <div>
          <label htmlFor="genre" className="sr-only">
            Genre
          </label>
          <select
            id="genre"
            value={genre}
            onChange={(e) => setGenre(e.target.value)}
            className="w-full rounded-xl border border-white/15 bg-neutral-900 px-3 py-3 text-sm text-white focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-400/50 sm:w-auto"
          >
            <option value="">Tous les genres</option>
            {genres.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="mb-4 text-sm text-white/60" role="status">
        {visible.length} résultat{visible.length > 1 ? "s" : ""} · Ordre alphabétique
      </p>

      {visible.length === 0 ? (
        <p className="rounded-xl border border-white/10 bg-white/5 p-8 text-center text-white/70">
          Aucun titre ne correspond à votre recherche.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {visible.map((item) => (
            <li key={item.id}>
              <a
                href={item.telegramUrl ?? item.watchUrl}
                aria-label={item.telegramUrl ? `Ouvrir ${item.title} dans le canal Telegram` : `Consulter les offres légales pour ${item.title}`}
                target="_blank"
                rel="noopener noreferrer"
                className="group block overflow-hidden rounded-2xl border border-white/10 bg-white/5 transition hover:-translate-y-1 hover:border-violet-400/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
              >
                <div className="aspect-[2/3] overflow-hidden">
                  <Poster item={item} />
                </div>
                <div className="p-3">
                  <h3 className="truncate font-semibold text-white">
                    {item.title}
                  </h3>
                  <p className="mt-0.5 text-xs text-white/60">
                    {item.kind === "film" ? "Film" : "Série"}
                    {item.year ? ` · ${item.year}` : ""}
                    {item.genres.length > 0 ? ` · ${item.genres.slice(0, 3).join(", ")}` : ""}
                  </p>
                  {item.episodes && item.episodes.length > 0 && (
                    <p className="mt-1 text-xs text-sky-300">
                      {item.episodes.length} épisode{item.episodes.length > 1 ? "s" : ""} référencé{item.episodes.length > 1 ? "s" : ""} par TMDB
                    </p>
                  )}
                  {item.sourceEpisodes && item.sourceEpisodes.length > 0 && (
                    <p className="mt-1 text-xs text-sky-300">
                      {item.sourceEpisodes.length} épisode{item.sourceEpisodes.length > 1 ? "s" : ""} vérifié{item.sourceEpisodes.length > 1 ? "s" : ""} dans le canal
                    </p>
                  )}
                  <p className="mt-2 line-clamp-2 text-xs text-white/70">
                    {item.synopsis}
                  </p>
                  <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-sky-300 group-hover:text-sky-200">
                    {item.telegramUrl ? "Voir dans le canal" : "Offres légales"}
                    <span className="sr-only"> (s&apos;ouvre dans un nouvel onglet)</span>
                    <span aria-hidden="true">↗</span>
                  </span>
                </div>
              </a>
              {item.kind === "serie" && item.telegramPublications && item.telegramPublications.length > 0 && (
                <details className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3">
                  <summary className="cursor-pointer text-sm font-medium text-sky-300">{item.telegramPublications.some((publication) => publication.episode !== undefined) ? "Choisir un épisode" : "Voir les publications"}</summary>
                  <ul className="mt-3 max-h-60 space-y-2 overflow-y-auto text-sm">
                    {item.telegramPublications.map((publication) => (
                      <li key={`${publication.url}:${publication.numbering ?? "post"}:${publication.season ?? ""}:${publication.episode ?? ""}`}>
                        <a href={publication.url} target="_blank" rel="noopener noreferrer" className="block rounded px-2 py-1 text-white/80 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-sky-300">
                          {publication.episode !== undefined
                            ? `Saison ${publication.season} · Épisode ${publication.episode}${publication.numbering === "channel" ? " · numérotation du canal" : ""}`
                            : `Publication nº ${publication.messageId}`}
                          <span className="sr-only"> — ouvrir dans Telegram</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
              {item.telegramUrl && (
                <a href={item.watchUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-xs text-white/60 underline hover:text-white">
                  Offres légales en France
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
