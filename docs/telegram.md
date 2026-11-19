# Catalogue synchronisé avec Telegram

Site : https://the-browser-one.vercel.app/ — canal : @TheBrowser365 — bot : @Thebrowser365_bot.

## Fonctionnement

`POST /api/telegram` accepte les publications et leurs modifications du seul canal configuré, après vérification du secret Telegram. Les messages sont enregistrés séparément ; une modification remplace la contribution du message et le catalogue est dédupliqué avec la sélection manuelle. Un titre de la sélection manuelle reste présent même si un message Telegram le remplace.

Les liens TMDB sont reconnus directement. Pour les légendes ou noms de fichier, les marqueurs de saison, épisode et format sont retirés. Les titres déjà connus sont associés localement ; les autres sont recherchés via TMDB, avec correspondance exacte unique obligatoire. Les lignes ambiguës sont conservées dans `pending`, sans publication d’un résultat arbitraire. Le catalogue est rechargé à la prochaine lecture après invalidation du cache ; un onglet déjà ouvert doit être actualisé.

## Stockage durable sur Vercel

Connecter une base **Upstash Redis** au projet Vercel via Marketplace/Storage. Le backend accepte `KV_REST_API_URL` et `KV_REST_API_TOKEN`, ou `UPSTASH_REDIS_REST_URL` et `UPSTASH_REDIS_REST_TOKEN`. Utiliser la paire complète d’une seule convention, dans les environnements Vercel appropriés (Production, Preview si nécessaire). Ne jamais utiliser de préfixe `NEXT_PUBLIC_` pour les secrets.

Les publications sont stockées dans le hash Redis `the-browser:telegram:ID_DU_CANAL`. Un script Lua effectue comparaison de version et écriture atomiquement : les fonctions Vercel peuvent traiter des messages simultanément sans perte de mise à jour. Les retries et événements anciens ne remplacent pas une version plus récente. Les lectures utilisent `cache: no-store` au niveau REST ; le cache Next du catalogue est invalidé après chaque livraison acceptée.

Une indisponibilité Redis fait échouer le webhook en HTTP 503 pour permettre à Telegram de réessayer. **Aucun repli vers `/tmp` ni fichier local n’est autorisé sur Vercel.** Le fichier local reste disponible uniquement pour le développement sur une seule instance Node.

## Variables du projet

- `TELEGRAM_CHANNEL_ID=-1004339801492` (issu de l’export ; vérifié par le script via `getChat`).
- `TELEGRAM_WEBHOOK_SECRET` : secret réel côté serveur, aléatoire, de 1 à 256 caractères parmi lettres, chiffres, `_` et `-`.
- `TMDB_READ_TOKEN` : accès API TMDB.
- Paire de variables REST Redis ci-dessus.

Le script d’enregistrement demande également `TELEGRAM_BOT_TOKEN` et `SITE_URL=https://the-browser-one.vercel.app`. Le bot doit être administrateur du canal. Réutiliser le bot et les secrets existants lorsqu’ils sont déjà configurés. Les secrets de Vercel ne sont pas automatiquement disponibles dans cette machine cloud ; ne jamais les copier dans le dépôt ni les envoyer dans le chat.

## Import de l’historique

L’export fourni contient 855 publications du canal Streaming. Elles sont conservées localement dans `/workspace/telegram-data/telegram-catalogue.json`. Seul ce canal a été importé, sans lecture des autres conversations ni téléchargement des médias. L’import local a reconnu 472 références, soit 30 titres uniques ; les autres lignes restent à vérifier.

Pour importer les publications dans Redis, exécuter depuis la racine du dépôt avec les variables Redis et `TELEGRAM_CHANNEL_ID` injectées dans le processus :

```sh
node --experimental-strip-types scripts/import-telegram.mjs CHEMIN_EXPORT.json 4339801492
```

L’import ne remplace pas une publication plus récente déjà reçue par webhook. Un second passage est idempotent. L’export n’est pas versionné, et sa présence dans la machine de développement ne constitue pas un import en production.

