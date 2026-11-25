import type { ChannelPost } from "./telegram-store.ts";
import { requestedTitles } from "../data/selection.ts";

export type CopyPlan = { kind: "film" | "serie"; id: number; title: string; year?: number;
  messages: { messageId: number; season?: number; episode?: number }[] };
const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export function copyCommand(text: string) {
  const match = text.match(/^\/?(copier|copie)(?:@Thebrowser365_bot)?(?:\s+([\s\S]*))?$/i);
  if (!match) return null;
  return { status: match[1].toLowerCase() === "copie", query: (match[2] ?? "").replace(/\s+vers\s+(?:le\s+)?(?:canal\s+)?premium\s*$/i, "").trim().slice(0, 200) };
}

/** Resolve only against identified videos in THIS source channel. No fuzzy
 * automatic selection between remakes or films and series with the same name. */
export function findCopyPlans(query: string, posts: ChannelPost[]): CopyPlan[] {
  const typed = query.match(/^(film|s[ée]rie)\s+(.+)$/i);
  const kind = typed ? typed[1].toLowerCase() === "film" ? "film" : "serie" : null;
  const q = typed ? typed[2] : query;
  const byId = q.match(/^(film|serie)-([1-9]\d{0,10})$/i);
  if (!byId && !normalize(q)) return [];
  const plans = new Map<string, CopyPlan & { names: Set<string> }>();
  for (const post of posts) {
    if (post.freeAccessToken) continue; // A free-gated public post is an announcement, not its private video.
    if (!Number.isSafeInteger(post.messageId) || post.messageId < 1 || !/\.(mp4|mkv|avi|mov|webm|m4v|mpeg|mpg|ts)$/i.test(post.fileName ?? "")) continue;
    for (const title of post.titles) {
      if (kind && kind !== title.kind) continue;
      const key = `${title.kind}-${title.id}`, known = requestedTitles.find(t => t.kind === title.kind && t.id === title.id);
      const plan = plans.get(key) ?? { kind: title.kind, id: title.id, title: known?.title ?? title.verifiedNames?.[0] ?? title.expectedTitle ?? key,
        year: title.year ?? known?.year, messages: [], names: new Set<string>() };
      for (const name of [plan.title, title.expectedTitle, ...(title.verifiedNames ?? []), ...(known?.aliases ?? [])]) {
        if (name) { plan.names.add(normalize(name)); if (plan.year) plan.names.add(normalize(`${name} ${plan.year}`)); }
      }
      if (!plan.messages.some(m => m.messageId === post.messageId)) plan.messages.push({ messageId: post.messageId,
        season: title.season ?? title.sourceEpisode?.season, episode: title.episode ?? title.sourceEpisode?.episode });
      plans.set(key, plan);
    }
  }
  return [...plans.entries()].filter(([key, plan]) => byId ? key === `${byId[1].toLowerCase()}-${byId[2]}` : plan.names.has(normalize(q)))
    .map(([, p]) => ({ kind: p.kind, id: p.id, title: p.title, year: p.year, messages: p.messages.sort((a, b) =>
      (a.season ?? 999) - (b.season ?? 999) || (a.episode ?? 999) - (b.episode ?? 999) || a.messageId - b.messageId) }));
}
