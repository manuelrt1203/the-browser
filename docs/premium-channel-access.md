# Accès au canal Premium — préparation

Le propriétaire autorise le déploiement et l’activation le 16 novembre 2026. Les résultats de livraison sont consignés dans PROJECT_MEMORY.md ; ce guide décrit le fonctionnement. Aucun test de paiement ne devient un droit réel.

## Admission

`POST /api/premium/access` utilise la session Telegram authentifiée et refuse une origine étrangère. Aucun identifiant utilisateur libre envoyé par le navigateur ne détermine le bénéficiaire. Le service relit les commandes confirmées du stockage Redis **live**, avec date de début atteinte et échéance future. Les commandes de test ne donnent jamais accès au canal réel.

Le bot crée une invitation valable au maximum dix minutes, avec `creates_join_request=true`. Elle ne donne pas une entrée immédiate. Le webhook Telegram authentifié traite `chat_join_request`, exige le canal privé attendu, le même compte et le lien enregistré, puis revérifie les droits avant d’approuver. Les demandes inconnues ne sont pas approuvées. Un paiement expiré entraîne le refus de la demande connue. Le traitement répété d’un membre déjà admis est acquitté. Un lien orphelin après une interruption n’autorise aucune admission sans enregistrement local.

## Expiration et reprise

`POST /api/premium/access/expire?cursor=0` exige un Bearer authentifié. Le workflow GitHub Actions dédié utilise son identité OIDC signée (durée courte), sans secret partagé. Un secret manuel PREMIUM_ACCESS_CRON_SECRET peut également être configuré pour une maintenance autorisée. Chaque réponse donne le curseur à poursuivre jusqu’à `0`, le nombre traité et les erreurs à retenter. Le workflow `.github/workflows/premium-expiration.yml` est prévu toutes les cinq minutes (cadence GitHub indicative, exécutions possiblement retardées), avec déclenchement manuel, exclusion des exécutions concurrentes et échec visible en cas d’erreur. Il suit les curseurs jusqu’à 0. GitHub peut désactiver les schedules des dépôts publics après une longue inactivité : surveiller les exécutions et réactiver si nécessaire. Vercel Hobby ne permet pas la fréquence requise avec ses crons natifs. La cadence du contrôle et les erreurs Telegram peuvent retarder le retrait après l’échéance ; aucune garantie de retrait à la seconde exacte.

Pour les seuls utilisateurs enregistrés par ce service, l’expiration relit toutes les commandes actives : un autre paiement valable empêche le retrait, sans inventer de cumul des périodes. Une erreur Redis empêche toute décision d’expiration. Le membre expiré est retiré par ban puis unban avec `only_if_banned=true`, afin de pouvoir s’abonner de nouveau. Les administrateurs et le créateur sont protégés. Les membres ajoutés manuellement et non enregistrés ne sont pas balayés.

Le verrou Redis par utilisateur est limité à 120 secondes ; les sauvegardes vérifient atomiquement sa propriété. Les confirmations de paiement live sont différées par Lua tant que ce verrou est détenu, évitant qu’une confirmation nouvellement enregistrée soit ignorée pendant le retrait. Les phases `removing`, `banned`, `expired` permettent une reprise après interruption, notamment après ban avant unban. Une nouvelle période active récupère aussi un compte bloqué par un retrait interrompu. En cas de suspension du processus dépassant le bail entre la dernière vérification et l’appel Telegram, l’API externe ne fournit pas de transaction atomique avec Redis : le risque de concurrence résiduel doit être testé avant activation.

## Configuration future, sans activation actuelle

- `PREMIUM_TELEGRAM_ACCESS_ENABLED=1` **et** `PREMIUM_ENVIRONMENT=live` sont requis. Le drapeau est à 0 par défaut. Les tests restent interdits même avec le drapeau à 1.
- Garder l’authentification Telegram activée et les deux canaux distincts. En Production live, `PREMIUM_TELEGRAM_TEST_AUTH_ENABLED=1` permet aussi les confirmations de la preview test dans un espace Redis séparé, sans droits réels pour ces sessions. Bot administrateur du canal privé, avec invitation et restriction.
- Activer `PREMIUM_ACCESS_GITHUB_OIDC_ENABLED=1` pour le workflow signé : issuer token.actions.githubusercontent.com, audience URL exacte de maintenance, dépôt et workflow exacts, ref main, événement schedule/workflow_dispatch, signature RSA-SHA256 et dates vérifiées. Aucun secret GitHub à recopier. Pour un autre ordonnanceur, utiliser le secret manuel sécurisé.
- Déployer et valider le service avant d’ajouter `chat_join_request` aux notifications existantes via le script `telegram-webhook.mjs --register`. Celui-ci conserve les anciennes notifications, l’URL et les livraisons en attente. Ces changements sont déployés et activés au 16 novembre 2026 ; voir le résultat du workflow dans PROJECT_MEMORY.md. Les paiements réels restent fermés.
- Valider les adaptateurs de paiement live, les règles commerciales et les erreurs/reprises avant de passer l’environnement en live. Les pilotes Stripe/SasPay actuels restent des pilotes de test, pas des adaptateurs live.
- Tester le cycle réel dans un canal dédié avant activation sur le canal commercial, avec autorisation de créer des invitations et modifier ses membres.

## Validation locale

Tests du service avec bot simulé : refus test/autre propriétaire/paiement incomplet/expiré, lien transmis, approbation idempotente, renouvellement, reprise après échec de retrait, administrateur protégé, verrou perdu. Test Redis réel isolé : confirmation différée pendant verrou live et libération après erreur. Parcours HTTP : les nouvelles routes restent 404 dans le pilote test même si le drapeau d’accès est à 1. Aucun appel réel de modification des membres.

## Livraison vérifiée

Production activée le 16 novembre 2026. Le contrôle GitHub Actions [43964370019](https://github.com/manuelrt1203/the-browser/actions/runs/43964370019) a réussi avec un index vide. L’identité inclut les IDs immuables du propriétaire et du dépôt ; les formats de subject historique et contenant les IDs sont acceptés avec ces IDs vérifiés. Admission/retrait de membres réels non exercés à ce stade.

## Canal isolé pour les essais de suppression

Destination communiquée par le propriétaire le 17 novembre 2026 : https://t.me/c/4375412351/2, soit l’identifiant Bot API `-1004375412351`. Elle remplace la destination de test précédemment indiquée. Vérifier le bot administrateur avec invitation/restriction et utiliser un compte de test non administrateur. Ne pas remplacer le canal commercial dans les variables de production ; aucune suppression n’est autorisée par la seule communication de cette adresse.
