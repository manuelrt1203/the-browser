# Mémoire du projet — The Browser

Mise à jour : 19 novembre 2026. Ce document décrit les décisions du propriétaire et les résultats vérifiés. Il distingue le code livré, les observations en production communiquées par le propriétaire et les fonctionnalités encore à concevoir.

## Refonte visuelle cinéma — 16 novembre 2026

Le propriétaire demande l’usage de skills et choisit « cinéma sombre et élégant, touches ambrées ». web-design-guidelines et vercel-react-best-practices appliquées. Navigation/pied partagés, hero avec trois affiches réelles, catalogue/cartes/filtres/état vide redessinés, pages Premium/compte/informations harmonisées. Recherche, tri, épisodes/provenances, liens et règles commerciales conservés. Voir docs/design.md. Validation : 122 tests, parcours HTTP complet réussi, lint sans erreur (17 avertissements dans les skills locales), build et vérification visuelle Chromium ordinateur/mobile, absence de débordement à 320 px, préférence de mouvement réduit et interactions catalogue vérifiées. Aucun paiement ni changement du webhook ; livraison prévue en preview pour revue, pas en Production sans nouvelle demande.

## Espace abonnement publié et catalogue Preview réparé — 16 novembre 2026

Publication explicitement autorisée. Commits 5ef8462 puis c27539e poussés sur main ; déploiement Production dpl_Gv7Sue6H16AadxKdPwVo1Z9rWCfB confirmé Ready, lié au domaine public. /mon-abonnement, /conditions, /remboursements et /support HTTP200 ; API privée sans session HTTP401 ; paiements Stripe/SasPay de test toujours404 en Production. Pages commerciales toujours préparatoires, pas d’identité/contact inventés et ventes réelles fermées.

Le propriétaire signale le message TMDB manquant : reproduit sur Preview uniquement. TMDB_READ_TOKEN était affecté à Production, pas Preview ; affectation étendue par API sans lecture de sa valeur, Production conservée. TELEGRAM_CHANNEL_ID manquait aussi dans Preview, ajouté avec le canal public existant -1004339801492. Preview finale dpl_H4zTfUu1raSYEzReV5jZJYH6cp5h Ready, alias stable de test réaffecté. Contrôle final des deux catalogues (public et preview) : HTTP200, ni message de jeton absent ni indisponibilité, URLs d’affiches TMDB présentes. Aucun secret à ressaisir, aucune donnée de catalogue ni webhook modifié.

## Renouvellement manuel et espace abonnement — 16 novembre 2026

Décision confirmée : renouvellement manuel, aucun prélèvement/reconduction automatique. Le propriétaire ne dispose pas des informations professionnelles/contact demandées ; aucune identité, adresse ou e-mail inventé. Il choisit aucune garantie commerciale de remboursement supplémentaire, sans suppression des droits légaux. Conditions, remboursements et support préparés avec avertissement ventes fermées ; trame complète et points à compléter dans docs/commercial-terms-draft.md. SUPPORT_EMAIL peut être renseigné lorsqu’une adresse opérationnelle existe. Ouverture des ventes toujours reportée ; achat anticipé/frais/fiscalité/fuseau contractuel restent à préciser.

Espace /mon-abonnement et API privée /api/premium/subscription implémentés : propriétaire issu uniquement de la session Telegram, historique/statut/échéance sans identifiants prestataire ni identité Telegram exposée, Cache-Control private,no-store. Échéances affichées dans le fuseau de l’appareil. Le bouton d’accès nécessite une période live active et le service activé ; les paiements test restent des démonstrations sans droits réels. Ne pas présenter un renouvellement anticipé ou un cumul de périodes comme implémenté.

## Accès au canal déployés et activés — 16 novembre 2026

Le propriétaire autorise explicitement le déploiement et l’activation. Code applicatif poussé sur main : 5786482, puis correctifs workflow 057ff95 et identité OIDC 164e864. Déploiement Production final dpl_85bFL3shfJbFS5i8cpipns67jstW confirmé Ready sur the-browser-one.vercel.app. PREMIUM_ENVIRONMENT=live, PREMIUM_TELEGRAM_ACCESS_ENABLED=1, PREMIUM_TELEGRAM_TEST_AUTH_ENABLED=1 et PREMIUM_ACCESS_GITHUB_OIDC_ENABLED=1 configurés en Production. Les connexions test de la preview restent possibles via le même bot mais isolées des sessions et droits live ; les anciennes sessions test du site public ne sont pas des sessions live.

Webhook Telegram mis à jour sans changement d’URL/purge : chat_join_request ajouté, anciennes notifications préservées, zéro attente et aucune erreur. /premium HTTP 200 affiche le bouton d’accès ; invitation sans session HTTP 401 ; maintenance sans identité valide HTTP 401 ; pilotes Stripe/SasPay de test toujours HTTP 404 en Production. Aucun lien réel, admission ou retrait de membre effectué. Index des membres live vide au contrôle.

Vercel Hobby confirmé ; contrôle d’expiration via GitHub Actions toutes les cinq minutes (cadence indicative, possibles délais), workflow public premium-expiration.yml. GitHub refuse l’API secrets, contournement non nécessaire : authentification OIDC RSA signée strictement liée au dépôt, aux IDs propriétaire230215107/dépôt1455838466, au workflow/main, à l’audience et aux dates. Première tentative refusée car GitHub utilise un sub contenant ces IDs ; format corrigé et testé sans relâcher les autres vérifications. Exécution réelle validée : https://github.com/manuelrt1203/the-browser/actions/runs/43964370019, conclusion success, après déploiement de la correction. Le passage réel avec index vide valide l’ordonnanceur/authentification/lecture ; pas un test de retrait de membre réel.

Validation : 119 tests habituels, 15 résultats d’intégration Redis réel/HTTP, lint sans erreur (avertissements des compétences locales) et build réussis ; test ciblé OIDC repassé après correction. Paiements réels toujours fermés et adaptateurs live non raccordés : le paiement Stripe test précédent ne donne aucun accès réel. Les règles commerciales restantes et le cycle réel invitation/retrait restent à valider avant ouverture des ventes. SasPay reste bloqué sur sa signature externe, voir rapport support.

## Correction SasPay sandbox — 16 novembre 2026

La documentation officielle https://docs.saspay.me/sandbox annonce encore « Bientôt disponible » et exige un compte sandbox séparé. Le préfixe sk_test_ est une étiquette : une clé ainsi nommée sur api.saspay.me peut traiter de l’argent réel. Le conseil précédent consistant à créer simplement une clé SANDBOX dans le compte de production est insuffisant et remplacé par cette consigne. Le pilote appelle désormais exclusivement sandbox-api.saspay.me, interdit les redirections HTTP et limite ses checkouts à sandbox-checkout.saspay.me (y compris le stockage Redis test). Aucun repli production. La disponibilité du service et les vrais scénarios restent à vérifier ; aucun appel SasPay authentifié effectué. Validation : 109 tests, parcours HTTP Next.js/Redis avec prestataires simulés, lint et build réussis. Correction locale, non publiée.

## Point de reprise — travail repris le 16 novembre 2026

Le propriétaire a explicitement demandé de reprendre le travail le 16 novembre 2026. La pause est levée. Conserver les paiements réels fermés et vérifier le déploiement avant toute activation de la connexion Telegram. Ce résumé décrit le dernier état ; les sections chronologiques plus bas conservent les anciens blocages, parfois déjà résolus.

