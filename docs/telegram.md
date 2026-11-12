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
