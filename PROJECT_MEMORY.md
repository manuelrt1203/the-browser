# Mémoire du projet — The Browser

Mise à jour : 16 novembre 2026. Ce document décrit les décisions du propriétaire et les résultats vérifiés. Il distingue le code livré, les observations en production communiquées par le propriétaire et les fonctionnalités encore à concevoir.

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
- **Tarif mensuel choisi le 15 novembre 2026 : 3 000 FCFA (XAF), avec le même prix en euros**. Équivalent arrondi au centime : **4,57 EUR** (1 EUR = 655,957 XAF). Le renouvellement manuel/automatique et la prise en charge des frais de paiement restent à définir. Aucun paiement réel n’est implémenté.
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
