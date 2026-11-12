import type { Kind } from "@/data/catalogue";

export type RequestedTitle = {
  title: string;
  kind: Kind;
  /** Absent lorsque la version ou l’identifiant TMDB reste à confirmer. */
  id?: number;
};

/** Liste demandée, nettoyée : doublons et épisodes regroupés par série. */
export const requestedTitles: RequestedTitle[] = [
  { kind: "serie", title: "A Different World", id: 651 },
  { kind: "serie", title: "A Knight of the Seven Kingdoms", id: 224372 },
  { kind: "film", title: "Aladdin" },
  { kind: "serie", title: "The Boys", id: 76479 },
  { kind: "serie", title: "Avatar : Le Dernier Maître de l’air", id: 246 },
  { kind: "serie", title: "Avatar : Le Dernier Maître de l’air (2024)", id: 82452 },
  { kind: "serie", title: "Beauty in Black" },
  { kind: "serie", title: "Black Clover", id: 73223 },
  { kind: "film", title: "Brothers" },
  { kind: "film", title: "Carrie" },
  { kind: "film", title: "Dragon Ball Z : Battle of Gods", id: 126963 },
  { kind: "serie", title: "Squid Game", id: 93405 },
  { kind: "serie", title: "Tout le monde déteste Chris", id: 252 },
  { kind: "film", title: "Flashpoint" },
  { kind: "serie", title: "From", id: 124364 },
  { kind: "film", title: "Harry Potter à l’école des sorciers", id: 671 },
  { kind: "film", title: "Harry Potter et la Chambre des secrets", id: 672 },
  { kind: "film", title: "Harry Potter et le Prisonnier d’Azkaban", id: 673 },
  { kind: "film", title: "Harry Potter et la Coupe de feu", id: 674 },
  { kind: "film", title: "Harry Potter et l’Ordre du Phénix", id: 675 },
  { kind: "film", title: "Harry Potter et le Prince de sang-mêlé", id: 767 },
  { kind: "film", title: "Harry Potter et les Reliques de la Mort — Partie 1", id: 12444 },
  { kind: "film", title: "Harry Potter et les Reliques de la Mort — Partie 2", id: 12445 },
  { kind: "film", title: "Hope" },
  { kind: "serie", title: "House of the Dragon", id: 94997 },
  { kind: "film", title: "Ip Man", id: 14756 },
  { kind: "film", title: "Ip Man 2", id: 37472 },
  { kind: "film", title: "Ip Man 3", id: 365222 },
  { kind: "film", title: "John Wick : Parabellum", id: 458156 },
  { kind: "film", title: "John Wick 2", id: 324552 },
  { kind: "film", title: "John Wick : Chapitre 4", id: 603692 },
  { kind: "serie", title: "Jujutsu Kaisen", id: 95479 },
  { kind: "film", title: "Kung Fu Jungle", id: 290864 },
  { kind: "film", title: "Kung Fu Panda 4", id: 1011985 },
  { kind: "serie", title: "L’Été où je suis devenue jolie", id: 194766 },
  { kind: "film", title: "La Bataille de Gaulle : L’Âge de fer" },
  { kind: "serie", title: "Lanterns" },
  { kind: "film", title: "Le Crime du 3e étage" },
  { kind: "serie", title: "Les Carnets de l’apothicaire", id: 220542 },
  { kind: "film", title: "Le Samaritain", id: 629176 },
  { kind: "film", title: "Let It Shine", id: 103269 },
  { kind: "serie", title: "Ma vie avec les Walter Boys", id: 199001 },
  { kind: "film", title: "Matchbox" },
  { kind: "serie", title: "Miraculous : Les Aventures de Ladybug et Chat Noir", id: 65334 },
  { kind: "film", title: "Vaiana : La Légende du bout du monde", id: 277834 },
  { kind: "serie", title: "The Seven Deadly Sins", id: 62104 },
  { kind: "serie", title: "Neagley" },
  { kind: "serie", title: "Nouvelle École" },
  { kind: "film", title: "On l’appelait Robin des Bois (2026)" },
  { kind: "film", title: "Nos étoiles contraires", id: 222935 },
  { kind: "film", title: "The Runner" },
  { kind: "film", title: "Raging Fire", id: 592508 },
  { kind: "serie", title: "Reacher", id: 108978 },
  { kind: "film", title: "Rebel Ridge", id: 646097 },
  { kind: "film", title: "Resident Evil" },
  { kind: "serie", title: "S.W.A.T.", id: 71790 },
  { kind: "film", title: "Scream 7" },
  { kind: "film", title: "Shrek le troisième", id: 810 },
  { kind: "film", title: "Shrek 4 : Il était une fin", id: 10192 },
  { kind: "film", title: "Shrek", id: 808 },
  { kind: "film", title: "Shrek 2", id: 809 },
  { kind: "film", title: "Sonic 3, le film", id: 939243 },
  { kind: "film", title: "Soul", id: 508442 },
  { kind: "film", title: "Soulm8te" },
  { kind: "film", title: "Spider-Man: Brand New Day" },
  { kind: "film", title: "Spider-Man", id: 557 },
  { kind: "film", title: "Spider-Man 2", id: 558 },
  { kind: "film", title: "Spider-Man 3", id: 559 },
  { kind: "film", title: "Star Wars, épisode IX : L’Ascension de Skywalker", id: 181812 },
  { kind: "serie", title: "Sullivan’s Crossing" },
  { kind: "serie", title: "Superman et Loïs", id: 95057 },
  { kind: "film", title: "Swapped" },
  { kind: "serie", title: "Teen Wolf", id: 34524 },
  { kind: "serie", title: "Flash (2014)", id: 60735 },
  { kind: "film", title: "The Last Sunrise (2026)" },
  { kind: "film", title: "The Love Hypothesis" },
  { kind: "film", title: "La Nonne", id: 439079 },
  { kind: "film", title: "The Amazing Spider-Man", id: 1930 },
  { kind: "film", title: "The Amazing Spider-Man : Le Destin d’un héros", id: 102382 },
  { kind: "film", title: "Toi, moi et la Toscane" },
  { kind: "serie", title: "Tokyo Revengers", id: 105009 },
  { kind: "film", title: "Un prince à New York", id: 9602 },
  { kind: "film", title: "Venom : The Last Dance", id: 912649 },
  { kind: "serie", title: "Marvel’s The Punisher", id: 67178 },
  { kind: "film", title: "Kill Zone", id: 18817 },
  { kind: "film", title: "Les Maîtres de l’univers" },
  { kind: "film", title: "Mutiny (2026)" },
];

/** Titres reliés à TMDB, dans l’ordre de la liste demandée. */
export const selection: { kind: Kind; id: number }[] = requestedTitles.flatMap(
  ({ kind, id }) => (id === undefined ? [] : [{ kind, id }]),
);

/** À identifier avant publication, sans choisir arbitrairement un homonyme. */
export const pendingTitles = requestedTitles.filter(({ id }) => id === undefined);

/** Noms de fichiers sans titre de film ou de série identifiable. */
export const ignoredFiles = ["index-v1-a1", "sticker webp"];
