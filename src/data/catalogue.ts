export type Kind = "film" | "serie";

export type Title = {
  id: string;
  title: string;
  kind: Kind;
  /** Année de sortie, ou null si inconnue. */
  year: number | null;
  genres: string[];
  synopsis: string;
  /** URL de l'affiche. Sans valeur, une affiche générée est affichée. */
  poster?: string;
  /** Page « Où regarder » (offres légales en France). */
  watchUrl: string;
};
