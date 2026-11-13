import type { Title } from "../data/catalogue.ts";
import type { ChannelPost } from "./telegram-store.ts";

export type TelegramPublication = {
  messageId: number;
  url: string;
  season?: number;
  episode?: number;
  numbering?: "tmdb" | "channel";
  hasMedia: boolean;
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
  return Number(b.hasMedia) - Number(a.hasMedia) ||
    (a.season ?? Infinity) - (b.season ?? Infinity) ||
    (a.episode ?? Infinity) - (b.episode ?? Infinity) || a.messageId - b.messageId;
}
export function publicationsForTitle(titleId: string, posts: Record<string, ChannelPost>): TelegramPublication[] {
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
      publications.push({ messageId: post.messageId, url,
        hasMedia: mediaFile(post.fileName ?? "") || (!post.fileName && mediaFile(post.text)),
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