## Activation et contrôle

1. Configurer Redis et les variables serveur dans Vercel.
2. Déployer cette version du code. Le dépôt lié à Vercel et la branche de production déterminent le déclenchement du déploiement.
3. Importer l’historique vers Redis avec la commande ci-dessus.
4. Vérifier l’état actuel du bot et du webhook depuis un processus disposant des secrets :

   ```sh
   node scripts/telegram-webhook.mjs
   ```

5. Si le webhook n’est pas encore associé à cette application :

   ```sh
   node scripts/telegram-webhook.mjs --register
   ```

   Le script vérifie l’identité du bot, le canal, son rôle d’administrateur et la santé du stockage avant de modifier le webhook. Il refuse de remplacer une autre URL existante ; `--replace` ne doit être utilisé qu’après vérification. Les événements en attente sont conservés. Aucun message n’est envoyé au canal.

6. Publier un lien TMDB puis modifier la publication ; vérifier le catalogue après les deux opérations et relancer le contrôle du webhook. L’endpoint `GET /api/telegram`, protégé par le même en-tête secret, renvoie uniquement l’état du stockage et le nombre de publications, jamais leur contenu.

## Limites et validation

La Bot API ne transmet pas les suppressions de messages et ne permet pas de relire l’historique du canal. Les suppressions nécessitent donc une gestion distincte ; l’import couvre l’historique fourni. Les commandes de conversation et réponses aux utilisateurs dans Telegram ne sont pas implémentées ici. Les liens « Où regarder » restent les offres légales TMDB ; aucun média n’est téléchargé.

`npm test` vérifie le parsing, le stockage local, le contrat REST Redis, les erreurs et le refus du disque éphémère sur Vercel. Les tests Redis utilisent une simulation HTTP : ils ne remplacent pas le test de la base réelle et de Lua en production. Vérifier aussi `npm run lint`, `npx --no-install tsc --noEmit` et `npm run build`. La compilation nécessite l’accès à Google Fonts.

## Reconnaissance et audit, version 2

L’import et le webhook utilisent maintenant le même moteur (`telegram-resolution.ts`). Ils lisent séparément **la légende et `file_name`**, recoupent les indices de titre, de type et d’année, puis vérifient la fiche TMDB. La saison et l’épisode sont conservés seulement lorsque l’épisode existe dans TMDB. Le site compte les couples saison/épisode uniques identifiés ; il ne prétend pas que les vidéos ont été vérifiées ou sont lisibles sur le site.

Les anciennes associations erronées sont retirées de la sélection et bloquées pour les messages Redis non réanalysés : A Different World/60 Minutes, Let It Shine/Superman contre l’Élite, Raging Fire/Sooryavanshi et Kill Zone/La Mariée aux cheveux blancs. Les confusions de version Moana (2026)/Vaiana (2016) et Dragon Ball Super/film Battle of Gods sont également retirées. Les remplaçants sont recherchés et vérifiés, sans nouvel ID deviné.

Après déploiement et mise à jour du dépôt local, commencer par une simulation :

```sh
node --env-file=.env.production.local --experimental-strip-types scripts/import-telegram.mjs "/chemin/result.json" 4339801492 --dry-run --minimum-coverage 99
```

Le fichier `.telegram-import-report.json` contient les messages à examiner, les motifs et les candidats éventuels. Un code de sortie 1 signifie que le seuil n’est pas atteint ou qu’une opération a échoué. Aucun message Redis n’est modifié avec `--dry-run`. Les erreurs TMDB (authentification, réseau ou limitation) arrêtent la résolution et sont comptées séparément, sans convertir une panne en « titre introuvable ».

Pour appliquer les correspondances vérifiées et conserver les cas ambigus en attente :

```sh
node --env-file=.env.production.local --experimental-strip-types scripts/import-telegram.mjs "/chemin/result.json" 4339801492
```

