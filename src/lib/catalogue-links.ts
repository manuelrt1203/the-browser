import type { Title } from "../data/catalogue.ts";
import type { ChannelPost } from "./telegram-store.ts";
import {freeAssetUrl, freePostUrl, validFreeToken} from "./telegram-free-links.ts";

export type TelegramPublication = {
  messageId: number;
  url: string;
  season?: number;
  episode?: number;
  numbering?: "tmdb" | "channel";
  hasMedia: boolean;
  requiresFreeJoin?: boolean;
  protectedFile?: boolean;
};
const collator = new Intl.Collator("fr", { sensitivity: "base", numeric: true });
export function sortCatalogue<T extends Pick<Title, "title" | "year" | "id">>(items: T[]): T[] {
  return [...items].sort((a, b) => collator.compare(a.title, b.title) ||
    (a.year ?? Infinity) - (b.year ?? Infinity) || a.id.localeCompare(b.id));
}

/** Un lien est construit à partir des IDs enregistrés, jamais d’une recherche de titre. */
export function telegramMessageUrl(channelId: string, messageId: number): string | null {
  if (!/^-100[1-9]\d*$/.test(channelId) || !Number.isSafeInteger(messageId) || messageId < 1) return null;
  if (channelId === "-1004339801492") return `https://t.me/TheBrowser365/${messageId}`;
  return `https://t.me/c/${channelId.slice(4)}/${messageId}`;
}
const mediaFile = (value: string) => /\.(?:mp4|mkv|avi|mov|mpg|mpeg|webm|m4v|ts)$/i.test(value.trim());
function comparePublications(a: TelegramPublication, b: TelegramPublication): number {
  return Number(!!b.protectedFile) - Number(!!a.protectedFile) || Number(b.hasMedia) - Number(a.hasMedia) ||
    (a.season ?? Infinity) - (b.season ?? Infinity) ||
    (a.episode ?? Infinity) - (b.episode ?? Infinity) || a.messageId - b.messageId;
}
export function publicationsForTitle(titleId: string, posts: Record<string, ChannelPost>, gatedChannel?: string): TelegramPublication[] {
  const publications: TelegramPublication[] = [];
  for (const [key, post] of Object.entries(posts)) {
    const match = key.match(/^(-100\d+):(\d+)$/);
    if (!match || Number(match[2]) !== post.messageId) continue;
    const url = telegramMessageUrl(match[1], post.messageId);
    if (!url) continue;
    for (const ref of post.titles) {
      if (`${ref.kind}-${ref.id}` !== titleId) continue;
      const source = ref.sourceEpisode?.verifiedBy === "owner" ? ref.sourceEpisode : undefined;
      const season = source?.season ?? ref.season;
      const episode = source?.episode ?? ref.episode;
      const hasNumber = Number.isInteger(season) && season! >= 0 && Number.isInteger(episode) && episode! > 0;
      const hasMedia = mediaFile(post.fileName ?? "") || (!post.fileName && mediaFile(post.text));
      const gated = gatedChannel === match[1] && hasMedia;
      const protectedFile = gated && validFreeToken(post.freeAccessToken);
      publications.push({ messageId: post.messageId, url: gated ? (protectedFile ? freeAssetUrl(post.freeAccessToken!)! : freePostUrl(post.messageId)!) : url,
        hasMedia, ...(gated ? {requiresFreeJoin: true} : {}), ...(protectedFile ? {protectedFile: true} : {}),
        ...(hasNumber ? { season, episode, numbering: source ? "channel" : "tmdb" } : {}),
      });
    }
  }
  // Pour un épisode republié, conserver en priorité le message avec un fichier.
  // Un message sans numérotation reste une publication, jamais un épisode inventé.
  const distinct = new Map<string, TelegramPublication>();
  for (const publication of publications.sort(comparePublications)) {
    const key = publication.episode !== undefined
      ? `${publication.numbering}:${publication.season}:${publication.episode}`
      : publication.url;
    if (!distinct.has(key)) distinct.set(key, publication);
  }
  return [...distinct.values()];
}

/** Message IDs order publications within this channel; edits never make an old post new. */
export function latestPublicationIdForTitle(titleId: string, posts: Record<string, ChannelPost>): number | undefined {
  let latest = 0;
  for (const [key,post] of Object.entries(posts)) {
    const match = key.match(/^(-100\d+):(\d+)$/);
    if (!match || Number(match[2]) !== post.messageId || !telegramMessageUrl(match[1],post.messageId)) continue;
    if (post.titles.some(ref => `${ref.kind}-${ref.id}` === titleId)) latest = Math.max(latest,post.messageId);
  }
  return latest || undefined;
}
