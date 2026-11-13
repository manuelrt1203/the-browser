# Mémoire du projet — The Browser

Mise à jour : 13 novembre 2026. Ce document décrit les décisions du propriétaire et les résultats vérifiés. Il distingue le code livré, les observations en production communiquées par le propriétaire et les fonctionnalités encore à concevoir.

## Décisions produit en vigueur

- Nom : **The Browser**. Signature : **Discover. Watch. Enjoy.**
- Site responsive servant de catalogue de films et séries et de point d’entrée vers les publications Telegram.
- **Pas de lecteur vidéo intégré** : le propriétaire a retiré cette partie du plan V2.
- **Rust mis de côté** : continuer avec Next.js/TypeScript ; aucune API Rust à créer pour le périmètre actuel.
- Monétisation retenue pour le lancement : **abonnement mensuel à un canal privé**.
- **@TheBrowser365 reste public pour la découverte** ; un canal privé distinct sera réservé aux clients. Le canal privé reste à créer/configurer ; son identifiant n’est pas encore connu.
- Le propriétaire exerce depuis la France et vise aussi des clients au **Congo**. RDC ou République du Congo reste à préciser ; ne pas supposer le pays ni la devise.
- Le propriétaire dispose déjà d’une solution de paiement pour ses clients africains et souhaite la présenter plus tard. Ne pas choisir ou remplacer cette solution à sa place.
- **Prix, devises, prestataire et renouvellement manuel/automatique sont reportés à une prochaine session**, sans date ferme. Aucun paiement réel n’est implémenté.
- Les packs d’épisodes et achats de saisons du document V2 ne sont pas l’offre retenue au lancement.
- PostgreSQL/Supabase figuraient dans le plan V2 ; ils ne sont pas installés et aucune migration n’a été décidée ou réalisée.

La prochaine discussion porte sur les **règles de paiement**, avant toute intégration technique. Voir [docs/payments.md](docs/payments.md).

## Identités et services

| Élément | Référence |
|---|---|
| Dépôt | `manuelrt1203/the-browser`, branche de livraison `main` |
| Site | https://the-browser-one.vercel.app/ |
| Canal public | https://t.me/TheBrowser365 |
| Identifiant Bot API du canal | `-1004339801492` |
| Bot | `@Thebrowser365_bot` |
| ID du canal dans l’export Desktop | `4339801492` |
| Base Redis existante | Upstash `upstash-kv-apricot-park`, liée au projet Vercel |

L’ID numérique et le bot ont été vérifiés par les scripts et les retours du propriétaire. Le dernier contrôle de webhook communiqué indiquait `webhookMatches: true`, `pendingUpdates: 0`, `hasDeliveryError: false`. Refaire le contrôle si nécessaire ; cela ne constitue pas une observation en temps réel.

## Ce qui est livré

- Catalogue avec affiches et synopsis TMDB, films/séries, années et genres.
- Recherche insensible à la casse et aux accents, filtres par type et genre.
- Tri alphabétique français avec tri naturel des chiffres ; remakes départagés par année.
- Import d’un export Telegram Desktop JSON et synchronisation des nouvelles publications/modifications par webhook.
- Lecture conjointe de `text`/légende et `file_name`, liens TMDB explicites et entités de lien.
- Reconnaissance prudente : type, année, titre français/anglais/original, casting lorsque confirmé, rejet des homonymes non résolus.
- Détection des promotions et métadonnées non pertinentes ; rapports de revue conservant les vrais désaccords.
- Redis durable sur Vercel, mises à jour atomiques Lua, gestion des doublons/événements anciens et réanalyse explicite de l’historique.
- Invalidation du cache du site après webhook/import.
- Provenance distincte pour les épisodes vérifiés dans TMDB et ceux vérifiés humainement dans le canal.
- Clic sur une affiche vers un message Telegram précis, en privilégiant un fichier vidéo.
- Pour les séries, choix des épisodes/publications avec liens directs, numérotation et provenance ; aucun numéro inventé.
- Offres légales TMDB disponibles séparément ; une fiche sans publication associée ne reçoit pas un faux lien Telegram.

La dernière fonctionnalité de navigation a été livrée dans le commit **`16cad63`**. Le code est poussé sur `main`. Le statut du dernier déploiement Vercel doit être vérifié avant de prétendre que chaque changement est visible en production.

## Mesures et limite de la fiabilité annoncée

Dernier rapport réel fourni par le propriétaire, moteur de résolution v7 :

