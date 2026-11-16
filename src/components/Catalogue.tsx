"use client";

import { useMemo, useState, useRef } from "react";
import { sortCatalogue } from "@/lib/catalogue-links";
import { CinemaCarousel } from "./CinemaCarousel";
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
        width={400}
        height={600}
        loading="lazy"
        referrerPolicy="no-referrer"
        className="poster-image"
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
  const search = useRef<HTMLInputElement>(null);
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

  return <>
    <section className="cinema-hero" aria-labelledby="decouverte-titre">
      <div className="hero-copy">
        <p className="eyebrow" translate="no">Discover. Watch. Enjoy.</p>
        <h1 id="decouverte-titre">Votre prochaine<br /><em>découverte.</em></h1>
        <p className="hero-description">Des films qui marquent. Des séries qu’on dévore. Explorez le catalogue et retrouvez vos prochaines découvertes sur Telegram.</p>
        <div className="hero-actions"><a href="#catalogue" className="button-primary">Explorer le catalogue <span aria-hidden="true">↓</span></a><a href="https://t.me/TheBrowser365" target="_blank" rel="noopener noreferrer" className="button-secondary">Le canal Telegram <span aria-hidden="true">↗</span><span className="sr-only"> — nouvel onglet</span></a></div>
        <p className="hero-note"><span aria-hidden="true" />Catalogue public · Films et séries</p>
      </div>
      <CinemaCarousel items={items} />
    </section>
    <section id="catalogue" aria-labelledby="catalogue-titre" className="catalogue-section">
      <div className="catalogue-heading"><h2 id="catalogue-titre">Le catalogue<span className="text-[var(--amber)]">.</span></h2><p>Films, séries &amp; belles découvertes</p></div>
      <div className="catalogue-controls">
        <div className="search-control" role="search">
          <label htmlFor="recherche" className="sr-only">Rechercher un film ou une série</label>
          <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg>
          <input ref={search} id="recherche" name="q" type="search" autoComplete="off" spellCheck={false} value={query} onChange={e => setQuery(e.target.value)} placeholder="Un titre, un genre, une année…" />
          {query && <button type="button" className="search-clear" aria-label="Effacer la recherche" onClick={() => { setQuery(""); search.current?.focus(); }}>×</button>}
        </div>
        <div role="group" aria-label="Type de contenu" className="kind-filters">
          {(Object.keys(KIND_LABELS) as KindFilter[]).map(k => <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)}>{KIND_LABELS[k]}</button>)}
        </div>
        <div><label htmlFor="genre" className="sr-only">Genre</label><select id="genre" name="genre" value={genre} onChange={e => setGenre(e.target.value)} className="genre-select"><option value="">Tous les genres</option>{genres.map(g => <option key={g} value={g}>{g}</option>)}</select></div>
      </div>
      <p className="catalogue-count" role="status" aria-live="polite"><strong>{new Intl.NumberFormat("fr-FR").format(visible.length)}</strong> résultat{visible.length > 1 ? "s" : ""}<span aria-hidden="true">·</span>Ordre alphabétique</p>
      {visible.length === 0 ? (
        <div className="empty-catalogue"><h3>Aucune découverte pour le moment</h3><p>Aucun titre ne correspond à votre recherche. Essayez un autre titre ou un autre genre.</p><button type="button" onClick={() => { setQuery(""); setKind("tous"); setGenre(""); search.current?.focus(); }}>Réinitialiser les filtres</button></div>
      ) : (
        <ul className="catalogue-grid">
          {visible.map((item) => (
            <li key={item.id} className="catalogue-entry">
              <a
                href={item.telegramUrl ?? item.watchUrl}
                aria-label={item.telegramUrl ? `Ouvrir ${item.title} dans le canal Telegram` : `Consulter les offres légales pour ${item.title}`}
                target="_blank"
                rel="noopener noreferrer"
                className="title-card group"
              >
                <div className="poster-frame">
                  <Poster item={item} />
                  <span className="poster-badge">{item.kind === "film" ? "Film" : "Série"}</span><span className="poster-arrow" aria-hidden="true">↗</span>
                </div>
                <div className="title-info">
                  <h3>
                    {item.title}
                  </h3>
                  <p className="title-metadata">
                    {item.kind === "film" ? "Film" : "Série"}
                    {item.year ? ` · ${item.year}` : ""}
                    {item.genres.length > 0 ? ` · ${item.genres.slice(0, 3).join(", ")}` : ""}
                  </p>
                  {item.episodes && item.episodes.length > 0 && (
                    <p className="provenance-note">
                      {item.episodes.length} épisode{item.episodes.length > 1 ? "s" : ""} référencé{item.episodes.length > 1 ? "s" : ""} par TMDB
                    </p>
                  )}
                  {item.sourceEpisodes && item.sourceEpisodes.length > 0 && (
                    <p className="provenance-note">
                      {item.sourceEpisodes.length} épisode{item.sourceEpisodes.length > 1 ? "s" : ""} vérifié{item.sourceEpisodes.length > 1 ? "s" : ""} dans le canal
                    </p>
                  )}
                  <p className="title-synopsis line-clamp-2">
                    {item.synopsis}
                  </p>
                  <span className="title-action">
                    {item.telegramUrl ? "Voir dans le canal" : "Offres légales"}
                    <span className="sr-only"> (s&apos;ouvre dans un nouvel onglet)</span>
                    <span aria-hidden="true">↗</span>
                  </span>
                </div>
              </a>
              {item.kind === "serie" && item.telegramPublications && item.telegramPublications.length > 0 && (
                <details className="episode-picker">
                  <summary>{item.telegramPublications.some((publication) => publication.episode !== undefined) ? "Choisir un épisode" : "Voir les publications"}</summary>
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
                <a href={item.watchUrl} target="_blank" rel="noopener noreferrer" className="legal-offers">
                  Offres légales en France
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  </>;
}
