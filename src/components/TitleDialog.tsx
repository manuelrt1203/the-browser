"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Title } from "@/data/catalogue";

function DetailContent({ item, saved, onToggle, error }: { item: Title; saved: boolean; onToggle: () => void; error: string }) {
  const [season, setSeason] = useState("all"), [message, setMessage] = useState("");
  const groups = useMemo(() => {
    const map = new Map<string, { label: string; publications: NonNullable<Title["telegramPublications"]> }>();
    for (const p of item.telegramPublications ?? []) {
      const key = p.episode === undefined ? "posts" : `${p.numbering ?? "unknown"}:${p.season ?? "unknown"}`;
      if (!map.has(key)) map.set(key, { label: p.episode === undefined ? "Autres publications" : `${p.season === undefined ? "Épisodes" : `Saison ${p.season}`} · ${p.numbering === "channel" ? "numérotation du canal" : p.numbering === "tmdb" ? "références TMDB" : "numérotation indiquée"}`, publications: [] });
      map.get(key)!.publications.push(p);
    }
    return [...map.entries()];
  }, [item]);
  async function copy() {
    try { await navigator.clipboard.writeText(window.location.href); setMessage("Lien de la fiche copié."); }
    catch { setMessage("Copiez l’adresse affichée dans votre navigateur pour partager cette fiche."); }
  }
  return <>
    <div className="detail-layout">
      <div className="detail-poster">{item.poster ?
        // Le CDN TMDB fournit déjà une affiche redimensionnée.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.poster} width={400} height={600} alt={`Affiche de ${item.title}`} referrerPolicy="no-referrer" /> : <span aria-hidden="true">{item.title.slice(0,1)}</span>}
      </div>
      <div className="detail-description">
        <p className="eyebrow">{item.kind === "film" ? "Film" : "Série"}{item.year ? ` · ${item.year}` : ""}</p>
        <h2 id="detail-title">{item.title}</h2>
        <div className="detail-genres">{item.genres.map(genre => <span key={genre}>{genre}</span>)}</div>
        <h3>Synopsis</h3><p className="detail-synopsis">{item.synopsis || "Le synopsis de ce titre n’est pas encore disponible."}</p>
        <div className="detail-actions">
          {item.telegramUrl && <a href={item.telegramUrl} target="_blank" rel="noopener noreferrer" className="button-primary">Ouvrir dans le canal <span aria-hidden="true">↗</span><span className="sr-only"> — nouvel onglet</span></a>}
          <button type="button" className="detail-save" aria-pressed={saved} onClick={onToggle}>{saved ? "♥ Dans ma liste" : "♡ Ajouter à voir"}</button>
        </div>
        {error && <p className="watchlist-inline-error" role="alert">{error}</p>}
        <a href={item.watchUrl} target="_blank" rel="noopener noreferrer" className="legal-offers">Consulter les offres légales en France<span className="sr-only"> — nouvel onglet</span></a>
        <div className="detail-provenance">{item.episodes?.length ? <p>{item.episodes.length} épisode{item.episodes.length > 1 ? "s" : ""} référencé{item.episodes.length > 1 ? "s" : ""} par TMDB.</p> : null}{item.sourceEpisodes?.length ? <p>{item.sourceEpisodes.length} épisode{item.sourceEpisodes.length > 1 ? "s" : ""} vérifié{item.sourceEpisodes.length > 1 ? "s" : ""} dans le canal ; numérotation distincte des références TMDB.</p> : null}</div>
      </div>
    </div>
    {groups.length > 0 && <section className="detail-episodes" aria-labelledby="detail-episodes-title">
      <div className="detail-episodes-heading"><h3 id="detail-episodes-title">{item.kind === "serie" ? "Saisons et publications disponibles" : "Publications dans le canal"}</h3>
        {groups.length > 1 && <div><label htmlFor="detail-season" className="sr-only">Choisir une saison ou un groupe de publications</label><select id="detail-season" name="season" className="genre-select" value={season} onChange={e => setSeason(e.target.value)}><option value="all">Toutes les publications</option>{groups.map(([key,group]) => <option key={key} value={key}>{group.label}</option>)}</select></div>}
      </div>
      <div className="detail-episode-scroll">{groups.filter(([key]) => season === "all" || key === season).map(([key,group]) => <section key={key} className="detail-episode-group"><h4>{group.label}</h4><ul>{group.publications.map(p => <li key={`${p.url}:${p.numbering ?? "post"}:${p.season ?? ""}:${p.episode ?? ""}`}><a href={p.url} target="_blank" rel="noopener noreferrer">{p.episode === undefined ? `Publication nº ${p.messageId}` : `Épisode ${p.episode}`}<span aria-hidden="true">↗</span><span className="sr-only"> — ouvrir dans Telegram, nouvel onglet</span></a></li>)}</ul></section>)}</div>
    </section>}
    <div className="detail-share"><button type="button" onClick={copy}>Copier le lien de la fiche ↗</button><p role="status" aria-live="polite">{message}</p><span>La liste « À voir » est enregistrée dans ce navigateur, sur cet appareil.</span></div>
  </>;
}
export function TitleDialog({ item, saved, onToggle, onClose, error }: { item: Title | null; saved: boolean; onToggle: () => void; onClose: () => void; error: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!item || !dialog) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow, title = document.title;
    document.body.style.overflow = "hidden"; document.title = `${item.title} — The Browser`;
    if (!dialog.open) dialog.showModal();
    return () => { dialog.close(); document.body.style.overflow = overflow; document.title = title; if (previous?.isConnected) previous.focus({ preventScroll: true }); else document.getElementById("catalogue-titre")?.focus({ preventScroll: true }); };
  }, [item]);
  return <dialog ref={ref} className="title-dialog" aria-labelledby="detail-title" onCancel={e => { e.preventDefault(); onClose(); }} onClick={e => {
    if (e.target !== e.currentTarget) return;
    const r = e.currentTarget.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) onClose();
  }}>
    {item && <><div className="detail-topbar"><span>La fiche · The Browser</span><button type="button" onClick={onClose} aria-label="Fermer la fiche">×</button></div><DetailContent key={item.id} item={item} saved={saved} onToggle={onToggle} error={error} /></>}
  </dialog>;
}