- **Fonctionnalités Premium poussées : `d482240472b6ff1088fe7769d5c57cdc4d04a410` ; dernier correctif poussé sur `origin/main` : `db30bb5` (acquittement des autres canaux Telegram).** Connexion Telegram avec confirmation explicite, sessions sécurisées, commandes/paiements atomiques dans Redis, Checkout Stripe de test à 4,57 EUR. Les routes de paiement de test restent fermées en production. SasPay possède maintenant un pilote de test dans le code, pas encore validé sur un vrai compte SANDBOX.
- **Validations : 99 tests habituels, 12 tests Redis réel isolé, 1 test HTTP complet (API Stripe simulée), lint et build réussis.** Des sessions Stripe réelles en mode test ont été créées/lues puis expirées sans débit lors des étapes précédentes ; pas de paiement complet dans le navigateur validé.
- **Redis réel fonctionne en lecture et scripting**, contrôlé sans écriture. `KV_REST_API_URL` et `KV_REST_API_TOKEN` sont configurés dans l’environnement ; ne pas redemander ces valeurs ou les recopier dans les fichiers.
- **Canal privé et bot vérifiés par API** : canal `-1003958043288`, @Thebrowser365_bot administrateur avec invitation/restriction autorisées. Le catalogue public reste sur `-1004339801492`. La synchronisation des nouvelles saisons de The Big Bang Theory fonctionne selon le propriétaire.
- **Vercel : db30bb5 confirmé déployé avec succès** via le statut GitHub Vercel et /premium HTTP 200. La connexion Telegram reste désactivée sur le site (session 404). Le site et api.github.com sont maintenant accessibles. La connexion administrateur Vercel reste bloquée sur vercel.com/api.vercel.com ; ces domaines sont préparés dans le nouveau brouillon, sans publication par l’agent.
- **Connexion Telegram réelle non activée/testée sur le site.** Vérifier les paramètres Vercel (`SITE_URL`, Redis, `PREMIUM_ENVIRONMENT=test`, drapeau d’authentification) et le secret existant du webhook, absent de cette machine au dernier contrôle. Déployer/vérifier le code avant d’activer la connexion et d’ajouter `message`/`callback_query` aux notifications existantes. Préserver l’URL, les notifications déjà souscrites et les mises à jour en attente.
- **Aucun encaissement réel, invitation, retrait de membre ou changement réel du webhook effectué.** Les invitations/retraits automatisés restent à implémenter. Renouvellement, frais, fiscalité, remboursements et fuseau commercial restent à décider.
- `.agents/` et `skills-lock.json` sont des outils installés localement, non inclus dans le commit applicatif. Les credentials CLI Stripe restent hors dépôt et ne doivent jamais être affichés. La session OAuth peut nécessiter une nouvelle connexion ; vérifier avant de la supposer active.

## Décisions produit en vigueur