Le nouvel import réanalyse les anciens enregistrements au lieu de les ignorer. Il ne remplace jamais un message dont la date de modification est plus récente, ni un événement différent arrivé dans la même seconde avec un numéro Telegram plus récent. Le numéro de livraison existant est conservé lors d’une réanalyse du même contenu. L’import invalide ensuite le cache via `/api/telegram/revalidate`, protégé par le même secret ; si cette étape échoue, il le signale sans masquer les données déjà sauvegardées.

Pour les cas ambigus, un fichier de corrections **validées par une personne** peut associer un ID de message de l’export à son lien TMDB exact :

```json
{
  "2": "https://www.themoviedb.org/tv/94997"
}
```

Passer ce fichier avec `--overrides corrections.json` lors de la simulation puis de l’import. Le détail TMDB est toujours demandé avant publication. Une correction manuelle identifie le titre ; elle ne certifie pas le contenu de la vidéo et n’ajoute pas automatiquement un numéro d’épisode.

### Mesurer l’objectif de 99 %

`mediaCoveragePercent` est le pourcentage de publications vidéo reconnues sans cas en attente. Ce n’est **pas** un taux d’exactitude. `precisionPercent` reste `null` tant qu’aucune vérité terrain indépendante n’a été validée. Les tests de régression couvrent les graphies de l’export, les remakes, les contradictions, l’import, les doublons et les réanalyses ; leur réussite ne démontre pas 99 % d’exactitude sur le catalogue réel.

L’option `--offline` produit les candidats de l’export sans accès TMDB, sans écriture Redis et sans prétendre valider les œuvres. Les rapports contiennent des métadonnées du canal ; ils sont ignorés par Git et doivent être conservés localement.

### Échec global de sauvegarde

Si le bilan indique `failed: 855` et `imported: 0`, les titres reconnus ne prouvent pas que les données ont été enregistrées. Vérifier le stockage sans écrire :

```sh
node --env-file=.env.production.local scripts/check-catalogue-storage.mjs
```

Le contrôle lit les publications et exécute la logique de migration avec l’écriture HSET supprimée du script. Il n’affiche ni les messages ni les secrets. Les erreurs Redis fournissent le statut HTTP et une cause expurgée des jetons connus. L’import effectue désormais ce contrôle avant les recherches TMDB et s’arrête sur une erreur globale de stockage au lieu de répéter la même erreur pour chaque publication.

## Corrections issues du premier rapport réel (version 3)

Le rapport de version 2 contient 348 publications à examiner et 538 motifs, dont des répétitions. Les nouvelles règles ignorent les lignes techniques/promotions explicites (langue, taille, qualité, appels à rejoindre un canal, etc.) et gardent le nom du fichier prioritaire dans le budget de traitement. Elles traitent les suffixes `Film VF`, les variantes de Superman & Lois, The Punisher accompagné d’une saison, les épisodes annoncés en groupe et les titres français/anglais sans rapprochement approximatif.

Pour un titre déjà répertorié, le détail de l’ID est vérifié en premier : nom, type et année restent obligatoires, puis une recherche prend le relais en cas d’incohérence. Pour les recherches, l’année est envoyée au bon endpoint TMDB et une recherche en anglais peut compléter une absence de correspondance française. Une ambiguïté française n’est jamais remplacée par un seul résultat anglais. Les détails sont vérifiés dans la langue de la correspondance et le titre original est conservé pour la vérification à l’affichage.

Le propriétaire a confirmé A Different World **2026** et Lanterns **DC/HBO 2026**. Les IDs issus des candidats de son rapport sont encore contrôlés auprès de TMDB à chaque résolution ; ils ne sont pas considérés comme valides sur leur seule présence dans la sélection.

Le bilan fournit désormais `titleCoveragePercent` (publications vidéo dont le titre est reconnu) séparément de `mediaCoveragePercent` (reconnaissance complète, sans point en attente, y compris les épisodes). Aucun des deux ne constitue une précision validée à 99 %. Les contradictions de numéro d’épisode et les différences entre saisons déclarées et organisation TMDB restent à examiner ; les épisodes ne sont jamais renumérotés automatiquement.

