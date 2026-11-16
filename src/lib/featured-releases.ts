import type { Title } from "../data/catalogue.ts";
import { sortCatalogue } from "./catalogue-links.ts";
export type FeaturedRelease = Title & { poster: string; telegramUrl: string };

/** Availability comes from an actual publication, never from the release year alone. */
export function featuredReleases(items: Title[], year = 2026): FeaturedRelease[] {
  const seen = new Set<string>();
  return sortCatalogue(items.filter((item): item is FeaturedRelease => {
    if (item.year !== year || !item.poster || !item.telegramUrl || seen.has(item.id)) return false;
    try {
      const url = new URL(item.telegramUrl);
      if (url.protocol !== "https:" || url.hostname !== "t.me" || url.username || url.password || url.port ||
          !/^\/(?:TheBrowser365|c\/4339801492)\/[1-9]\d*$/i.test(url.pathname)) return false;
    } catch { return false; }
    seen.add(item.id); return true;
  }));
}

export function posterSlot(index: number, current: number, total: number) {
  if (total < 1) return null;
  let distance = (index - current + total) % total;
  if (distance > total / 2) distance -= total;
  return Math.abs(distance) <= 2 ? distance : null;
}
