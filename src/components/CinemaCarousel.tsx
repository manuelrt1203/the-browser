"use client";
import { memo, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { PointerEvent } from "react";
import type { Title } from "@/data/catalogue";
import { catalogueHref } from "@/lib/catalogue-browsing";
import { featuredReleases, posterSlot } from "@/lib/featured-releases";
import type { FeaturedRelease } from "@/lib/featured-releases";
const INTERVAL = 5500;
function motionSubscribe(callback: () => void) {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", callback); return () => media.removeEventListener("change", callback);
}
const reducedSnapshot = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
function visibilitySubscribe(callback: () => void) {
  document.addEventListener("visibilitychange", callback); return () => document.removeEventListener("visibilitychange", callback);
}
const visibleSnapshot = () => !document.hidden;

type CarouselProps = { items: Title[]; suspended?: boolean; onOpenTitle: (id: string) => void; catalogueQuery: string };
function CarouselDeck({ items, suspended, onOpenTitle, catalogueQuery }: Omit<CarouselProps, "items"> & { items: FeaturedRelease[] }) {
  const [current, setCurrent] = useState(0), [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false), [focused, setFocused] = useState(false), [inView, setInView] = useState(true);
  const [announcement, setAnnouncement] = useState("");
  const reduced = useSyncExternalStore(motionSubscribe, reducedSnapshot, () => true);
  const visible = useSyncExternalStore(visibilitySubscribe, visibleSnapshot, () => false);
  const root = useRef<HTMLDivElement>(null), stage = useRef<HTMLDivElement>(null), frame = useRef<number | null>(null);
  const running = !suspended && items.length > 1 && !reduced && !paused && !hovered && !focused && visible && inView;
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setCurrent(index => (index + 1) % items.length), INTERVAL);
    return () => clearInterval(timer);
  }, [running, items.length]);
  useEffect(() => {
    const element = root.current;
    if (!element || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(entries => setInView(entries[0].isIntersecting), { threshold: .15 });
    observer.observe(element); return () => observer.disconnect();
  }, []);
  useEffect(() => () => { if (frame.current !== null) cancelAnimationFrame(frame.current); }, []);
  function select(index: number) {
    const next = (index + items.length) % items.length;
    const activeLink = root.current?.querySelector('.feature-poster[data-slot="0"] a');
    const caption = root.current?.querySelector('.feature-caption');
    if (document.activeElement === activeLink || caption?.contains(document.activeElement)) {
      root.current?.querySelector<HTMLButtonElement>('[data-carousel-next]')?.focus();
    }
    setCurrent(next); setPaused(true);
    setAnnouncement(`${items[next].title}, ${next + 1} sur ${items.length}.`);
  }
  function resetTilt() {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    stage.current?.style.setProperty("--tilt-x", "0deg"); stage.current?.style.setProperty("--tilt-y", "0deg");
  }
  function tilt(event: PointerEvent<HTMLDivElement>) {
    if (reduced || event.pointerType !== "mouse") return;
    const x = event.clientX, y = event.clientY, element = event.currentTarget;
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const bounds = element.getBoundingClientRect();
      stage.current?.style.setProperty("--tilt-y", `${((x - bounds.left) / bounds.width - .5) * 7}deg`);
      stage.current?.style.setProperty("--tilt-x", `${(.5 - (y - bounds.top) / bounds.height) * 5}deg`);
      frame.current = null;
    });
  }
  const active = items[current];
  return <div ref={root} className={`feature-showcase${running ? " is-running" : ""}`} role="region" aria-roledescription="carrousel" aria-label="Sorties de 2026 disponibles dans le canal" aria-live="off"
    onPointerEnter={event => { if (event.pointerType === "mouse") setHovered(true); }} onPointerLeave={() => { setHovered(false); resetTilt(); }}
    onFocusCapture={() => setFocused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false); }}
    onKeyDown={event => { if (items.length < 2) return; if (event.key === "ArrowRight") { event.preventDefault(); select(current + 1); } if (event.key === "ArrowLeft") { event.preventDefault(); select(current - 1); } }}>
    <div className="feature-stage" ref={stage} onPointerMove={tilt} onPointerLeave={resetTilt}>
      <div className="feature-halo" aria-hidden="true" />
      {items.map((item, index) => {
        const slot = posterSlot(index, current, items.length);
        if (slot === null) return null;
        return <div key={item.id} className="feature-poster" data-slot={slot} aria-hidden={index !== current}>
          <a href={catalogueHref(new URLSearchParams(catalogueQuery), { fiche: item.id, focus: null })} tabIndex={index === current ? 0 : -1} aria-label={`Voir la fiche de ${item.title}`}
            onPointerDown={event => { if (index !== current) event.preventDefault(); }}
            onClick={event => { if (index !== current) { event.preventDefault(); select(index); } else if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) { event.preventDefault(); onOpenTitle(item.id); } }}>
            {/* Affiches déjà redimensionnées par le CDN TMDB. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.poster} alt="" width={400} height={600} loading={Math.abs(slot) < 2 ? "eager" : "lazy"} fetchPriority={slot === 0 ? "high" : "auto"} referrerPolicy="no-referrer" />
            <span className="feature-poster-label">{item.kind === "film" ? "Film" : "Série"}<span>2026</span></span>
          </a>
        </div>;
      })}
    </div>
    <div className="feature-bottom">
      <div className="feature-caption" key={active.id}>
        <p>2026 · Disponible dans le canal</p>
        <a href={catalogueHref(new URLSearchParams(catalogueQuery), { fiche: active.id, focus: null })} onClick={event => { if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) { event.preventDefault(); onOpenTitle(active.id); } }}>{active.title}<span aria-hidden="true">↗</span><span className="sr-only"> — voir la fiche</span></a>
      </div>
      {items.length > 1 && <div className="feature-controls">
        <span className="feature-counter"><span>{String(current + 1).padStart(2, "0")}</span> / {String(items.length).padStart(2, "0")}</span>
        <div className="feature-buttons">
          <button type="button" aria-label="Affiche précédente" onClick={() => select(current - 1)}>←</button>
          {!reduced && <button type="button" aria-label={paused ? "Reprendre le défilement" : "Mettre le défilement en pause"} aria-pressed={paused} onClick={() => { setPaused(value => !value); setFocused(false); }}>
            {paused ? <svg aria-hidden="true" width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="m5 3 8 5-8 5z"/></svg> : <svg aria-hidden="true" width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M4 3h3v10H4zm5 0h3v10H9z"/></svg>}
          </button>}
          <button type="button" data-carousel-next="" aria-label="Affiche suivante" onClick={() => select(current + 1)}>→</button>
        </div>
      </div>}
    </div>
    {items.length > 1 && <div className="feature-progress" aria-hidden="true"><span key={current} style={{ animationDuration: `${INTERVAL}ms` }} /></div>}
    <span className="sr-only" aria-live="polite">{announcement}</span>
  </div>;
}
export const CinemaCarousel = memo(function CinemaCarousel({ items, suspended = false, onOpenTitle, catalogueQuery }: CarouselProps) {
  const releases = useMemo(() => featuredReleases(items), [items]);
  if (!releases.length) return <div className="feature-empty"><p className="eyebrow">Sélection 2026</p><p>Les titres de 2026 seront présentés ici dès leur publication dans le canal.</p><a href="#catalogue" className="button-secondary">Explorer le catalogue →</a></div>;
  return <CarouselDeck key={releases.map(item => item.id).join("|")} items={releases} suspended={suspended} onOpenTitle={onOpenTitle} catalogueQuery={catalogueQuery} />;
});