## Rapport version 3 : traitement des derniers cas (version 4)

Les sept conflits Harry Potter provenaient de « Abonne Toi », interprété comme un titre ; cette ligne est désormais ignorée. Les variantes ordinales françaises et les alias de la sélection sont canonisés. Une annonce de saison sans titre n’est pas recherchée comme une œuvre.

Pour Teen Wolf, si texte et fichier valident la même série mais divergent sur l’épisode ou la saison, le titre est conservé **sans aucun numéro certifié**, et le motif `episodes-contradictoires` reste au rapport. Une contradiction sur l’œuvre elle-même continue de bloquer la publication. Cela améliore la couverture des titres sans maquiller la couverture complète des épisodes.

Brothers (2009) est identifié par l’indice explicite Tobey Maguire (écrit McGuire dans la légende) : le casting de l’ID candidat est vérifié via TMDB avant utilisation du raccourci. Swapped est désambiguïsé par le titre français explicite « Aventures croisées ». Les IDs issus du rapport sont toujours vérifiés sur leurs détails.

Le rapport fourni contient exactement 28 publications des Carnets de l’apothicaire avec numérotation non confirmée (24 de saison 2, quatre de saison 3). Aucune renumérotation automatique n’est appliquée. Mutiny (2026), The Runner (2026) et Hope demandent encore des précisions d’identification ; aucun homonyme n’est choisi au classement de popularité.

### Confirmations du propriétaire (version 5)

Le propriétaire a précisé Jason Statham pour Mutiny, Gal Gadot pour The Runner et Michael Fassbender pour Hope. La résolution recherche la personne par son nom exact, croise sa filmographie avec le titre et l’année, puis revérifie le détail et le casting du film retenu. Une filmographie ambiguë ou un casting incohérent restent en attente ; aucun ID de ces trois films n’est supposé.

Les textes Telegram des six messages Teen Wolf ont été vérifiés par le propriétaire en regardant les vidéos. `src/data/telegram-corrections.ts` conserve les six identifiants et les textes/noms de fichiers exacts. La priorité au texte ne s’applique que si le canal, l’identifiant et les deux sources correspondent encore à cette vérification, et si l’épisode du texte a pu être validé par TMDB. Un autre message, une modification de l’une des sources ou un désaccord sur l’œuvre revient au traitement prudent normal.

## Dernier rapport : version 6

Le rapport version 5 confirme 99,35 % de couverture des titres, 95,59 % de reconnaissance complète, et 36 publications en revue. Parmi ces publications, 28 portent sur les numéros des épisodes des Carnets de l’apothicaire ; les huit autres concernent des titres ou variantes de titre. Ce ne sont pas 36 films manquants.

Les légendes bilingues séparées par ` / ` sont traitées comme deux titres candidats. Une année explicitement présentée dans la ligne documentaire (`2023 ‧ ...`) peut compléter un titre sans année ; elle n’écrase pas une année déjà identifiée. Une traduction ambiguë n’est corroborée par un autre titre que si la fiche TMDB déjà vérifiée contient effectivement ce nom et fait partie des candidats de l’ambiguïté. Les noms vérifiés sont conservés comme provenance ; un résultat indépendant sans ce nom ne supprime jamais une ambiguïté.

Les annonces regroupant plusieurs épisodes ne certifient plus par erreur le premier épisode de la liste. Les homonymes restant sans version confirmée et les différences d’organisation des saisons restent en revue. Aucune de ces modifications ne constitue une mesure de précision à 99 %.

## Confirmations finales du propriétaire (version 7)

Le propriétaire a confirmé les versions 2017 de La Belle et la Bête (Emma Watson), 2021 des Éternels (Marvel), 2014 de Maléfique (Angelina Jolie), 2011 du Flingueur (Jason Statham) et 2023 de La Petite Sirène. Les détails TMDB des IDs retenus continuent d’être vérifiés ; les indices de casting confirmés restent des contraintes de résolution.

