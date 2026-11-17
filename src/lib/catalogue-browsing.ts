import type { Title } from "../data/catalogue.ts";
import { sortCatalogue } from "./catalogue-links.ts";
export const validTitleId = (value: string) => /^(film|serie)-[1-9]\d{0,11}$/.test(value);
export type CatalogueView = "catalogue" | "recent" | "a-voir";
export function catalogueState(params: URLSearchParams) {
  const type = params.get("type"); const view = params.get("vue"); const year = params.get("annee") ?? "";
  const title = params.get("fiche") ?? "";
  return { q: (params.get("q") ?? "").slice(0, 200), kind: type === "film" || type === "serie" ? type : "tous",
    genre: (params.get("genre") ?? "").slice(0, 80), year: /^(18|19|20)\d{2}$/.test(year) ? year : "",
    view: (view === "recent" || view === "a-voir" ? view : "catalogue") as CatalogueView,
    title: validTitleId(title) ? title : null };
}
export function catalogueHref(params: URLSearchParams, changes: Record<string, string | null>) {
  const next = new URLSearchParams(params);
  for (const [key,value] of Object.entries(changes)) { if (!value) next.delete(key); else next.set(key,value); }
  return `/${next.size ? `?${next.toString()}` : ""}#catalogue`;
}
export function latestPublication(item: Title) {
  if (!item.telegramUrl) return 0;
  return Math.max(item.latestPublicationId ?? 0, ...(item.telegramPublications ?? []).map(p => p.messageId), 0);
}
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
export function browseCatalogue(items: Title[], state: ReturnType<typeof catalogueState>, saved: ReadonlySet<string>) {
  const q = normalize(state.q.trim());
  const matches = items.filter(item => (state.kind === "tous" || item.kind === state.kind) &&
    (!state.genre || item.genres.includes(state.genre)) && (!state.year || item.year === Number(state.year)) &&
    (!q || normalize(`${item.title} ${item.genres.join(" ")} ${item.year ?? ""}`).includes(q)) &&
    (state.view !== "a-voir" || saved.has(item.id)) && (state.view !== "recent" || latestPublication(item) > 0));
  const alphabetical = sortCatalogue(matches);
  return state.view === "recent" ? alphabetical.sort((a,b) => latestPublication(b) - latestPublication(a)) : alphabetical;
}
export function decodeWatchlist(raw: string): string[] {
  if (raw.length > 64000) return [];
  try { const values = JSON.parse(raw); return Array.isArray(values) ? [...new Set(values.filter(v => typeof v === "string" && validTitleId(v)))].slice(0,1000) : []; }
  catch { return []; }
}
