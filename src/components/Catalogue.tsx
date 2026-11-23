"use client";

import { useMemo, useRef, useCallback, useEffect, useDeferredValue } from "react";
import { useSearchParams } from "next/navigation";
import { catalogueState, catalogueHref, browseCatalogue } from "@/lib/catalogue-browsing";
import { useWatchlist } from "@/lib/watchlist";
import dynamic from "next/dynamic";
const TitleDialog = dynamic(() => import("./TitleDialog").then(module => module.TitleDialog), {loading: () => <p role="status" className="catalogue-notice">Ouverture de la fiche…</p>});
import { CinemaCarousel } from "./CinemaCarousel";
import type { Kind, Title } from "@/data/catalogue";

type KindFilter = "tous" | Kind;

const KIND_LABELS: Record<KindFilter, string> = {
  tous: "Tout",
  film: "Films",
  serie: "Séries",
};

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
        decoding="async"
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
  const params = useSearchParams();
  const queryString = params.toString();
  const state = useMemo(() => catalogueState(new URLSearchParams(queryString)), [queryString]);
  const { q: query, kind, genre, year, view } = state;
  const { saved, toggle, error } = useWatchlist();
  const selected = items.find(item => item.id === state.title) ?? null;
  const update = useCallback((changes: Record<string, string | null>, push = false) => {
    const url = catalogueHref(new URLSearchParams(window.location.search), changes);
    if (push) window.history.pushState({}, "", url); else window.history.replaceState({}, "", url);
  }, []);
  const openTitle = useCallback((id: string) => {
    window.history.pushState({ tbFiche: true }, "", catalogueHref(new URLSearchParams(window.location.search), { fiche: id, focus: null }));
  }, []);
  const closeTitle = useCallback(() => {
    if (window.history.state?.tbFiche) window.history.back();
    else update({ fiche: null });
  }, [update]);
  const focusSearch = params.get("focus") === "recherche";
  useEffect(() => {
    if (focusSearch) { search.current?.focus(); update({ focus: null }); }
  }, [focusSearch, update]);
  const years = useMemo(() => [...new Set(items.flatMap(item => item.year ? [item.year] : []))].sort((a,b) => b-a), [items]);
  const reset = () => { update({ q: null, type: null, genre: null, annee: null, vue: null }, true); search.current?.focus(); };
  const genres = useMemo(
    () =>
      [...new Set(items.flatMap((i) => i.genres))].sort((a, b) =>
        a.localeCompare(b, "fr"),
      ),
    [items],
  );

  const deferredQuery = useDeferredValue(query);
  const filterState = useMemo(() => ({q: deferredQuery, kind, genre, year, view, title: null}), [deferredQuery, kind, genre, year, view]);
  const visible = useMemo(() => browseCatalogue(items, filterState, saved), [items, filterState, saved]);

  return <>
    <section className="cinema-hero" aria-labelledby="decouverte-titre">
      <div className="hero-copy">
        <p className="eyebrow" translate="no">Discover. Watch. Enjoy.</p>
        <h1 id="decouverte-titre">Votre prochaine<br /><em>découverte.</em></h1>
        <p className="hero-description">Des films qui marquent. Des séries qu’on dévore. Explorez le catalogue et retrouvez vos prochaines découvertes sur Telegram.</p>
        <div className="hero-actions"><a href="#catalogue" className="button-primary">Explorer le catalogue <span aria-hidden="true">↓</span></a><a href="https://t.me/TheBrowser365" target="_blank" rel="noopener noreferrer" className="button-secondary">Le canal Telegram <span aria-hidden="true">↗</span><span className="sr-only"> — nouvel onglet</span></a></div>
        <p className="hero-note"><span aria-hidden="true" />Catalogue public · Films et séries</p>
      </div>
      <CinemaCarousel items={items} suspended={!!selected} onOpenTitle={openTitle} catalogueQuery={params.toString()} />
    </section>
    <section id="catalogue" aria-busy={query !== deferredQuery} aria-labelledby="catalogue-titre" className="catalogue-section">
      <div className="catalogue-heading"><h2 id="catalogue-titre" tabIndex={-1}>Le catalogue<span className="text-[var(--amber)]">.</span></h2><p>Films, séries &amp; belles découvertes</p></div>
      <nav className="catalogue-views" aria-label="Collections du catalogue">
        {([['catalogue','Tout le catalogue'],['recent','Ajouts récents'],['a-voir','À voir']] as const).map(([key,label]) => <button key={key} type="button" data-catalogue-view={key} aria-pressed={view === key} onClick={() => update({ vue: key === 'catalogue' ? null : key }, true)}>{label}{key === 'a-voir' && <span>{items.filter(item => saved.has(item.id)).length}</span>}</button>)}
      </nav>
      {view === "recent" && <p className="collection-note">Les dernières publications du canal, quelle que soit l’année de sortie du titre.</p>}
      {view === "a-voir" && <p className="collection-note">Vos découvertes à garder pour plus tard. Enregistrées dans ce navigateur, sur cet appareil.</p>}
      {state.title && !selected && <p className="catalogue-notice" role="status">Ce titre n’est plus disponible dans le catalogue. <button type="button" onClick={closeTitle}>Fermer la fiche</button></p>}
      <div className="catalogue-controls">
        <div className="search-control" role="search">
          <label htmlFor="recherche" className="sr-only">Rechercher un film ou une série</label>
          <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg>
          <input ref={search} id="recherche" name="q" type="search" autoComplete="off" spellCheck={false} value={query} maxLength={200} onChange={e => update({ q: e.target.value || null })} placeholder="Un titre, un genre, une année…" />
          {query && <button type="button" className="search-clear" aria-label="Effacer la recherche" onClick={() => { update({ q: null }); search.current?.focus(); }}>×</button>}
        </div>
        <div role="group" aria-label="Type de contenu" className="kind-filters">
          {(Object.keys(KIND_LABELS) as KindFilter[]).map(k => <button key={k} type="button" aria-pressed={kind === k} onClick={() => update({ type: k === "tous" ? null : k }, true)}>{KIND_LABELS[k]}</button>)}
        </div>
        <div><label htmlFor="genre" className="sr-only">Genre</label><select id="genre" name="genre" value={genre} onChange={e => update({ genre: e.target.value || null }, true)} className="genre-select"><option value="">Tous les genres</option>{genre && !genres.includes(genre) && <option value={genre}>{genre}</option>}{genres.map(g => <option key={g} value={g}>{g}</option>)}</select></div>
        <div><label htmlFor="annee" className="sr-only">Année de sortie</label><select id="annee" name="annee" className="genre-select" value={year} onChange={e => update({ annee: e.target.value || null }, true)}><option value="">Toutes les années</option>{year && !years.includes(Number(year)) && <option value={year}>{year}</option>}{years.map(y => <option key={y} value={y}>{y}</option>)}</select></div>
      </div>
      <p className="catalogue-count" role="status" aria-live="polite"><strong>{new Intl.NumberFormat("fr-FR").format(visible.length)}</strong> résultat{visible.length > 1 ? "s" : ""}<span aria-hidden="true">·</span>{view === "recent" ? "Dernières publications" : "Ordre alphabétique"}</p>
      {visible.length === 0 ? (
        <div className="empty-catalogue"><h3>{view === "a-voir" ? "Votre liste attend ses premières découvertes" : "Aucune découverte pour le moment"}</h3><p>{view === "a-voir" ? "Ajoutez un titre avec le cœur sur son affiche, ou élargissez vos filtres." : "Aucun titre ne correspond à votre recherche. Essayez un autre titre ou un autre genre."}</p><button type="button" onClick={reset}>Réinitialiser les filtres</button></div>
      ) : (
        <ul className="catalogue-grid">
          {visible.map((item) => (
            <li key={item.id} className="catalogue-entry">
              <a
                href={catalogueHref(new URLSearchParams(params.toString()), { fiche: item.id, focus: null })}
                aria-label={`Voir la fiche de ${item.title}`}
                onClick={event => { if (event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) { event.preventDefault(); openTitle(item.id); } }}
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
                    Découvrir le titre
                    <span aria-hidden="true">↗</span>
                  </span>
                </div>
              </a>
              <button type="button" className="save-title" aria-pressed={saved.has(item.id)} aria-label={`${saved.has(item.id) ? 'Retirer' : 'Ajouter'} ${item.title} ${saved.has(item.id) ? 'de' : 'à'} la liste À voir`} onClick={() => toggle(item.id)}>{saved.has(item.id) ? '♥' : '♡'}</button>
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
    {error && !selected && <p className="watchlist-error" role="status">{error}</p>}
    {selected && <TitleDialog error={error} item={selected} saved={selected ? saved.has(selected.id) : false} onToggle={() => { if (selected) toggle(selected.id); }} onClose={closeTitle} />}
  </>;
}