Le message 20 concerne explicitement **Avatar en dessin animé (2005)**. Un indice de version limité au canal, à l’ID et au texte exacts permet de le résoudre sans transformer les autres publications Avatar, notamment celles qui portent l’année 2024.

Le propriétaire a déclaré avoir regardé les 28 vidéos des Carnets de l’apothicaire. Le registre de confirmation humaine contient leur ID, leur texte et leur nom de fichier exacts. Après validation de l’identité de la série par TMDB, une numérotation non disponible dans TMDB peut être conservée dans **`sourceEpisode`**, avec `verifiedBy: "owner"`. Elle n’est jamais écrite dans les champs `season` et `episode` réservés à TMDB. Le site affiche séparément les épisodes référencés par TMDB et ceux vérifiés dans le canal. Si TMDB confirme ensuite la numérotation, les champs ordinaires sont utilisés sans double attribution de provenance.

Le rapport distingue `ownerVerifiedMediaPosts` : le nombre de vidéos dont la vérification d’épisode provient du propriétaire. La reconnaissance complète inclut désormais ces vérifications humaines explicites, sans prétendre que TMDB les confirme. `precisionPercent` reste non mesuré pour l’ensemble du catalogue. Si les sources changent ou si l’ID de la série diffère, cette exception ne s’applique plus.

## Navigation du catalogue et liens de messages

Le catalogue est trié alphabétiquement avec la collation française (accents/casse ignorés pour l’ordre, chiffres triés naturellement). Les remakes de même titre sont départagés par année. La recherche et les filtres conservent cet ordre.

Les liens du canal public sont construits depuis les IDs Redis : `https://t.me/TheBrowser365/MESSAGE_ID`. Aucune recherche Telegram par nom et aucun secret de bot ne sont transmis au navigateur. La concordance entre la clé du message et son ID est vérifiée avant de générer le lien. Pour un autre canal numérique, le lien interne `t.me/c/...` exige l’accès à ce canal.

Le clic sur une affiche privilégie une publication avec un fichier vidéo. Pour une série, la première publication disponible est choisie par saison/épisode, puis ID de message. Le volet « Choisir un épisode » fournit les liens vers les publications de chaque épisode identifié ; les numéros vérifiés dans le canal sont libellés comme tels. Les doublons d’épisode privilégient un message avec fichier. Un message sans numéro est présenté comme une publication et ne reçoit aucun numéro inventé.

Si aucun message n’est associé au titre, aucun lien Telegram n’est fabriqué : la fiche indique les offres légales. Ces offres restent également accessibles séparément sur les fiches liées au canal. Aucun réimport n’est requis pour créer ces liens : les IDs de messages sont déjà enregistrés.

## Connexion des comptes Premium — ajout au webhook existant

Le code sait maintenant associer une session du site à l’identité Telegram numérique. Il est désactivé par défaut (`PREMIUM_TELEGRAM_AUTH_ENABLED=0`). Avec le drapeau activé et Redis configuré, `/premium` propose la connexion. Le site génère un lien `/start` à usage unique valable dix minutes ; le bot demande ensuite **une confirmation explicite** via un bouton privé. Appuyer sur « Démarrer » seul n’authentifie pas le navigateur. Le compte confirmant doit être celui qui a ouvert le lien dans Telegram. Une réponse de webhook Bot API affiche la demande au seul utilisateur qui l’a initiée ; aucun envoi en masse.

Les commandes privées et `callback_query` passent par le même `POST /api/telegram`, uniquement après validation du secret de webhook existant. Les publications et modifications du canal public gardent leur traitement d’origine. Aucun nouveau webhook ni changement d’URL n’est nécessaire. Le script `scripts/telegram-webhook.mjs --register`, à lancer seulement après déploiement du code et avec `PREMIUM_TELEGRAM_AUTH_ENABLED=1`, ajoute `message` et `callback_query` aux abonnements existants sans retirer les types connus ni supprimer les mises à jour en attente. Sans `--register`, il reste un diagnostic. Ce script n’a pas été exécuté en écriture pendant le développement.

