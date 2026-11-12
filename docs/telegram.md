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
