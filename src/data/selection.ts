import type { Kind } from "@/data/catalogue";

/**
 * Titres affichés sur le site, dans cet ordre. Seuls ces titres apparaissent.
 * `id` est l'identifiant TMDB : themoviedb.org/movie/603 → { kind: "film", id: 603 }.
 */
export const selection: { kind: Kind; id: number }[] = [];
