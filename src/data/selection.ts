import type { Kind } from "@/data/catalogue";

export type RequestedTitle = {
  title: string;
  kind: Kind;
  /** Absent lorsque la version ou l’identifiant TMDB reste à confirmer. */
  id?: number;
  year?: number;
  aliases?: string[];
};

/** Liste demandée, nettoyée : doublons et épisodes regroupés par série. */
export const requestedTitles: RequestedTitle[] = [
  { kind: "serie", title: "A Different World" },
  { kind: "serie", title: "A Knight of the Seven Kingdoms", id: 224372, year: 2026, aliases: ["A Knight of the Seven Kingdoms"] },
  { kind: "film", title: "Aladdin", year: 2019 },
  { kind: "serie", title: "The Boys", id: 76479, year: 2019, aliases: ["The Boys"] },
  { kind: "serie", title: "Avatar : Le Dernier Maître de l’air", id: 246, year: 2005, aliases: ["Avatar : Le Dernier Maître de l'air"] },
  { kind: "film", title: "Avatar Aang The Last Airbender", year: 2026 },
  { kind: "serie", title: "Avatar : Le Dernier Maître de l’air (2024)", id: 82452, year: 2024, aliases: ["Avatar : Le dernier maître de l'air"] },
  { kind: "serie", title: "Beauty in Black" },
  { kind: "serie", title: "Black Clover", id: 73223, year: 2017, aliases: ["Black Clover"] },
  { kind: "film", title: "Brothers", year: 2009 },
  { kind: "serie", title: "Carrie" },
  { kind: "serie", title: "Dragon Ball Super", year: 2015 },
  { kind: "serie", title: "Squid Game", id: 93405, year: 2021, aliases: ["Squid Game"] },
  { kind: "serie", title: "Tout le monde déteste Chris", id: 252, year: 2005, aliases: ["Tout le monde déteste Chris"] },
  { kind: "film", title: "Flashpoint", year: 2007 },
  { kind: "serie", title: "From", id: 124364, year: 2022, aliases: ["FROM"] },
  { kind: "film", title: "Harry Potter à l’école des sorciers", id: 671, year: 2001, aliases: ["Harry Potter à l'école des sorciers"] },
  { kind: "film", title: "Harry Potter et la Chambre des secrets", id: 672, year: 2002, aliases: ["Harry Potter et la Chambre des secrets"] },
  { kind: "film", title: "Harry Potter et le Prisonnier d’Azkaban", id: 673, year: 2004, aliases: ["Harry Potter et le Prisonnier d'Azkaban"] },
  { kind: "film", title: "Harry Potter et la Coupe de feu", id: 674, year: 2005, aliases: ["Harry Potter et la Coupe de feu"] },
  { kind: "film", title: "Harry Potter et l’Ordre du Phénix", id: 675, year: 2007, aliases: ["Harry Potter et l'Ordre du Phénix"] },
  { kind: "film", title: "Harry Potter et le Prince de sang-mêlé", id: 767, year: 2009, aliases: ["Harry Potter et le Prince de sang-mêlé"] },
  { kind: "film", title: "Harry Potter et les Reliques de la Mort — Partie 1", id: 12444, year: 2010, aliases: ["Harry Potter et les Reliques de la Mort - 1ère partie"] },
  { kind: "film", title: "Harry Potter et les Reliques de la Mort — Partie 2", id: 12445, year: 2011, aliases: ["Harry Potter et les Reliques de la Mort - 2ème partie"] },
  { kind: "film", title: "Hope" },
  { kind: "serie", title: "House of the Dragon", id: 94997, year: 2022, aliases: ["House of the Dragon"] },
  { kind: "film", title: "Ip Man", id: 14756, year: 2008, aliases: ["Ip Man"] },
  { kind: "film", title: "Ip Man 2", id: 37472, year: 2010, aliases: ["Ip Man 2"] },
  { kind: "film", title: "Ip Man 3", id: 365222, year: 2015, aliases: ["Ip Man 3"] },
  { kind: "film", title: "John Wick : Parabellum", id: 458156, year: 2019, aliases: ["John Wick : Parabellum"] },
  { kind: "film", title: "John Wick 2", id: 324552, year: 2017, aliases: ["John Wick : Chapitre 2"] },
  { kind: "film", title: "John Wick : Chapitre 4", id: 603692, year: 2023, aliases: ["John Wick : Chapitre 4"] },
  { kind: "serie", title: "Jujutsu Kaisen", id: 95479, year: 2020, aliases: ["Jujutsu Kaisen"] },
  { kind: "film", title: "Kung Fu Jungle", id: 290864, year: 2014, aliases: ["Kung Fu Jungle"] },
  { kind: "film", title: "Kung Fu Panda 4", id: 1011985, year: 2024, aliases: ["Kung Fu Panda 4"] },
  { kind: "serie", title: "L’Été où je suis devenue jolie", id: 194766, year: 2022, aliases: ["L'Été où je suis devenue jolie"] },
  { kind: "film", title: "La Bataille de Gaulle : L’Âge de fer" },
  { kind: "serie", title: "Lanterns" },
  { kind: "film", title: "Le Crime du 3e étage" },
  { kind: "serie", title: "Les Carnets de l’apothicaire", id: 220542, year: 2023, aliases: ["Les Carnets de l'apothicaire"] },
  { kind: "film", title: "Le Samaritain", id: 629176, year: 2022, aliases: ["Le Samaritain"] },
  { kind: "film", title: "Let It Shine", year: 2012 },
  { kind: "serie", title: "Ma vie avec les Walter Boys", id: 199001, year: 2023, aliases: ["Ma vie avec les Walter Boys"] },
  { kind: "film", title: "Matchbox" },
  { kind: "serie", title: "Miraculous : Les Aventures de Ladybug et Chat Noir", id: 65334, year: 2015, aliases: ["Miraculous, les aventures de Ladybug et Chat Noir"] },
  { kind: "film", title: "Moana", year: 2026 },
  { kind: "serie", title: "The Seven Deadly Sins", id: 62104, year: 2014, aliases: ["The Seven Deadly Sins"] },
  { kind: "serie", title: "Neagley" },
  { kind: "serie", title: "Nouvelle École" },
  { kind: "film", title: "On l’appelait Robin des Bois (2026)" },
  { kind: "film", title: "Nos étoiles contraires", id: 222935, year: 2014, aliases: ["Nos étoiles contraires"] },
  { kind: "film", title: "The Runner" },
  { kind: "film", title: "Raging Fire", year: 2021 },
  { kind: "serie", title: "Reacher", id: 108978, year: 2022, aliases: ["Reacher"] },
  { kind: "film", title: "Rebel Ridge", id: 646097, year: 2024, aliases: ["Rebel Ridge"] },
  { kind: "film", title: "Resident Evil", year: 2026 },
  { kind: "serie", title: "S.W.A.T.", id: 71790, year: 2017, aliases: ["S.W.A.T."] },
  { kind: "film", title: "Scream 7" },
  { kind: "film", title: "Shrek le troisième", id: 810, year: 2007, aliases: ["Shrek le troisième"] },
  { kind: "film", title: "Shrek 4 : Il était une fin", id: 10192, year: 2010, aliases: ["Shrek 4 : Il était une fin"] },
  { kind: "film", title: "Shrek", id: 808, year: 2001, aliases: ["Shrek"] },
  { kind: "film", title: "Shrek 2", id: 809, year: 2004, aliases: ["Shrek 2"] },
  { kind: "film", title: "Sonic 3, le film", id: 939243, year: 2024, aliases: ["Sonic 3, le film"] },
  { kind: "film", title: "Soul", id: 508442, year: 2020, aliases: ["Soul"] },
  { kind: "film", title: "Soulm8te" },
  { kind: "film", title: "Spider-Man: Brand New Day" },
  { kind: "film", title: "Spider-Man", id: 557, year: 2002, aliases: ["Spider-Man"] },
  { kind: "film", title: "Spider-Man 2", id: 558, year: 2004, aliases: ["Spider-Man 2"] },
  { kind: "film", title: "Spider-Man 3", id: 559, year: 2007, aliases: ["Spider-Man 3"] },
  { kind: "film", title: "Star Wars, épisode IX : L’Ascension de Skywalker", id: 181812, year: 2019, aliases: ["Star Wars : L'Ascension de Skywalker"] },
  { kind: "serie", title: "Sullivan’s Crossing" },
  { kind: "serie", title: "Superman et Loïs", id: 95057, year: 2021, aliases: ["Superman & Loïs"] },
  { kind: "film", title: "Swapped" },
  { kind: "serie", title: "Teen Wolf", id: 34524, year: 2011, aliases: ["Teen Wolf"] },
  { kind: "serie", title: "Flash (2014)", id: 60735, year: 2014, aliases: ["Flash"] },
  { kind: "film", title: "The Last Sunrise (2026)" },
  { kind: "film", title: "The Love Hypothesis" },
  { kind: "film", title: "La Nonne", id: 439079, year: 2018, aliases: ["La Nonne"] },
  { kind: "film", title: "The Amazing Spider-Man", id: 1930, year: 2012, aliases: ["The Amazing Spider-Man"] },
  { kind: "film", title: "The Amazing Spider-Man : Le Destin d’un héros", id: 102382, year: 2014, aliases: ["The Amazing Spider-Man : Le Destin d'un héros"] },
  { kind: "film", title: "Toi, moi et la Toscane" },
  { kind: "serie", title: "Tokyo Revengers", id: 105009, year: 2021, aliases: ["Tokyo Revengers"] },
  { kind: "film", title: "Un prince à New York", id: 9602, year: 1988, aliases: ["Un prince à New York"] },
  { kind: "film", title: "Venom : The Last Dance", id: 912649, year: 2024, aliases: ["Venom : The Last Dance"] },
  { kind: "serie", title: "Marvel’s The Punisher", id: 67178, year: 2017, aliases: ["Marvel's The Punisher"] },
  { kind: "film", title: "Kill Zone", year: 2005, aliases: ["SPL : Kill Zone", "SPL", "SPL: Kill Zone"] },
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

/** Associations de l’ancienne version à ne jamais republier depuis Redis sans réanalyse. */
export const revokedLegacyReferences = new Set([
  "serie:651", "film:103269", "film:592508", "film:18817",
  "film:126963", "film:277834",
]);