Les jetons de navigateur sont aléatoires, en cookie HttpOnly/SameSite=Lax et Secure en HTTPS ; Redis ne conserve que leurs hashes SHA-256. Les demandes expirent en dix minutes et une confirmation consomme le code une seule fois. La session dure au maximum 24 heures (durée technique de connexion, pas durée d’abonnement). La déconnexion la révoque dans Redis. `SITE_URL` doit correspondre à l’origine exacte du site/preview pour les contrôles anti-CSRF. Les espaces test/réel et les noms de cookies sont distincts (`PREMIUM_ENVIRONMENT=test` par défaut).

Le flux réel nécessite que le code soit déployé sur l’URL déjà enregistrée chez Telegram et utilise la même base Redis que le site. Le paiement Stripe reste un pilote local ; cette connexion ne donne pas encore d’invitation ou d’accès payant automatique au canal privé.

## Publications d’autres canaux — correction du 16 novembre 2026

Après validation du secret, une publication du canal privé Premium ou d’un autre canal est acquittée HTTP 200 avec ignored=true, sans écriture dans le catalogue. Cela évite des retries inutiles quand le bot administre plusieurs canaux. Un mauvais secret reste refusé HTTP 401. L’erreur 403 récente observée dans getWebhookInfo est compatible avec l’ancien refus des autres canaux, mais le contenu de la livraison n’a pas été inspecté ; la disparition de l’erreur et de l’attente reste à contrôler après déploiement.

## Rotation progressive du secret — préparée le 16 novembre 2026

Le propriétaire ne peut plus récupérer l’ancien secret et a autorisé son remplacement. Le code accepte désormais temporairement TELEGRAM_WEBHOOK_SECRET (actuel) et TELEGRAM_WEBHOOK_SECRET_NEXT (nouveau) pour les publications, le diagnostic et la revalidation du cache. Aucun secret vide n’est accepté. Cette compatibilité permet de laisser le secret actuel dans Vercel sans le lire.

Ordre d’application après connexion administrateur Vercel :

1. Ajouter le nouveau secret dans le champ sensible TELEGRAM_WEBHOOK_SECRET_NEXT, en conservant le champ actuel tel quel, puis déployer le code acceptant les deux valeurs.
2. Vérifier que le diagnostic du site accepte le nouveau secret et que les publications actuelles continuent de fonctionner. Un nouveau secret est préparé hors dépôt dans un fichier privé, jamais imprimé.
3. Basculer Telegram seulement après cette vérification, via `node scripts/telegram-webhook.mjs --register --rotate-secret`, avec NEXT injecté et l’activation Premium appropriée. Le script refuse la rotation sans --register, refuse un NEXT absent, contrôle la santé du site avant setWebhook, conserve l’URL et les notifications existantes, et ne supprime pas les mises à jour en attente.
4. Contrôler les livraisons, puis remplacer la valeur principale dans Vercel par la nouvelle et retirer le champ NEXT lors d’un déploiement final. Ne plus conserver inutilement l’ancien secret accepté.

À ce stade : préparation et tests uniquement, aucune valeur Vercel ou configuration Telegram changée. Le réseau bloque encore la connexion officielle Vercel tant que les domaines déjà préparés ne sont pas appliqués.


## Copie ponctuelle d’une série vers le Premium

`scripts/copy-telegram-series.mjs ID_TMDB` prépare la liste sans envoi. Il sélectionne uniquement les publications vidéo déjà identifiées pour cette série dans le catalogue du canal source et les ordonne par saison/épisode/message. Les variables serveur existantes TELEGRAM_BOT_TOKEN, TELEGRAM_CHANNEL_ID, TELEGRAM_PREMIUM_CHANNEL_ID et Redis sont requises ; --poster utilise aussi TMDB_READ_TOKEN.