- 855 publications importées, 0 échec, 0 non traité.
- 771 publications vidéo sur 771 reconnues et sans point restant en revue.
- 105 titres distincts, 0 entrée dans `review`, 0 dans `errors`.
- `titleCoveragePercent: 100`, `mediaCoveragePercent: 100`.
- **`precisionPercent: null`** : 100 % de couverture ne prouve pas 100 % d’exactitude indépendante ni l’inspection de chaque fichier vidéo.
- La reconnaissance complète combine les vérifications TMDB et les confirmations humaines explicites. Ne pas présenter l’ensemble comme une certification TMDB.
- Un compteur `ownerVerifiedMediaPosts` non initialisé produisait `null` dans ce rapport. Corrigé dans **`eae9186`**, avec tests zéro/cas positif. Ce défaut concernait le bilan, pas les références enregistrées ; aucun réimport n’était requis pour réparer les données.

Dernière validation du code : **75 tests réussis**, lint et compilation Next réussis. Navigation vérifiée dans Chromium avec données TMDB simulées et navigation externe Telegram interceptée : tri, filtres, clic d’affiche, choix d’épisode, provenance et absence de faux lien. Les tests locaux ne prouvent pas l’accessibilité réelle de chaque publication Telegram.

## Confirmations humaines à préserver

Les registres sont dans `src/data/telegram-corrections.ts`. Leur portée est limitée au canal, à l’ID du message, au texte et au nom du fichier exacts. Une modification des sources doit rétablir une vérification normale.

- A Different World : nouvelle série **2026**, pas Campus Show 1987.
- Lanterns : série **DC/HBO 2026**.
- Message 20 Avatar : **dessin animé 2005**. Les autres publications portant explicitement 2024 restent distinctes.
- La Belle et la Bête : **2017, Emma Watson**.
- Les Éternels : **Marvel 2021**.
- Maléfique : **2014, Angelina Jolie**.
- Le Flingueur / The Mechanic : **2011, Jason Statham**.
- La Petite Sirène : **prises de vues réelles 2023**.
- Mutiny : **Jason Statham** ; The Runner : **Gal Gadot** ; Hope : **Michael Fassbender**. Les acteurs servent à vérifier les filmographies et castings TMDB.
- Brothers : **2009, Tobey Maguire**, écrit McGuire dans la légende ; vérification du casting.
- Swapped : **Aventures croisées (2026)**, distingué de l’homonyme Swapped!.
- Six désaccords Teen Wolf (messages 206, 207, 208, 228, 229, 247) : le propriétaire a regardé les vidéos et confirmé **les textes Telegram**.
- Le propriétaire a regardé les **28 vidéos des Carnets de l’apothicaire** étiquetées S02E01–24 et S03E03–06. Si TMDB ne confirme pas ces numéros, les conserver dans `sourceEpisode` avec `verifiedBy: "owner"`, jamais dans les champs canoniques `season`/`episode`. L’interface distingue les deux provenances.

Anciennes erreurs corrigées : A Different World → 60 Minutes ; Let It Shine → Superman contre l’Élite ; Raging Fire → Sooryavanshi ; Kill Zone → La Mariée aux cheveux blancs. Les anciennes références fautives sont bloquées pour les données Redis non réanalysées. Les confusions Moana 2026/Vaiana 2016 et Dragon Ball Super/film Battle of Gods ont aussi été retirées. Ne pas réintroduire ces IDs en les devinant.

## Architecture actuelle

- Next.js **16.4.6**, React **19.3.0**, TypeScript, Tailwind CSS **4.3.3**.
- Node **24** et npm ; installations à partir de `package-lock.json`.
- Polices locales via `geist@1.9.2` : pas de téléchargement Google Fonts à la compilation.
- Routes API Next.js sous `src/app/api/telegram/` ; pas de backend séparé.
- Redis REST Upstash en production. Hash : `the-browser:telegram:ID_DU_CANAL`.
- Fichier local uniquement en développement sur une seule instance ; refus explicite du fichier comme stockage de production Vercel.
- Aucun compte client, paiement, abonnement, canal privé payant, autorisation commerciale ou lecteur vidéo n’est encore implémenté.

## Fichiers et points d’entrée

| Emplacement | Rôle |
|---|---|
| `src/data/selection.ts` | Sélection, versions, alias, casting et anciennes références révoquées |
| `src/data/telegram-corrections.ts` | Confirmations humaines strictement ciblées |
| `src/lib/telegram-resolution.ts` | Moteur partagé import/webhook, actuellement v7 |
| `src/lib/telegram-store.ts` | Persistance, validation, script Lua, diagnostic sans écriture |
| `src/lib/tmdb.ts` | Enrichissement et catalogue mis en cache |
| `src/lib/catalogue-links.ts` | Tri et URLs exactes des publications |
| `src/components/Catalogue.tsx` | Recherche, filtres, cartes et choix des épisodes |
| `src/app/api/telegram/route.ts` | Réception des événements et diagnostic authentifié |
| `src/app/api/telegram/revalidate/route.ts` | Invalidation du cache authentifiée |
| `scripts/import-telegram.mjs` | Import, simulation, rapport et corrections explicites |
| `scripts/telegram-webhook.mjs` | Vérification et enregistrement du webhook |
| `scripts/check-catalogue-storage.mjs` | Diagnostic Redis sans modification des publications |
| `docs/telegram.md` | Fonctionnement, configuration, historique des corrections et limites |