- Nom : **The Browser**. Signature : **Discover. Watch. Enjoy.**
- Site responsive servant de catalogue de films et séries et de point d’entrée vers les publications Telegram.
- **Pas de lecteur vidéo intégré** : le propriétaire a retiré cette partie du plan V2.
- **Rust mis de côté** : continuer avec Next.js/TypeScript ; aucune API Rust à créer pour le périmètre actuel.
- Monétisation retenue pour le lancement : **abonnement mensuel à un canal privé**.
- **@TheBrowser365 reste public pour la découverte** ; un canal privé distinct sera réservé aux clients. Le propriétaire confirme avoir créé le canal privé et ajouté @Thebrowser365_bot comme administrateur. Son identifiant et les permissions effectives restent à vérifier par API.
- Le propriétaire exerce depuis la France et vise notamment le **Congo-Brazzaville (République du Congo)**. Il souhaite proposer l’abonnement dans tous les pays ; la couverture effective de SasPay et Stripe reste à vérifier, sans supposer une disponibilité universelle.
- Le propriétaire retient **SasPay** (https://app.saspay.me) **et Stripe** pour les paiements. La répartition envisagée est SasPay pour les moyens locaux africains et Stripe pour les cartes et l’Europe ; le routage exact reste à définir et à vérifier. Selon sa confirmation du 14 novembre 2026, le compte SasPay est **en attente de validation**. Le statut du compte Stripe n’est pas connu ; aucune intégration ni capacité technique des prestataires n’est encore vérifiée dans le projet.
- **Tarif mensuel choisi le 15 novembre 2026 : 3 000 FCFA (XAF), avec le même prix en euros**. Équivalent arrondi au centime : **4,57 EUR** (1 EUR = 655,957 XAF). Le renouvellement manuel est confirmé ; la prise en charge des frais de paiement reste à définir. Aucun paiement réel n’est implémenté.
- Les clients au Congo-Brazzaville doivent pouvoir payer avec **MTN Mobile Money et Airtel Money**. Leur disponibilité effective chez SasPay pour ce pays, ainsi que les versements vers la France, restent à vérifier. Ne pas confondre Congo-Brazzaville et RDC.
- Selon le propriétaire, SasPay détecte le pays du client et propose le montant et les modes de paiement correspondants. Ce fonctionnement reste à vérifier dans la documentation et les tests du prestataire ; le tarif mensuel retenu est 3 000 XAF, soit 4,57 EUR après arrondi.
- Période confirmée : un abonnement commencé le 10 expire le 10 du mois suivant. Si cette date n’existe pas dans le mois suivant (29–31), l’expiration tombe au dernier jour de ce mois : règle confirmée par le propriétaire. L’heure et le fuseau restent à définir.
- L’accès au canal premium est accordé après confirmation du paiement.
- Les packs d’épisodes et achats de saisons du document V2 ne sont pas l’offre retenue au lancement.
- PostgreSQL/Supabase figuraient dans le plan V2 ; ils ne sont pas installés et aucune migration n’a été décidée ou réalisée.

Le propriétaire a autorisé le démarrage de la mise en place le 15 novembre 2026. Le socle et la démonstration locale sont implémentés ; les encaissements restent fermés et plusieurs règles commerciales restent à définir. Voir [docs/payments.md](docs/payments.md).

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
- Un socle Premium est implémenté : page `/premium`, tarifs serveur, échéance mensuelle avec fin de mois, confirmation idempotente et démonstration locale des paiements. Aucun compte client, encaissement réel, stockage durable d’abonnements, invitation/retrait du canal privé ou lecteur vidéo n’est implémenté. Le simulateur ne donne aucun accès Telegram et est désactivé en production. UTC est seulement la convention technique du prototype ; le fuseau commercial reste à confirmer.

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
- L’accès après confirmation du paiement et l’échéance à la même date du mois suivant sont confirmés. Les mécanismes d’invitation/retrait, les remboursements et le renouvellement restent à concevoir. La règle du dernier jour du mois pour les dates absentes est confirmée.
- Le document V2 prévoyait de vérifier les droits et territoires avant commercialisation. Cette vérification n’est pas établie par l’import ou l’existence du canal.
- Si des ventes sont réalisées directement dans Telegram, vérifier les règles Telegram applicables aux biens numériques avant de choisir le parcours de paiement.

## Prochaine reprise

1. Reprise autorisée le 16 novembre 2026 : relire le résumé en tête de ce fichier, puis reprendre les vérifications ci-dessous.
2. Vérifier l’application des domaines réseau déjà préparés et le statut Vercel du commit `d482240` ; diagnostiquer un éventuel échec de build avant d’affirmer que le code est en ligne.
3. Vérifier les paramètres du projet Vercel et l’accès au secret existant du webhook. Activer et tester la connexion Telegram après déploiement, sans remplacer l’URL du webhook public ni supprimer ses notifications.
4. Tester le parcours Stripe en mode test avec l’identité Telegram et Redis ; vérifier les vraies notifications externes. Ne pas ouvrir les encaissements réels.
5. Réaliser ensuite les invitations/retraits du canal, puis SasPay, en précisant les règles commerciales encore ouvertes. Ne pas changer les tarifs retenus (3 000 XAF / 4,57 EUR) ni activer une reconduction sans décision du propriétaire.

Mettre à jour cette mémoire après une décision ou livraison significative. Ne pas transformer une proposition ou une confirmation limitée à quelques messages en règle globale.

## Reprise Stripe — 15 novembre 2026

- Le propriétaire indique que le compte Stripe est prêt. Il a précisé le nom de sa clé : `STRIPE_SECRET_KEY_TEST`, à conserver pour la configuration de test. Aucune valeur de clé n’est enregistrée ici.
- Les compétences officielles Stripe sont installées dans `.agents/skills/` et la CLI 1.55.11 dans `/workspace/.stripe-tools/bin/stripe`. Le planificateur CLI n’a pas pu charger son plugin, bloqué par le réseau vers `dashboard.stripe.com` ; le MCP reste non connecté. Aucun plan officiel accepté ni connecteur de paiement implémenté.
- Le secret de test n’est pas injecté dans la machine lors du contrôle. L’exigence `STRIPE_SECRET_KEY_TEST` vers `api.stripe.com` et l’accès à `dashboard.stripe.com` ont été sauvegardés en brouillon, sans publication. La valeur n’est pas encore liée dans ce brouillon. Voir `docs/stripe-plan.md` pour la reprise ; ne pas demander la valeur dans le chat.

### Dernier contrôle Stripe après publication — 15 novembre 2026

`STRIPE_SECRET_KEY_TEST` est injectée ; l’appel de lecture seule à l’API Stripe renvoie `secret_key_required` et indique une clé publique. Remplacer la valeur sécurisée par une clé serveur de test avant de continuer. Aucun objet Stripe créé. Le téléchargement officiel du plugin CLI tools 0.20.0 est bloqué sur `stripe.jfrog.io`, domaine ajouté au nouveau brouillon sans publication. Le planner n’a pas encore produit de plan ; ces observations remplacent les anciens blocages d’injection de clé et d’accès à dashboard.stripe.com.

### Contrôle Stripe suivant — 15 novembre 2026

La valeur liée à `STRIPE_SECRET_KEY_TEST` a été corrigée : lecture seule de `/v1/balance` réussie, `livemode: false`. L’authentification serveur en mode test est vérifiée ; aucun objet Stripe créé ni paiement effectué. Le plugin CLI tools est maintenant bloqué uniquement au téléchargement redirigé vers `jfrog-prod-usw2-shared-oregon-main.s3.amazonaws.com`. Ce domaine a été ajouté au nouveau brouillon sans publication. Ces faits remplacent le précédent diagnostic de clé publique. Le plan officiel reste non généré.

### Planificateur CLI installé — 15 novembre 2026

Le plugin officiel Stripe tools 0.20.0 est installé avec `XDG_CONFIG_HOME=/workspace/.stripe-config`. Le planner refuse localement le marqueur de secret du proxy (`credential_resolution_failed`), bien que la clé réelle fonctionne pour l’API. La voie officielle de connexion navigateur `stripe login --non-interactive` exige `access.stripe.com`, domaine ajouté au brouillon sans publication. Le propriétaire a explicitement choisi de conserver le planificateur CLI plutôt que de passer cette étape. Après application du réseau, lancer la connexion, obtenir la validation du propriétaire via le lien officiel et suivre next_step. Ne pas contourner la validation des clés ni extraire le secret du proxy. Aucun plan accepté ni encaissement effectué.

### Stripe : plan accepté et pilote implémenté — 15 novembre 2026

La connexion officielle CLI a été approuvée en mode test. Le planner a généré et accepté le guide `iguide_61VlOAzo20DlZaZ8V41R1bnaGRieM` (`status: accepted`). La réponse officielle est dans `docs/stripe-plan.json` et les adaptations/limites dans `docs/stripe-plan.md`. Ces faits remplacent les anciens blocages de planification.

SDK Stripe 23.1.0 ajouté. Parcours `/premium/stripe-test`, API checkout/webhook/status et commandes sur disque hors dépôt, strictement locaux, non exposés en production. Montant serveur 457 centimes EUR, idempotence de création, vérification de signature, mode test et session/commande/montant/devise, événements asynchrones et expiration. Le retour navigateur n’attribue rien. UTC reste une convention technique, sans reconduction automatique ni invitation Telegram.

Validation : 86 tests, lint et build réussis. Vraies sessions de test créées/lues puis expirées sans débit, retry vers la même session, état rechargé depuis un processus distinct, webhook synthétique signé rapproché avec Stripe, routes fermées en production. La réception d’événements externes est encore bloquée par le réseau WebSocket sur `stripecli-ws-nw.stripe.com`, ajouté au nouveau brouillon sans publication. Paiement complet dans le navigateur non effectué. Pas d’encaissement réel ni de déploiement. Avant production : identité Telegram, stockage durable transactionnel, accès/retrait, règles commerciales et fiscalité. Les credentials OAuth restent hors dépôt, sous permissions restrictives ; ne jamais les imprimer.

### Suite Premium : stockage durable préparé — 15 novembre 2026

Le propriétaire confirme que les nouvelles saisons 7 à 12 de The Big Bang Theory apparaissent sur le site : la synchronisation fonctionne dans son observation. Il indiquait alors que le canal Premium privé n’était pas encore créé ; il a depuis confirmé sa création et l’ajout du bot comme administrateur (voir le dernier contrôle ci-dessous).

Le module `src/lib/premium-redis.ts` prépare les commandes et confirmations atomiques sur Redis REST existant, isolées du catalogue public et entre test/réel. Identité Telegram numérique vérifiée exigée par le contrat d’appel ; session/paiement uniques ; confirmation idempotente ; aucun repli local. Pas encore raccordé aux routes ni à l’authentification : le pilote reste local, sans accès Telegram réel. Aucun renouvellement ou cumul anticipé inventé.

90 tests habituels + 8 tests d’intégration sur un vrai Redis 7.4.6 isolé réussis, dont 24 confirmations concurrentes, refus de réutiliser un paiement, séparation test/réel et échéance exacte. Lint et build réussis. Détails et reproduction dans `docs/payments.md`. Aucun secret Redis/bot injecté dans cette machine ; ne pas supposer ceux de Vercel absents. Avant raccordement réel : créer le canal privé et configurer le bot, authentifier l’utilisateur, brancher ce stockage et valider la livraison des webhooks Stripe après application du domaine réseau déjà préparé. Aucune publication ni modification des données de production.

### Canal privé créé et bot ajouté — 15 novembre 2026

Le propriétaire confirme que le canal privé est créé et que @Thebrowser365_bot a été ajouté comme administrateur après demande des permissions d’invitation et de restriction. Ce sont ses confirmations, pas encore une vérification API. Le script `scripts/check-premium-channel.mjs` contrôle en lecture seule getMe/getChat/getChatMember, le caractère privé et distinct du canal public et les deux permissions ; il n’envoie aucun message, ne crée aucun lien et ne modifie aucun webhook.

Le contrôle réel est bloqué par l’absence de `TELEGRAM_BOT_TOKEN` et `TELEGRAM_PREMIUM_CHANNEL_ID` dans cette machine. Le besoin de secret vers api.telegram.org et les variables d’identifiants ont été ajoutés au brouillon, sans publication. L’identifiant public suggéré reste -1004339801492. Les valeurs doivent être renseignées dans les paramètres sécurisés, pas dans le chat. 94 tests habituels et lint réussis ; le script a été testé avec des réponses API simulées, pas avec le canal réel.

### Canal Premium vérifié par API — 15 novembre 2026

Après publication, `NODE_USE_ENV_PROXY=1 node scripts/check-premium-channel.mjs` réussit. Le bot @Thebrowser365_bot est administrateur du canal privé `-1003958043288`, distinct du canal public ; `can_invite_users` et `can_restrict_members` sont tous deux vrais. Le résultat indique `ready: true`. La vérification a utilisé uniquement getMe/getChat/getChatMember : aucun message envoyé, aucune invitation créée et aucun webhook modifié. Cette observation remplace l’ancien statut de permissions non vérifiées. La connexion de l’identité client au site et le raccordement des abonnements restent à réaliser.

### Identité Telegram et commandes Redis raccordées dans le code — 15 novembre 2026

Suite à « fais le », la connexion via lien temporaire du bot et confirmation privée explicite est implémentée. Les sessions navigateur sont aléatoires, HttpOnly, SameSite=Lax et Secure en HTTPS, hachées dans Redis ; demande valable dix minutes, code consommé une fois, compte confirmant identique à celui de la demande, session révocable de 24h. Origine des POST contrôlée par SITE_URL ; données test/réel séparées. Le bot utilise le webhook existant après vérification de son secret ; le script de configuration ajoute seulement les types nécessaires lorsque le drapeau est activé.

Les routes Stripe de test imposent cette identité, utilisent désormais Redis pour les commandes et confirmations atomiques, et réservent la consultation au propriétaire. Le prix et l’identité JSON client sont ignorés. L’ancien stockage fichier a été retiré ; aucun ancien fichier de données de la machine n’a été supprimé. Les invités et retraits réels du canal ne sont pas encore implémentés.

99 tests habituels + 12 tests Redis réel + 1 test HTTP de bout en bout avec Next.js/Redis réel et API Stripe simulée réussis, lint et build réussis. Le test confirme aussi la réception du canal public. Aucun message Telegram réel, aucune modification de webhook, aucun déploiement, aucun encaissement réel effectué. Le parcours réel attend les accès Redis et le déploiement du code ; le propriétaire ne sait pas encore retrouver l’adresse de sa base, le guider dans Vercel/Upstash sans demander le jeton dans le chat. Le brouillon déclare SITE_URL, PREMIUM_ENVIRONMENT=test, PREMIUM_TELEGRAM_AUTH_ENABLED=0 et KV_REST_API_URL ; ne pas activer le drapeau avant le déploiement et la configuration. Voir docs/payments.md pour l’ordre précis.

### Adresse Redis configurée — 15 novembre 2026

Après publication, KV_REST_API_URL est injectée et pointe vers poetic-martin-248299.upstash.io. KV_REST_API_TOKEN n’est présent ni dans le processus ni parmi les liaisons de secrets actives lors du contrôle. Le diagnostic de stockage échoue donc avant tout appel Redis ; aucune donnée n’a été lue ou modifiée. Le besoin de secret KV_REST_API_TOKEN vers ce seul hôte a été ajouté au nouveau brouillon, sans publication. Le propriétaire doit y associer le REST TOKEN depuis Upstash via les paramètres sécurisés, jamais dans le chat. Reprendre ensuite scripts/check-premium-storage.mjs en lecture seule.

### Redis accessible après configuration du jeton — 15 novembre 2026

Après publication, le diagnostic `NODE_USE_ENV_PROXY=1 node scripts/check-premium-storage.mjs` réussit : ready=true, environment=test, read=true, scripting=true, writes=false. L’authentification Redis REST et l’exécution d’un script Lua de lecture sont donc vérifiées sur la base configurée, sans modification des données. Ce résultat remplace le blocage du jeton manquant. Le nouveau code applicatif reste à déployer sur Vercel avant activation de la connexion Telegram et ajustement additif des notifications du webhook. Aucun paiement ni accès Premium réel activé.

### Déploiement demandé — 15 novembre 2026

Le propriétaire a explicitement demandé de déployer puis vérifier le parcours. Le dépôt de travail est synchronisé avec origin/main avant les nouveaux commits ; le test de permission de push est réussi (dry-run, sans création de branche distante). Les changements applicatifs doivent être poussés sur main pour l’intégration Git Vercel existante, en gardant les paiements réels fermés et l’authentification désactivée tant que ses paramètres Vercel ne sont pas vérifiés. Les compétences/outils locaux `.agents/` et `skills-lock.json` ne font pas partie du code à déployer.

Le réseau de la machine bloque encore api.github.com et the-browser-one.vercel.app ; ces deux domaines ont été ajoutés au nouveau brouillon pour le suivi du déploiement. Sauvegarde du brouillon seulement, sans publication par l’agent. Une poussée Git ne constitue pas à elle seule la preuve d’une compilation ou d’un déploiement Vercel réussi. L’activation réelle de la connexion demande les paramètres Vercel et le secret existant du webhook Telegram ; ce secret n’est pas injecté ici.

### Code poussé sur main — 15 novembre 2026

Le commit applicatif `d482240472b6ff1088fe7769d5c57cdc4d04a410` (Premium, identité Telegram, Redis et pilote Stripe) a été poussé avec succès sur `origin/main`, sans force-push. Avant push : 99 tests, 12 tests Redis, 1 test HTTP, lint et build réussis ; contrôle des fichiers indexés sans motif de secret détecté. Les compétences installées `.agents/` et `skills-lock.json` restent locales, non incluses dans ce commit.

Le statut du déploiement Vercel n’est pas confirmé : le proxy bloque encore le site public et api.github.com dans la machine actuelle. Leurs autorisations sont sauvegardées dans le nouveau brouillon, à appliquer par l’utilisateur. La connexion Telegram sur le site n’a pas été activée ni testée en réel ; les paramètres Vercel et le secret existant du webhook restent à vérifier. Aucun paiement réel ni modification des membres ou du webhook Telegram.

### Reprise du 16 novembre 2026

Le propriétaire a demandé de continuer. Le commit d482240 est toujours la pointe distante de main. Le site renvoie encore un refus CONNECT 403 du proxy : la politique effective de la machine n’autorise ni the-browser-one.vercel.app ni api.github.com, alors que les deux domaines sont déjà présents dans le brouillon. Ne pas réenregistrer les mêmes changements : l’utilisateur doit appliquer/publier le brouillon existant. Aucun nouveau déploiement, paiement ou changement de webhook effectué. Les accès Redis et bot restent liés ; VERCEL_TOKEN et TELEGRAM_WEBHOOK_SECRET ne sont pas injectés dans cette machine. Ne pas confondre leur absence ici avec leur configuration sur Vercel.

### Webhook Telegram : erreur 403 et correction — 16 novembre 2026

Le diagnostic getWebhookInfo confirme l’URL attendue, les types channel_post/edited_channel_post, une livraison en attente et une erreur récente « Wrong response from the webhook: 403 Forbidden » (2026-11-16T07:55:21Z). Aucun contenu de mise à jour n’a été lu ; ne pas supprimer le webhook ou ses livraisons pour enquêter.

Le code avait un défaut identifié : après validation du secret, toute publication d’un autre canal renvoyait 403 et pouvait donc provoquer des retries, alors que le bot administre aussi le canal Premium. La route acquitte désormais ces mises à jour authentiques avec HTTP 200/ignored, sans les stocker. Le canal public conserve sa logique et un mauvais secret reste refusé avec HTTP 401. Le contenu exact de la livraison en attente reste inconnu ; ne pas affirmer que sa cause est prouvée avant vérification après déploiement.

La correction du webhook a été poussée sur origin/main dans le commit db30bb5. 99 tests, test HTTP de parcours complet, lint et build réussis. Le déploiement Vercel et la disparition de la livraison en attente restent à confirmer après application des autorisations réseau déjà enregistrées dans le brouillon. Aucun changement de configuration Telegram effectué.

### SasPay raccordé au pilote de test — 16 novembre 2026

Le propriétaire demande l’activation de la connexion Telegram et le raccordement SasPay. Le contrôle GitHub confirme le succès Vercel pour db30bb5 ; /premium est accessible, mais la connexion Telegram reste désactivée sur le site (session 404). Cela remplace l’ancien statut de déploiement non confirmé pour ce commit.

SasPay est maintenant implémenté dans le code : paiement direct idempotent, 3000 XAF serveur, réseaux MTN/Airtel CG découverts via l’API, compte Telegram propriétaire, signature HMAC et vérification réelle du paiement avant confirmation Redis. Le pilote reste fermé par défaut et en production. Stripe/SasPay peuvent être essayés en prévisualisation Vercel explicitement configurée, dans l’espace test uniquement. La clé SasPay de production n’a pas été utilisée ; aucune clé SasPay n’est injectée ici. Tests avec prestataire simulé uniquement, pas de paiement SasPay réel. Voir docs/saspay.md pour les garanties et limites (dont la reprise d’un paiement direct confirmé avant liaison locale).

La CLI Vercel est installée via npx mais non authentifiée ; la connexion échoue au réseau vers vercel.com. Les domaines vercel.com/api.vercel.com ont été ajoutés au nouveau brouillon. Les besoins de secrets SASPAY_API_KEY_TEST (SANDBOX/PAYIN), SASPAY_WEBHOOK_SECRET et le secret Telegram existant sont préparés en brouillon, sans valeurs ni publication. Ces secrets doivent être configurés sur les serveurs sécurisés ; le marqueur de proxy n’est pas une clé de test brute utilisable localement par le client SasPay. Ne pas contourner ce refus de mode. Aucun paramètre Vercel, webhook ou membre Telegram n’a été modifié pendant cette étape.

### Raccordement SasPay poussé et déployé — 16 novembre 2026

Le commit 7bc64bae28a379a962c1028179cf4bb5a9d7dd53 a été poussé sur origin/main. Le statut GitHub Vercel de ce commit est success. Validations : 107 tests habituels, 12 tests Redis, test HTTP Telegram/Stripe/SasPay, lint et builds production/prévisualisation réussis. Aucun paiement SasPay réel, appel Mobile Money réel, invitation ou retrait de membre effectué. Le pilote n’est ouvert qu’en développement ou prévisualisation explicitement configurée, jamais sur la production.

L’activation Telegram n’est pas faite : accès CLI Vercel non autorisé et bloqué au réseau vers vercel.com/api.vercel.com, autorisations déjà sauvegardées dans le nouveau brouillon. Les champs de secrets test SasPay, signature SasPay et secret Telegram existant ont été préparés, mais leurs valeurs sont absentes. Après publication des paramètres nécessaires, reprendre la connexion officielle Vercel, vérifier le projet existant, activer la connexion et ajouter les notifications privées sans remplacer l’URL du webhook public. Ne pas redemander les accès Redis/bot déjà vérifiés.

### Rotation Telegram autorisée et préparée — 16 novembre 2026

Le propriétaire confirme ne pas pouvoir récupérer TELEGRAM_WEBHOOK_SECRET et demande de procéder à la connexion Vercel/rotation. Le réseau effectif n’autorise toujours pas vercel.com/api.vercel.com, pourtant déjà dans le brouillon ; la connexion CLI échoue avant de fournir un lien. Ne pas réappliquer les mêmes règles ni demander l’ancien secret à nouveau.

Le code accepte une valeur NEXT temporaire en plus de la valeur actuelle, y compris pour le diagnostic et la revalidation. Le script de bascule exige --register --rotate-secret et vérifie l’acceptation du nouveau secret par le site avant toute écriture Telegram. Un nouveau secret aléatoire est préparé dans /workspace/.premium-telegram-rotation.json, hors dépôt, mode 600, applied=false ; ne jamais afficher ce fichier ou sa valeur. Le lire seulement dans le code qui configurera les services autorisés. Ne pas supposer la rotation appliquée : aucune valeur Vercel, aucun webhook et aucun membre n’ont été modifiés. Tests unitaires (109), intégration HTTP, lint et build réussis après correction du protocole RESP2 de l’adaptateur Redis de test pour le diagnostic HGETALL.

Le propriétaire propose la création de clé SasPay via merchant-api-keys : la documentation confirme environment=SANDBOX, scope=PAYIN pour notre usage. Elle exige le JWT de connexion dashboard, pas la clé sk_live ; ne pas demander le JWT ou une clé dans le chat. Le secret sk_test retourné n’est visible qu’une fois et devra être enregistré dans les paramètres sécurisés SASPAY_API_KEY_TEST. Aucun appel de création de clé n’a été effectué.

## Skill SasPay installée — 16 novembre 2026

Fichier fourni par le propriétaire installé sans modification dans `.agents/skills/saspay-integration/SKILL.md` (nom déclaré : `saspay-integration`). Installation locale uniquement, sans publication. Ses exemples utilisant api.saspay.me avec sk_test_ ne remplacent pas la décision sandbox ci-dessus : conserver sandbox-api.saspay.me et aucun repli production. La compétence constitue une référence technique, pas une autorisation de paiement, de retrait ou de mise en production.

## Connexion Vercel réussie — 16 novembre 2026

CLI 65.16.0 installée dans /workspace/.vercel-tools/bin, session OAuth vérifiée avec whoami. Projet existant manuels-projects-d0a3bea0/the-browser lié localement. Variables Production Telegram/Redis/TMDB présentes (noms uniquement inspectés). link a créé .env.local ignoré, mode 600, avec jeton OIDC ; ne jamais afficher son contenu. Compétences officielles vercel-labs/agent-skills installées localement après échec du plugin (dossier utilisateur non modifiable). MCP global vercel configuré dans /home/agent/.codex/config.toml après autorisation du système ; OAuth non réalisé et list_teams non testé : mcp.vercel.com refusé par le proxy. Domaine ajouté au nouveau brouillon, pas publié. Aucun déploiement, paiement ni changement du webhook effectué. Les variables Premium ne sont pas encore configurées sur Vercel.

### OAuth MCP Vercel terminé — 16 novembre 2026

La redirection OAuth a été transmise au processus CLI local et celui-ci confirme Successfully logged in to MCP server vercel. Cette réussite remplace le blocage réseau/OAuth précédent. Les outils MCP ne sont pas encore exposés dans le chat courant ; search_vercel_documentation et list_teams restent non vérifiés. Ne pas confondre la connexion réussie avec un test des outils. Aucun déploiement ni changement du webhook effectué. Aucun code OAuth ni credential enregistré dans la mémoire.

### Compte sandbox confirmé par le propriétaire — 16 novembre 2026

Le propriétaire confirme un compte sandbox séparé et une clé enregistrée sous SASPAY_API_KEY_TEST. Présence de la variable vérifiée sans affichage de sa valeur ; elle ne figurait pas parmi les secrets proxy listés. Aucun test authentifié réalisé : sandbox-api.saspay.me est refusé par le proxy (CONNECT 403). sandbox-api.saspay.me et sandbox-checkout.saspay.me ajoutés au brouillon, sans publication. Ne pas redemander une nouvelle clé ni basculer sur api.saspay.me.

### SasPay sandbox accessible et clé vérifiée — 16 novembre 2026

Requêtes backend de lecture sur https://sandbox-api.saspay.me/api/v1 : /countries/ et /pricing/my-rates/ répondent HTTP 200 success=true. Le connecteur saspayTestClient().networks() fonctionne avec la clé configurée et renvoie les réseaux actifs CG airtel_cg (Airtel Congo Brazzaville) et mtn_cg (MTN Congo Brazzaville). Cela remplace le précédent blocage réseau et valide la lecture authentifiée du sandbox ; pas un encaissement, ni une preuve de disponibilité production. Aucune création de paiement ni changement du webhook effectué. Scénarios sandbox et livraison webhook restent à tester.

### Essais externes SasPay sandbox — 16 novembre 2026

Tests autorisés sur sandbox-api.saspay.me uniquement, données client fictives +242, montant serveur 3000 XAF. MTN numéro finissant par 0 : création réussie, verify SUCCESS, rapprochement strict verifiedSasPayResult confirmé (montant/type/sens/description/date). Airtel finissant par 1 et MTN finissant par 2 : softpay renvoie HTTP 422, success=false, code client_fault, sans ID à vérifier dans cette réponse ; ne pas prétendre avoir observé verify FAILED ou un code spécifique solde insuffisant. Airtel finissant par 9 : création HTTP 201 PENDING, verify HTTP 200 PENDING. Ce dernier statut observé ne prouve pas une attente indéfinie. Les requêtes diagnostiques ont utilisé de nouvelles intentions/idempotency keys, pas des retries aveugles. Aucun paiement réel, droit Redis/Telegram, invitation, déploiement ni changement de webhook. Livraison externe du webhook et parcours navigateur restent non vérifiés.

### Séparation des secrets webhook SasPay — 16 novembre 2026

Le propriétaire confirme avoir enregistré les secrets test et live. Le pilote utilise exclusivement SASPAY_WEBHOOK_SECRET_TEST, pour la réception du webhook et le prérequis de création du paiement. SASPAY_WEBHOOK_SECRET reste réservé au live et ne sert jamais de repli pour les tests. Exemple de configuration et documentation actualisés. Modification locale, sans publication ni changement de webhook distant.

### Prévisualisation SasPay déployée — 16 novembre 2026

Vercel CLI OAuth vérifiée. Variables SASPAY_API_KEY_TEST et SASPAY_WEBHOOK_SECRET_TEST transférées sans affichage vers Preview uniquement ; PREMIUM_ENVIRONMENT=test, SASPAY_TEST_ENABLED=1 et PREMIUM_TELEGRAM_AUTH_ENABLED=0 configurés pour Preview. Production inchangée. Déploiement dpl_aaWaDCWbGjiPq4UgEdXASP9UsQDA confirmé Ready sur https://the-browser-ct93diwel-manuels-projects-d0a3bea0.vercel.app. .vercelignore ajouté pour exclure compétences locales et fichiers .env du transfert (inspection dry : 85 fichiers). Le projet protège les previews (ssoProtection all_except_custom_domains). Une exception ciblée pour ce domaine est nécessaire avant réception des webhooks ; protection non modifiée. Domaine ajouté au brouillon réseau cloud, pas publié. La requête webhook depuis cloud reste bloquée CONNECT 403, donc pas de livraison externe validée. Connexion Telegram désactivée dans la preview jusqu’à configuration coordonnée ; pas d’accès premium réel. Prochaine action : exception Vercel pour ce seul domaine et application réseau cloud, puis test webhook signé et livraison SasPay.

### Réception webhook test vérifiée et URL SasPay à corriger — 16 novembre 2026

La prévisualisation est accessible : POST webhook.test signé localement avec SASPAY_WEBHOOK_SECRET_TEST renvoie HTTP 200 ; mauvaise signature HTTP 400. Ce test est synthétique, pas une livraison SasPay. Lecture du compte sandbox : un webhook actif SANDBOX vise https://the-browser-one.vercel.app/webhooks/saspay, différent de la route déployée. 12 abonnements et zéro journal renvoyés par les listes consultées. Le propriétaire doit modifier l’URL depuis le tableau de bord sandbox vers https://the-browser-ct93diwel-manuels-projects-d0a3bea0.vercel.app/api/saspay/test/webhook ; création/modification non disponible par clé API selon documentation. Ne pas toucher au webhook live ni régénérer le secret pour une simple modification URL. Aucune configuration distante changée pendant ce contrôle.

### Webhook SasPay recréé : livraison reçue mais signature refusée — 16 novembre 2026

Le propriétaire a supprimé/recréé le webhook et indique publication. Lecture sandbox : webhook actif SANDBOX à l’URL de preview attendue. Signature synthétique avec la variable cloud SASPAY_WEBHOOK_SECRET_TEST acceptée HTTP 200 par le déploiement actuel. Nouveau paiement sandbox MTN SUCCESS vérifié, sans droits ni commande Redis créée. Journaux SasPay transaction.created/success de ce paiement : cible correcte, HTTP 400, réponse indiquant erreur de signature/horodatage. La livraison externe atteint donc l’application mais n’est pas authentifiée ; ne pas annoncer réussite. Hypothèse principale : signing_secret du webhook recréé différent de la valeur cloud/déploiement (celle-ci fonctionne toujours en test synthétique). Confirmer l’enregistrement sécurisé de la nouvelle valeur TEST avant synchronisation Vercel/redéploiement ; autre hypothèse à contrôler si les secrets concordent : format de signature fournisseur. Aucune désactivation du contrôle, aucune configuration live changée.

### Contrôle après confirmation du nouveau secret — 16 novembre 2026

Le propriétaire reconfirme secret et URL. Le secret actuellement injecté est accepté par le déploiement existant (webhook.test synthétique HTTP 200), donc aucune désynchronisation cloud/Vercel observée ; ne pas demander de ressaisir le secret sans nouvel élément. Nouveau paiement sandbox MTN vérifié SUCCESS ; notifications externes transaction.created/success encore HTTP 400. Documentation webhooks officielle relue : HMAC-SHA256(secret brut, timestamp.corps brut), conforme au code. Cause non établie : divergence avec le signing_secret actif SasPay, headers/horodatage ou signature émise. Ne pas attribuer avec certitude un bug fournisseur ni désactiver les contrôles. Un diagnostic des en-têtes reçus ou vérification SasPay est nécessaire. Pas de redéploiement ni rotation supplémentaire effectué.

### Diagnostic signature : limite des journaux et rapport préparé — 16 novembre 2026

Détail GET /webhook-logs/{id}/ consulté : pas de request_headers ni signature/timestamp. Valeur cloud du secret sans espaces de bord ni guillemets ajoutés, sans affichage de valeur. Rapport sans secrets préparé dans docs/saspay-support-signature.md pour vérification fournisseur. Aucun message externe envoyé. Cause toujours indéterminée ; pas de changement de signature, rotation ou déploiement arbitraire.

### Connexion Telegram activée et webhook basculé — 16 novembre 2026

Le propriétaire autorise la configuration Telegram puis le parcours Stripe test. Production existante f3fdeda confirmée Ready avant action. Paramètres Production SITE_URL=https://the-browser-one.vercel.app, PREMIUM_ENVIRONMENT=test, PREMIUM_TELEGRAM_AUTH_ENABLED=1 et canal Premium configurés. Déploiement dpl_8Mx3WFoygXhPtVWZtAeF5uqMFTBm réussi. Nouveau secret NEXT accepté par diagnostic avant setWebhook. Script --register --rotate-secret effectué : URL publique inchangée, drop_pending_updates=false, anciennes souscriptions préservées, message/callback_query ajoutés. getWebhookInfo confirme zéro attente et aucune erreur. Tests HTTP réels : session anonyme 200, start 200 avec lien bot correct et cookie HttpOnly, logout 200 ; Stripe/SasPay test POST restent 404 en Production. Aucune confirmation de compte utilisateur simulée, aucun paiement réel ou invitation/retrait.

Secret principal Vercel mis à jour avec la nouvelle valeur, NEXT retiré du paramétrage ; redéploiement de nettoyage dpl_DgtC45njGBj5z9Nq7zF4S11orAUZ lancé. Secret conservé hors dépôt dans /workspace/.premium-telegram-rotation.json (applied=true). Ne jamais afficher ce fichier. L’utilisateur doit encore effectuer Démarrer/Confirmer ma connexion depuis /premium ; validation complète humaine non réalisée. Stripe navigateur reste à préparer ensuite sur une prévisualisation configurée, pas sur les routes de test fermées en Production.

Le déploiement de nettoyage dpl_DgtC45njGBj5z9Nq7zF4S11orAUZ est confirmé Ready et affecté au domaine public. L’ancien secret n’est plus dans la configuration Production ; seul le nouveau secret principal subsiste.

### Confirmation Telegram humaine vérifiée — 16 novembre 2026

Le propriétaire indique avoir confirmé. Lecture Redis par SCAN/GET sans affichage des identifiants : une session test connected, zéro pending. Connexion Telegram réelle validée côté serveur. Préparation Stripe : Vercel Preview ne contient ni STRIPE_SECRET_KEY_TEST ni STRIPE_WEBHOOK_SECRET. Variable cloud STRIPE_SECRET_KEY_TEST présente mais proxy-backed (pas une clé brute sk_test_), ne pas copier ce marqueur vers Vercel ni extraire la clé du proxy. Demander la configuration de la clé Stripe test directement dans les paramètres sécurisés Vercel Preview, pas dans le chat. Aucun paiement Stripe navigateur encore validé.

### Stripe Preview configuré — 16 novembre 2026

La clé ajoutée par le propriétaire était affectée à Production. Affectation changée par PATCH Vercel target=[preview], sans lire/afficher sa valeur. Alias stable réservé : the-browser-premium-test-manuels-projects-d0a3bea0.vercel.app. Webhook Stripe test we_1UcWl5R1bnaGRieMQoPpuGta créé avec la clé cloud après balance livemode=false, événements checkout.session.completed/async_payment_succeeded/async_payment_failed/expired ; secret hors dépôt dans /workspace/.stripe-preview-webhook.json, mode600, puis configuré comme STRIPE_WEBHOOK_SECRET dans Vercel Preview. SITE_URL de l’alias, STRIPE_TEST_CHECKOUT_ENABLED=1 et PREMIUM_TELEGRAM_AUTH_ENABLED=1 configurés en Preview. Même base Redis et bot public pour la confirmation Telegram, cookies séparés par origine. Pas de partage de session navigateur automatique entre site public et preview.

Redéploiement preview dpl_9jL7y9wgoeLRV3NuJcGcXBiwdwZt lancé depuis la source du pilote SasPay existant ; attente Ready puis alias. Domaine stable ajouté au brouillon réseau cloud, non publié. L’exception de protection Vercel de l’ancien domaine ne couvre pas automatiquement ce nouvel alias : vérifier/ajouter exception ciblée avant Stripe. Paiement navigateur toujours non effectué ; pas d’accès Premium réel.

Déploiement Stripe Preview dpl_9jL7y9wgoeLRV3NuJcGcXBiwdwZt confirmé Ready ; alias stable affecté avec succès. Réception webhook Stripe et parcours navigateur restent non vérifiés avant accès réseau/protection.

### Prévisualisation Stripe accessible — 16 novembre 2026

Alias stable https://the-browser-premium-test-manuels-projects-d0a3bea0.vercel.app accessible sans redirection : /premium/stripe-test et /api/premium/auth/session HTTP 200. Webhook Stripe : signature synthétique avec secret configuré HTTP 200, signature invalide HTTP 400. Cela valide réception/secret local, pas une livraison Stripe réelle ni un paiement navigateur. Prochain contrôle humain : connexion Telegram sur cette origine (session distincte du site public), Checkout à 4,57 EUR avec carte Stripe de test, puis vérifier commande Redis et événement Stripe. Aucun débit réel et aucun accès canal attribué.

### Paiement Stripe navigateur validé — 16 novembre 2026

Après confirmation du propriétaire, lecture Redis et Stripe réelle : une commande Stripe test, statut Redis confirmed, montant457 centimes EUR. Session Stripe complete, payment_status paid, livemode=false, montant/devise et client_reference_id conformes. Période enregistrée du 16 novembre 2026 à 21:17:09 UTC au 16 décembre 2026 à 21:17:09 UTC. Test réussi sans argent réel. Cela valide le parcours navigateur et la confirmation serveur ; ne prouve pas à lui seul que la confirmation vient du webhook plutôt que du polling statut. Aucun accès Telegram privé accordé par le pilote. Invitations/retraits, paiements production et règles commerciales restent hors activation.

### Admission et expiration Telegram préparées — 16 novembre 2026

Service premium-channel-access.ts, routes POST /api/premium/access et /api/premium/access/expire, bouton conditionnel et traitement chat_join_request ajoutés localement. Drapeau PREMIUM_TELEGRAM_ACCESS_ENABLED=0 par défaut ; activation exige environment live, jamais les commandes test. Invitation courte à demande d’adhésion liée au compte authentifié ; vérification des paiements réels et dates ; retrait ban/unban récupérable, administrateurs protégés, autre période active respectée. Stockage Redis durable, verrous par utilisateur et confirmation live différée pendant retrait. Voir docs/premium-channel-access.md pour limites, configuration et ordonnanceur encore à raccorder. Aucun lien réel, admission, retrait, modification de webhook distant ni déploiement de ce service. Les pilotes de paiement live restent à développer/valider avant activation ; ne pas transformer le paiement Stripe test précédent en droit réel.

Validation de cette préparation : suite habituelle passée (117 tests avant le dernier scénario ajouté), 9 scénarios du service passés après ce scénario, intégration Redis réel et parcours HTTP passés (14 résultats dans la commande combinée), nouveau contrôle HTTP des routes test passé, lint sans erreur (17 avertissements dans les compétences Vercel locales), build réussi. Aucun test distant des mutations Telegram effectué.

### Canal dédié aux essais identifié — 16 novembre 2026

Le propriétaire fournit https://t.me/c/4423200257/2 : canal privé de test -1004423200257. Vérifications getMe/getChat/getChatMember : bot attendu administrateur avec invitation/restriction, canal distinct du commercial. Le compte authentifié disponible est creator de ce canal : il ne peut pas servir au test de retrait. Prévoir un autre compte Telegram non administrateur, authentifié par le parcours existant, avant de tester admission/expiration. Aucune invitation ni mutation de membre effectuée pendant ce contrôle. Ne pas remplacer TELEGRAM_PREMIUM_CHANNEL_ID commercial par cet ID : les essais doivent rester isolés.

Validation espace abonnement : 122 tests habituels et 15 résultats d’intégration Redis/HTTP réussis ; accès anonyme refusé, autre compte sans fuite, paramètres client propriétaire/environnement ignorés. Lint sans erreur (17 avertissements des compétences locales) et build réussis. Contrôle Chromium réel avec données simulées sur ordinateur/mobile : résumé actif, dates, renouvellement manuel, historique, absence de bouton réel en test, aucun débordement et effacement après déconnexion. Prévisualisation prévue sur l’alias de test existant ; pas de mise en production de ces pages commerciales incomplètes.

Prévisualisation espace abonnement : commit local 5ef8462, déploiement dpl_9xKs5Lrdshct1Vhy8qknbkMNTd5a confirmé Ready, alias de test existant réaffecté. Pages /mon-abonnement, /conditions, /remboursements et /support disponibles sur la prévisualisation uniquement. Production/main non modifiés par cette livraison ; le commit applicatif reste local, à pousser lors d’une livraison ultérieure autorisée. Identité vendeur et support non renseignés, pages explicitement préparatoires.

### Publication de l’espace abonnement autorisée — 16 novembre 2026

Le propriétaire demande explicitement de publier et déployer les changements de la prévisualisation. Livrer /mon-abonnement, conditions, remboursements et support sur le site public en conservant le caractère préparatoire des pages commerciales, les ventes fermées, le renouvellement manuel et les protections des paiements test. Les résultats de publication/déploiement seront vérifiés ensuite.

### Prévisualisation du design prête — 17 novembre 2026

Commit local 0981f9c, preview dpl_EJH5Gskq4UxTwgsugb1NuJn3Z5gP confirmée Ready et affectée à l’alias stable the-browser-premium-test-manuels-projects-d0a3bea0.vercel.app. Contrôle distant : accueil, Premium, mon-abonnement et conditions HTTP200, navigation partagée présente ; hero, affiches et CSS ambré chargent. Site public et main non modifiés pour cette refonte. Cache généré .next/dev ancien déplacé vers /tmp/the-browser-dev-cache-before-redesign, puis compilation CSS fraîche de développement vérifiée ; sources et données conservées. Prévisualisation prête pour revue utilisateur avant éventuelle publication Production.

### Motion design du hero — 17 novembre 2026

Le propriétaire approuve la refonte ambrée et demande des affiches tournantes pour les sorties phares de 2026 présentes dans le canal. Coverflow implémenté dans CinemaCarousel : sélection stricte année2026 + affiche + lien réel vers TheBrowser365 ou c/4339801492, dédupliquée, sans classement fictif ; 23 titres éligibles observés. Flèches/clavier/pause, progression, inclinaison au pointeur, entrée du texte. Pause hors écran/onglet masqué/survol/focus ; pas d’autoplay ni transitions avec mouvement réduit. État séparé pour ne pas rerendre la grille au rythme de l’animation. 124 tests passés ; ciblage sélection repassé après ajustement de casse des URLs ; lint sans erreur (17 avertissements locaux), build et vérifications visuelles/interactives Chromium réussis. Code destiné à la preview, Production et règles de paiement inchangées.

Preview motion : commit local f563014, déploiement dpl_Y13E4SA83GtnTATZy9exPnNMdzL8 Ready et alias de test réaffecté. Contrôle distant HTTP200, carrousel/sélection2026/commandes et CSS motion/mouvement réduit présents. Code non poussé sur main ; site public inchangé.


### Ergonomie du catalogue — 17 novembre 2026

Accord utilisateur pour poursuivre les améliorations : fiches détaillées partageables (dialogue natif), filtres recherche/type/genre/année/vue dans l’URL, Ajouts récents selon dernière publication Telegram valide, favoris À voir locaux à ce navigateur et navigation mobile inférieure. Métadonnées de saisons/épisodes exactes et provenance conservées. Aucun changement des paiements, droits ou ventes. 129 tests unitaires, build, lint sans erreur et essais Chromium ordinateur/mobile réussis. Prévisualisation à livrer sur l’alias existant ; main/Production non modifiés.

Livraison UX preview : commit local 4071be1, déploiement dpl_UNEbEEb1XjkLqJPgWpR33tpWVjN5 confirmé Ready, alias stable https://the-browser-premium-test-manuels-projects-d0a3bea0.vercel.app réaffecté. HTTP200 distant et présence fiches/ajouts récents/favoris/navigation mobile vérifiés. Parcours HTTP d’intégration Telegram→Redis→Stripe/SasPay réussi après arrêt du précédent serveur dev local qui verrouillait le démarrage. Production et main inchangés, commits non poussés.

### Rotation automatique demandée — 17 novembre 2026

Le propriétaire veut une rotation continue sans commande pause. Bouton pause supprimé ; survol, focus et navigation manuelle ne suspendent plus le défilement de 5,5s. Flèches conservées, focus redirigé avant masquage du lien actif. Mouvement réduit système respecté ; pause technique hors écran, onglet masqué ou fiche ouverte conservée. Build et lint sans erreur (17 avertissements locaux), Chromium valide rotation au survol et après navigation/focus, absence de pause et mouvement réduit. Preview dpl_ACre6a516o9EmxR3QFgiJ8gX8eSo Ready ; alias stable en cours de réaffectation. Production/main inchangés.

### Publication du design et de l’ergonomie — 17 novembre 2026

Le propriétaire autorise explicitement la publication et le déploiement de cette version. Commits de refonte, motion, fiches/favoris/filtres/navigation mobile et rotation sans pause poussés sur main jusqu’à d2a7e4c. Déploiement Production dpl_CZUHoszL6M22Q3DQpDRaWpqeWTBH confirmé Ready et associé à https://the-browser-one.vercel.app. Accueil, Premium, mon-abonnement et conditions HTTP200 ; carrousel, fiches, ajouts récents et navigation mobile présents, bouton pause absent. Règles de paiement et d’accès inchangées. Cette publication remplace les mentions « preview uniquement » des entrées de design précédentes.

### Nouveau canal de test de suppression — 17 novembre 2026

Le propriétaire fournit https://t.me/c/4375412351/2 comme canal Telegram de test pour la suppression. Identifiant Bot API correspondant : -1004375412351 (le /2 désigne un message). Cette destination remplace le canal de test précédemment communiqué -1004423200257 pour les prochains essais. Accès du bot, droits d’administration et présence d’un compte non administrateur à vérifier avant toute mutation. Aucun retrait effectué et aucune variable du canal Premium commercial modifiée à cette étape.

### Retrait Telegram réel dans le canal isolé validé — 17 novembre 2026

Après confirmation « c’est fait » du propriétaire pour l’essai, contrôles getMe/getChat/getChatMember : bot attendu administrateur du canal -1004375412351 avec invitation/restriction ; un seul compte connecté retrouvé via lecture Redis, membre non administrateur du canal. Service channelAccessService.expire exercé avec le bot réel et une fiche d’accès expirée simulée dans un stockage local isolé, sans commande ni écriture Redis de production. Résultat : member → banChatMember → unbanChatMember(only_if_banned=true) → left ; statut local expired. Deuxième expiration ignored sans nouvel appel de mutation. Compte retiré et non banni, réadhésion possible. Canal commercial et variables Vercel inchangés. Cela valide le retrait Telegram par le service, pas le cycle complet paiement/invitation ni le passage de cet essai par l’ordonnanceur GitHub/Redis durable.

### Invitation d’essai préparée — 17 novembre 2026

Le propriétaire autorise la suite admission/expiration dans le canal isolé -1004375412351. Bot et droits revérifiés ; compte de test précédent hors canal. Service invite exécuté avec fiche de paiement explicitement simulée en mémoire/fichier local uniquement, sans paiement ni écriture Redis ni changement des variables Production. Invitation réelle à demande d’adhésion créée, durée maximale dix minutes, destinée au seul compte de test. État privé et scripts hors dépôt : /tmp/browser-admission-test/state.json et prepare.mjs. Ne pas copier cette fixture dans Redis live. En attente du clic utilisateur et de sa demande : pas encore d’approbation ni cycle d’expiration planifié validé. Le webhook commercial reste inchangé et ne traite pas ce canal isolé ; l’approbation de cet essai doit être exercée par le service isolé, sans prétendre valider le routage webhook public. Lien non enregistré dans la mémoire.

### Admission et expiration courte réelles dans le canal isolé — 17 novembre 2026

Après confirmation du clic utilisateur, service join avec compte/lien enregistrés : approveChatJoinRequest réussi, getChatMember=member. Fixture de droit simulé strictement locale, échéance fixée à 25 secondes ; expire avant échéance=active sans retrait. Minuterie locale puis expire après échéance : révocation du lien, ban/unban, getChatMember=left, deuxième passage ignored. État final completed dans /tmp/browser-admission-test/state.json ; aucun lien ni identifiant privé copié ici. Bot réel et canal -1004375412351 uniquement ; aucun paiement, commande Redis live, changement Vercel ou canal commercial. Ce test valide admission et respect d’une échéance réelle courte par le service, avec minuterie locale et stockage fichier ; il ne valide pas le déclenchement GitHub, le routage webhook public de ce canal ni la chaîne paiement réel→droit durable.

### Contrôle de l’ordonnanceur de production — 17 novembre 2026

Suite autorisée par le propriétaire. Lecture GitHub : exécutions schedule 44015562578 (04:12:32 UTC) et 44091876913 (13:21:14 UTC) réussies, soit environ 9 h 09 entre les deux derniers départs observés malgré cron */5. La cadence effective de cinq minutes n’est donc pas validée ; ne pas promettre un retrait sous cinq minutes. Index Redis channel-access live SCARD=0 avant essai. Déclenchement manuel du workflow existant sur main : run 44113673005 terminé success, authentification OIDC et endpoint fonctionnent. Aucun membre réel traité/retiré, aucun droit fictif injecté, aucune configuration du canal commercial modifiée. L’essai du retrait via ordonnanceur avec membre réel de test reste à réaliser dans une infrastructure isolée ; le succès de cet index vide ne le remplace pas. Recommandation : ordonnanceur externe à cadence surveillée avant ouverture, endpoint existant POST /api/premium/access/expire avec secret PREMIUM_ACCESS_CRON_SECRET, pagination et contrôle failed nécessaires ; ou résoudre/mesurer la cadence GitHub. Aucun compte externe créé ni abonnement payant engagé.

### Préparation de l’ordonnanceur externe — 17 novembre 2026

Le propriétaire autorise à fiabiliser la cadence. Aucun jeton de service externe d’ordonnancement disponible ; question posée sur compte cron-job.org (création gratuite ou compte existant), réponse attendue. Endpoint POST /api/premium/access/expire/run préparé localement : authentification maintenance existante, activation live requise, verrou Redis global, checkpoint de pagination durable par lot, erreurs de cycle conservées, timestamp de dernier succès privé, 200 uniquement cycle complet sans erreur, sinon 503 (409 concurrent). GitHub existant inchangé. 134 tests passent dont cinq scénarios de balayage/reprise/erreur, lint sans erreur (17 avertissements des skills locales), build réussi. Ni nouveau secret généré ni compte externe créé, aucune tâche distante configurée ni modification de membre. Code non déployé à cette étape ; finaliser connexion/secret et test distant avant de déclarer la cadence corrigée.

### Endpoint externe livré, connexion cron-job.org en attente — 17 novembre 2026

Le propriétaire indique être connecté à cron-job.org. Outils de bureau absents malgré capacité remote_desktop annoncée ; pas d’accès à sa session. Clé CRONJOB_API_KEY demandée dans les paramètres sécurisés de l’environnement, jamais dans le chat. Accès api.cron-job.org et docs.cron-job.org bloqué par la politique courante ; domaines à autoriser par le propriétaire. Tentatives de mise à jour de brouillon rejetées par validation de schéma, aucun changement réseau/secrets cloud appliqué par ces appels.

Secret aléatoire PREMIUM_ACCESS_CRON_SECRET généré hors dépôt dans /workspace/.premium-expiration-cron-secret (0600), ajouté dans Vercel Production comme Secret, non affiché. Tous les commits locaux jusqu’à b2bc76d poussés sur main (premier essai git HTTP503, deuxième réussi). Déploiement Production dpl_6nPDmdGzwwdx91vHQownvKEcRiCK Ready, alias public confirmé. POST /api/premium/access/expire/run sans autorisation HTTP401 ; index live SCARD=0 avant essai autorisé, appel avec secret HTTP200 complete=true cursor=0 processed=0 failed=0. Aucun membre touché. Ordonnanceur externe pas encore créé/activé : attendre clé et accès réseau, consulter documentation officielle, créer une seule tâche et vérifier historique/cadence. GitHub existant conservé. Ne pas déclarer la cadence corrigée avant cette validation.

### Recontrôle SasPay après réponse support — 19 novembre 2026

Support renvoie vers documentation et configuration. Lecture actuelle de llms.txt, OpenAPI et api-reference/webhooks.md : HMAC-SHA256(secret brut, timestamp.corps brut), hex minuscule, horodatage Unix secondes régénéré à chaque tentative, tolérance300s et corps brut. Notre route utilise request.text avant JSON.parse et suit ces règles. Lecture API sandbox : webhook 6248c058-5a7c-476d-9631-01da64bd719f actif SANDBOX, URL historique preview /api/saspay/test/webhook ; abonnements created/success/failed/cancelled présents. Test synthétique webhook.test signé avec secret TEST disponible vers cette URL : HTTP200 received=true ignored=true ; signature invalide HTTP400. Aucun paiement ni accès créé. Journaux externes toujours 25 entrées, dernières livraisons du 16 novembre, HTTP400 ; aucune nouvelle livraison fournisseur observée le 19. Cela prouve le fonctionnement de notre vérification avec le secret configuré, pas son égalité avec le signing_secret actif SasPay (write-only) ni la conformité d’une livraison fournisseur fraîche. Prochaine action : renvoi manuel d’une livraison sandbox depuis tableau de bord, puis contrôler nouveaux journaux et idéalement les en-têtes réellement émis. Aucune rotation, redéploiement ni modification distante effectués.

### Renvoi SasPay contrôlé — 19 novembre 2026

Après confirmation utilisateur « fait », lecture seule webhook-logs sandbox : 30 entrées (25 avant), cinq nouvelles tentatives transaction.success pour transaction 584ed9ae-9a05-4e5c-ac0c-131b9b4a5832. Livraisons du 19 novembre vers 09:22:35–09:22:38 UTC, toutes HTTP400 « Signature ou horodatage invalide ». Dernière livraison c1dec6af-8733-477b-a57f-be2c63cca43a, attempt5, FAILED, sent_at 09:22:37.796040 UTC. Webhook inchangé 6248c058-5a7c-476d-9631-01da64bd719f. Le renvoi récent reproduit donc le rejet ; cela n’établit pas sa cause (secret/signature/en-têtes/horodatage). Ne pas confondre cette transaction renvoyée avec la transaction 6d5d372f-2288-4701-b56e-833bb2ffe40d citée auparavant. Aucune mutation SasPay ni déploiement effectué par l’agent.


### Cause technique du rejet HMAC identifiée — 19 novembre 2026

Demande explicite de diagnostiquer et régler. SASPAY_WEBHOOK_SECRET_TEST injecté dans le processus cloud est un marqueur technique de substitution (constaté sans afficher sa valeur). Comparaison distante contrôlée : HMAC calculé avec ce marqueur accepté HTTP200 à la fois par le déploiement historique ct93diwel et par l’alias stable Premium test ; HMAC avec clé aléatoire rejeté400. Cela établit que les deux previews utilisent le marqueur pour leur HMAC, pas une valeur brute issue du coffre. Les anciennes conclusions « secret synthétique accepté donc correctement synchronisé » sont retirées ; elles ne prouvaient que la même mauvaise valeur des deux côtés du test. Aucune preuve de bug SasPay établie.

API Vercel : variable TEST type sensitive, valeur vide/non déchiffrable par API ; ne pas interpréter le champ vide comme absence de variable ni tenter d’extraire le secret cloud via un service tiers. Action utilisateur demandée en parallèle : saisir le vrai SASPAY_WEBHOOK_SECRET_TEST directement dans Vercel Settings/Environment Variables/Preview, sans le partager en chat ; si perdu, rotation du seul webhook Sandbox nécessaire depuis SasPay. Ancienne URL de déploiement immuable à remplacer par l’alias stable après redéploiement.

Correctifs locaux : refus marqueurs techniques et valeurs vides avant HMAC, configuration invalide HTTP503, vérification du corps binaire exact avant JSON. Tests de régression sur marqueur même auto-signé et conservation UTF8/formatage, 136 tests passés ; lint sans erreur (17 avertissements compétences locales), build réussi et intégration HTTP Redis/Stripe/SasPay passée. Production, paiements réels et canal commercial inchangés ; test externe frais nécessaire après saisie de la vraie valeur.