Avec --apply, le script vérifie les deux canaux et les droits du bot puis appelle copyMessage pour chaque vidéo, en conservant les légendes et les originaux, sans notification sonore. --poster ajoute préalablement l’affiche française TMDB et une légende indiquant le nombre de saisons/épisodes. Aucun automatisme dans le webhook ni transfert d’une autre série.

Le registre durable the-browser:telegram-copy:SOURCE:DESTINATION:MESSAGE contient les identifiants source/copie et permet de sauter les copies déjà confirmées. Une réservation sans expiration précède chaque envoi : après une réponse ambiguë ou un arrêt, rapprocher le message dans le canal avec son identifiant Premium exact avant de reprendre ; un statut seul sans identifiant numérique confirmé ne suffit pas. Aucun retry réseau aveugle. Seuls les rejets429 avec retry_after raisonnable sont réessayés. Ce registre évite les doublons de ce script, mais ne peut pas détecter des copies manuelles antérieures non enregistrées, la Bot API ne permettant pas de relire tout l’historique.

Les médias sont copiés par Telegram, sans téléchargement des vidéos dans le site. Les droits d’accès Premium et la synchronisation du catalogue public ne sont pas modifiés par cet outil.


Copie exécutée le19novembre2026 à la demande du propriétaire : Tout le monde déteste Chris (TMDB252),88 épisodes des saisons1–4 vers Streaming Premium (-1003958043288), affiche TMDB en message4. Une interruption sur S04E03 a nécessité une remise en ordre : épisodes3–22 confirmés en messages92–111,19 anciennes copies4–22 retirées après confirmation de leurs remplacements. Audit du registre terminé :88 épisodes uniques,22 par saison et ordre conservé. Sources publiques inchangées.


## Commandes privées de copie — propriétaire du canal

En Production, TELEGRAM_COPY_ENABLED=1 active /copier TITRE (film ou série du canal public) et /copie (suivi). Les messages doivent provenir d’une conversation privée avec l’utilisateur lui-même ; les groupes, messages de bots et autres membres sont exclus. Le rôle creator est relu via getChatMember sur les canaux Premium et source ; un administrateur ordinaire n’est pas autorisé. TELEGRAM_COPY_ADMIN_IDS permet une liste explicite de comptes opérateurs supplémentaires, côté serveur uniquement. Le rôle est vérifié à la demande et à chaque reprise.

Exemples : /copier série Tout le monde déteste Chris, /copier film La Belle et la Bête 2017. Variantes sans slash et suffixe « vers le canal premium » acceptés. La recherche s’appuie sur les titres/alias/années déjà identifiés et sur les fichiers vidéo du catalogue. En cas d’homonyme, le bot propose des commandes /copier film-ID ou serie-ID ; aucun homonyme choisi arbitrairement. Aucun canal de destination n’est accepté dans le message : source et destination restent configurées sur le serveur.

Le webhook enregistre la demande atomiquement et répond immédiatement. Le traitement démarre avec after() dans Next, avec budget de100s et maxDuration300s. La file Redis the-browser:{telegram-copy-jobs}:queue et les checkpoints permettent une continuation par POST /api/telegram/copy/run, protégé par l’authentification de maintenance. Une tâche cron-job.org dédiée chaque minute assure les reprises après fin de budget ou interruption. Verrou global de240s, une seule copie à la fois, déduplication des update_id et d’une tâche active par titre. Les vidéos et affiches réutilisent le registre durable des copies opérateur, donc Chris n’est pas renvoyé.

Affiche TMDB et vidéos envoyées silencieusement ; légendes d’origine conservées. Le bot répond au demandeur à la fin et /copie reste disponible. Un429 explicite remet l’envoi en attente après retry_after ; un envoi sans réponse confirmée reste réservé et suspend le titre, sans retry aveugle. La reprise d’un tel envoi exige son identifiant Premium exact après rapprochement. Les erreurs de rôles ou d’envoi ne donnent aucun droit Premium ni ne suppriment les originaux.