## Travail local, secrets et déploiement

- Utiliser le checkout existant : les tâches cloud sont déjà isolées. Ne créer aucun worktree sans demande explicite.
- Préserver les changements existants. Ne pas réinitialiser le dépôt ou les données Redis pour résoudre une panne.
- Lire les consignes Next dans `AGENTS.md` et les guides locaux `node_modules/next/dist/docs/` pertinents avant de modifier le code.
- `.env.example` ne contient que noms/exemples sans secrets.
- Variables : `TMDB_READ_TOKEN`, `TELEGRAM_CHANNEL_ID`, `TELEGRAM_WEBHOOK_SECRET`, paire `KV_REST_API_URL`/`KV_REST_API_TOKEN` ou `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN`.
- Scripts de gestion du bot : `TELEGRAM_BOT_TOKEN`, `SITE_URL`. Développement fichier : `CATALOGUE_DATA_DIR`.
- Les variables/secrets Vercel ne sont pas automatiquement disponibles dans la machine cloud. La CLI Vercel remplace les valeurs Production sensibles par `[SENSITIVE]` lors d’un téléchargement ; ne pas traiter ces marqueurs comme des jetons valides.
- Ne jamais demander de secrets dans le chat, les imprimer, les commiter ou les mettre dans cette mémoire. Utiliser les paramètres sécurisés ou un fichier local ignoré et protégé.
- Les domaines ajoutés à un brouillon cloud ne sont pas forcément appliqués : vérifier l’accès effectif. Cette machine a eu des refus réseau vers le site et certaines API ; un refus proxy ne prouve pas une panne de production.
- Les fichiers dans `/tmp` et les pièces jointes de la session ne sont pas des dépendances restaurables du projet.
- L’export original et les rapports locaux ne sont pas versionnés. Un import local ne prouve pas une importation Redis de production.

Commandes usuelles, depuis la racine :

```sh
npm ci --cache /workspace/.npm-cache --no-audit --no-fund  # cache adapté au cloud
npm test
npm run lint
npm run build
npm run dev -- --hostname 0.0.0.0
```

Sur la machine du propriétaire, avec sa configuration locale réelle :

```sh
node --env-file=.env.production.local scripts/check-catalogue-storage.mjs
node --env-file=.env.production.local scripts/telegram-webhook.mjs
node --env-file=.env.production.local --experimental-strip-types scripts/import-telegram.mjs "/chemin/vers/result.json" 4339801492
```

Le webhook est déjà enregistré : ne pas le remplacer sans diagnostic. `--register` protège contre le remplacement d’une autre URL ; ne pas ajouter `--replace` automatiquement. Les scripts n’envoient pas de messages au canal.

Les nouveaux liens du catalogue utilisent les IDs déjà enregistrés : aucun réimport nécessaire pour les activer après déploiement.

## Limites Telegram et monétisation future

- Les suppressions de messages ne sont pas transmises par la Bot API ; les liens peuvent devenir indisponibles si les publications sont supprimées.
- La Bot API ne permet pas de relire l’historique du canal : l’export sert à l’amorçage.
- Le bot actuel synchronise le catalogue ; il ne gère pas encore les comptes clients ni les adhésions payantes.
- Les règles d’accès, d’invitation, d’expiration, de remboursement et de renouvellement du futur canal privé restent à concevoir.
- Le document V2 prévoyait de vérifier les droits et territoires avant commercialisation. Cette vérification n’est pas établie par l’import ou l’existence du canal.
- Si des ventes sont réalisées directement dans Telegram, vérifier les règles Telegram applicables aux biens numériques avant de choisir le parcours de paiement.

## Prochaine reprise

1. Reprendre la définition des règles de paiement avec le propriétaire, sans démarrer d’intégration pendant le report demandé.
2. Préciser quel Congo est concerné et faire présenter la solution de paiement qu’il possède déjà.
3. Fixer prix/devise, durée exacte de la période mensuelle, renouvellement, échéances, activation, expiration et remboursements.
4. Définir le lien entre compte client, identité Telegram, paiement confirmé et accès au canal privé.
5. Choisir ensuite les besoins de base de données et d’administration ; conserver le catalogue et la synchronisation existants.

Mettre à jour cette mémoire après une décision ou livraison significative. Ne pas transformer une proposition ou une confirmation limitée à quelques messages en règle globale.
