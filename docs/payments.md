# Paiements — décisions et mise en place

Statut au 16 novembre 2026 : **SasPay et Stripe retenus ; compte SasPay en attente de validation**, selon la confirmation du propriétaire. Tarif fixé le 15 novembre 2026 : **3 000 XAF par mois, ou son équivalent arrondi de 4,57 EUR**. Le renouvellement est manuel, sans prélèvement automatique ; la prise en charge des frais de paiement reste à définir. Les pilotes Stripe et SasPay sont implémentés en mode test ; aucun encaissement réel activé.

## Première étape implémentée — 15 novembre 2026

La mise en place est autorisée par le propriétaire. La page `/premium`, accessible depuis le catalogue, présente l’offre et les règles d’échéance. Elle indique que les paiements ne sont pas ouverts. Les montants sont définis dans `src/lib/subscription.ts` : 3 000 francs XAF ou 457 centimes EUR, sans montant fourni par le navigateur.

Le moteur calcule la même date le mois suivant, avec repli au dernier jour du mois. Il ouvre les droits seulement après confirmation et ne prolonge pas la période lors d’une notification répétée du même paiement. Il refuse un montant, une devise, une commande ou un prestataire incompatible. C’est une fonction métier ; elle ne vérifie pas à elle seule l’authenticité d’une notification externe. Les futurs adaptateurs doivent vérifier signatures/statuts côté serveur avant de l’appeler, et effectuer persistance/déduplication atomiquement.

### Démonstration locale

Depuis la racine du dépôt :

```sh
PREMIUM_DEMO_ENABLED=1 npm run dev -- --hostname 127.0.0.1 --port 3001
```

Ouvrir `/premium` sur ce serveur. Le formulaire permet de simuler SasPay ou Stripe et les résultats en attente, confirmé, refusé ou annulé. Il utilise `POST /api/premium/demo`. Aucun appel prestataire, aucune conservation de données, aucun débit et aucune invitation Telegram ne sont effectués. En production, la route renvoie 404 et le formulaire est absent, même avec `PREMIUM_DEMO_ENABLED=1`.

UTC est une convention technique du prototype ; heure/fuseau commerciaux restent à confirmer. Le prototype ne définit ni renouvellement ni achat anticipé et n’attribue aucun droit de production.

Validation : 80 tests réussis, lint et build réussis ; huit scénarios HTTP (deux prestataires × quatre statuts), refus des requêtes invalides et de l’origine étrangère, montants non modifiables côté client, simulation désactivée en production. Aucun test de paiement réel ou de compte prestataire effectué.

### Étapes restantes avant encaissement

- Associer et authentifier l’identité Telegram ; préparer le canal privé et les permissions du bot sans remplacer le webhook public existant.
- Stocker durablement commandes, paiements et abonnements avec transitions atomiques et identifiants prestataire uniques ; ne pas utiliser le simulateur comme stockage.
- Raccorder les checkouts SasPay/Stripe en environnement de test, vérifier signatures, statut, commande, montant et devise ; un retour navigateur ne vaut jamais confirmation.
- Mettre en place l’invitation liée au client et le retrait à expiration avec reprise sur erreur.
- Définir renouvellement, frais, fuseau, remboursements et conditions de vente avant ouverture.

## Confirmé

- Une offre d’abonnement mensuel au lancement.
- Tarif choisi le 15 novembre 2026 : **3 000 FCFA (XAF)** et le même prix en euros, soit **4,57 EUR** après arrondi au centime au taux fixe de 1 EUR = 655,957 XAF. Aucune majoration ni prise en charge des frais de paiement n’est encore décidée.
- Un canal privé distinct pour les clients.
- @TheBrowser365 reste public pour la découverte.
- Activité exercée depuis la France, clients notamment au **Congo-Brazzaville (République du Congo)**. Objectif : proposer l’abonnement dans tous les pays, sous réserve de la couverture effective des prestataires.
- Prestataires retenus : **SasPay** (https://app.saspay.me) **et Stripe**. Le compte SasPay est en attente de validation selon le propriétaire ; le compte Stripe est prêt selon le propriétaire et son accès de test est vérifié. Les deux prestataires disposent de pilotes de test ; SasPay reste à valider contre un vrai compte SANDBOX.
- Moyens requis au Congo-Brazzaville : **MTN Mobile Money et Airtel Money**. Leur prise en charge effective par SasPay pour ce pays reste à vérifier.
- Période mensuelle : abonnement commencé le **10 → expiration le 10 du mois suivant**. Si la date n’existe pas dans le mois suivant (29–31), expiration au **dernier jour de ce mois**, conformément à la confirmation du propriétaire. Exemple : 31 janvier → 28 février (29 en année bissextile).
- Accès au **canal premium après confirmation du paiement**.
- Pas de lecteur vidéo intégré, pas de développement Rust pour cette évolution.

## Fonctionnement SasPay rapporté par le propriétaire

SasPay détecte le pays et propose le montant et les modes de paiement adaptés à ce pays, selon le propriétaire. Cette capacité et les pays réellement couverts restent à vérifier dans la documentation et lors de l’intégration. Aucun tarif ni règle de conversion n’est déduit de cette description.

## Répartition envisagée — à vérifier avant intégration

SasPay pour les moyens locaux africains, notamment MTN et Airtel au Congo-Brazzaville ; Stripe pour les cartes et l’Europe. Le choix des deux prestataires est confirmé, mais le routage exact, les pays/moyens disponibles et les versements vers une entreprise française restent à valider. La disponibilité du paiement Mobile Money ne prouve pas celle d’un renouvellement automatique.

## À décider avec le propriétaire

| Sujet | Décision attendue |
|---|---|
| Pays | Vérifier la couverture SasPay/Stripe pour les pays visés, dont France et Congo-Brazzaville |
| Prix | 3 000 XAF / 4,57 EUR par mois retenus ; définir la prise en charge des frais de paiement |
| Devise | Devise affichée, facturée et encaissée ; frais et conversion |
| Prestataires | Validation SasPay, statut Stripe, MTN/Airtel au Congo-Brazzaville, routage, frais et versements vers la France à vérifier |
| Période | Même date le mois suivant, ou dernier jour si elle n’existe pas : confirmé ; définir l’heure et le fuseau |
| Renouvellement | Manuel ou automatique, consentement et information du client |
| Achat anticipé | Prolongation de la période active, plutôt qu’une perte de jours, à confirmer |
| Activation | Accès après confirmation retenu ; définir la vérification serveur et le point de départ précis de la période |
| Telegram | Canal privé, association au compte Telegram, invitation et expiration |
| Annulation | Effet sur la période payée et la prochaine échéance |
| Remboursement | Cas, délais, traitement des incidents et effet sur l’accès |
| Support | Contact, reçus, délai de prise en charge et suivi des litiges |
| Cadre commercial | Statut de l’activité, prix/taxes, conditions de vente et droits applicables |

## Principes techniques proposés — non encore adoptés comme conditions de vente

- Vérifier le paiement côté serveur auprès du prestataire et traiter les doublons sans double attribution de droits.
- Lier l’accès à l’identité Telegram numérique du client, pas à un pseudo susceptible de changer.
- Tracer commande, paiement, activation, période et révocation pour expliquer chaque état au client.
- Prévoir les cas paiement refusé/en attente, notification retardée, expiration, remboursement et indisponibilité Telegram.
- Distinguer le catalogue public de l’espace et des services réellement réservés aux clients.
- Vérifier les conditions du parcours choisi, notamment pour une vente directement dans Telegram.

Ces propositions devront être précisées avant implémentation. Ni pass de 30 jours, ni reconduction automatique, ni politique de remboursement particulière n’est validé à ce stade.

La référence générale du projet est [PROJECT_MEMORY.md](../PROJECT_MEMORY.md).

## Pilote Stripe après planification officielle — 15 novembre 2026

Le planificateur CLI a confirmé l’acceptation du plan Checkout hébergé. Le pilote `/premium/stripe-test` crée de vraies sessions de test à 4,57 EUR, conserve les commandes localement et vérifie les webhooks signés avec rapprochement serveur. Aucune reconduction ni accès Telegram réel ; page et API désactivées en production. Le compte CLI est autorisé uniquement en mode test.

86 tests, lint et build réussis. Création et lecture de vraies sessions Stripe vérifiées, idempotence et persistance contrôlées ; aucun débit. Le flux externe du relais CLI est bloqué sur `stripecli-ws-nw.stripe.com`, domaine ajouté au brouillon sans publication. Les tests HTTP de webhook utilisent des notifications synthétiques signées ; ils ne remplacent pas un paiement complet et une vraie livraison externe. Voir [le plan et les commandes](stripe-plan.md).

## Stockage Premium Redis préparé — 15 novembre 2026

`src/lib/premium-redis.ts` fournit un stockage indépendant du catalogue public. Il réutilise les paires Redis REST existantes (`KV_REST_API_URL`/`KV_REST_API_TOKEN` ou `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN`) sans nouvelle base imposée. Il n’est pas encore raccordé aux routes de paiement ni à une authentification Telegram : le pilote Stripe continue d’utiliser ses fichiers locaux.

Les espaces `the-browser:{premium:test}:…` et `the-browser:{premium:live}:…` sont distincts et utilisent chacun un seul slot Redis Cluster pour leurs scripts Lua. Les fonctions créent une commande pour une identité Telegram déjà vérifiée, lient une session prestataire unique, confirment un paiement une seule fois et listent les commandes encore actives. Aucun identifiant Telegram fourni librement par le navigateur ne doit être transmis comme identité authentifiée. La signature, le statut et le mode du paiement doivent être vérifiés par l’adaptateur avant confirmation.

Le contrôle de version et les écritures sont atomiques : une session ou un paiement ne peut pas appartenir à deux commandes. Une notification répétée ne prolonge pas la période. Une erreur Redis ne devient jamais un succès ni un catalogue vide. Aucun repli disque en production. Les nouvelles clés ne touchent pas le stockage du canal public. Les règles d’achat anticipé et de cumul de périodes restent ouvertes : le module n’invente pas de prolongation entre deux commandes.

### Validation

90 tests de la suite habituelle réussis, plus 8 tests d’intégration sur un véritable Redis 7.4.6 local et isolé : création concurrente, 24 confirmations simultanées, unicité session/paiement, mauvais montant, échéance exacte, séparation test/réel et absence d’écriture partielle en présence d’un index corrompu. Lint, TypeScript et build réussis. Ce test exécute réellement les scripts Lua, sans utiliser une base de production.

Pour reproduire l’intégration avec des binaires Redis installés :

```sh
REDIS_TEST_SERVER=/chemin/redis-server REDIS_TEST_CLI=/chemin/redis-cli \
  node --test tests/premium-redis.integration.mjs
```

La suite démarre elle-même une instance temporaire sur un socket Unix, sans port TCP, puis l’arrête et supprime uniquement ses propres fichiers. Dans cette machine, les binaires ont été construits depuis le dépôt officiel redis/redis, tag 7.4.6, commit `4b03ddfdac5a5c007358df8d08873f508f2fbfe3`, sous `/workspace/.redis-test-source/src/`. Ce répertoire d’outillage n’est pas une dépendance du site.

### Prérequis restants

Le propriétaire confirme maintenant que le canal Premium privé est créé et que @Thebrowser365_bot y a été ajouté comme administrateur. Il reste à vérifier les permissions effectives par API et à configurer son identifiant distinct du canal public. Les secrets du bot et de Redis ne sont pas injectés dans cette machine lors du contrôle ; cela ne prouve pas leur absence sur Vercel. Ne pas remplacer le webhook public existant ni modifier ses données pour régler ce point.

Le relais Stripe externe reste en attente de l’application de l’autorisation `stripecli-ws-nw.stripe.com`. Rien n’a été publié, déployé ni envoyé aux membres Telegram pendant cette étape.

## Contrôle du canal privé

Avec les variables sécurisées injectées (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_PREMIUM_CHANNEL_ID` et `TELEGRAM_CHANNEL_ID`), lancer :

```sh
NODE_USE_ENV_PROXY=1 node scripts/check-premium-channel.mjs
```

Le résultat doit indiquer `ready: true`, `administrator: true`, `canInvite: true` et `canRestrict: true`. Ce script appelle seulement getMe, getChat et getChatMember ; aucun message, aucune invitation, aucune modification du webhook. Un canal public, un groupe, un mauvais bot ou un identifiant identique au catalogue est refusé. Les réponses d’erreur n’impriment jamais le jeton. Le contrôle réel attend la configuration sécurisée ; quatre nouveaux tests simulés portent la suite habituelle à 94 tests réussis, lint réussi.

Le besoin de secret du bot et api.telegram.org ont été enregistrés en brouillon, ainsi que les variables des deux canaux. Enregistrer puis publier les valeurs et modifications dans l’interface avant de reprendre le contrôle. Aucun accès réel de membre n’est encore activé.

### Résultat du contrôle réel — 15 novembre 2026

Le contrôle API du canal privé `-1003958043288` réussit : @Thebrowser365_bot est administrateur, avec permissions d’invitation et de restriction des membres ; `ready: true`. Canal privé et distinct du catalogue public confirmés. Aucun message, lien d’invitation ou changement de webhook effectué. Les accès Premium automatisés et l’authentification client ne sont pas encore raccordés.

## Identité Telegram et Redis raccordés dans le code — 15 novembre 2026

La connexion est implémentée dans `premium-auth.ts`, les routes `/api/premium/auth/{start,session,logout}` et le composant `TelegramAccount`. Le navigateur reçoit une session aléatoire HttpOnly ; la confirmation vient du compte Telegram, via le webhook déjà protégé par son secret. Les codes courts durent dix minutes et nécessitent le clic explicite sur « Confirmer ma connexion ». Mauvais compte, groupe, bot, code expiré/réutilisé et autre environnement sont refusés. Aucune preuve d’identité envoyée librement dans le JSON du navigateur n’est acceptée.

Les API Stripe de test utilisent maintenant Redis et cette session : création avec propriétaire immuable, accès au statut réservé au propriétaire, liaison de session et confirmation uniques. L’ancien stockage fichier est retiré. Les webhooks signés retrouvent la Session Stripe et la commande, puis enregistrent atomiquement le résultat. Le paiement n’ouvre toujours aucun accès Telegram réel.

### Configuration pour le parcours réel

1. Réutiliser la base Upstash du catalogue avec une paire Redis REST complète. Les valeurs ne sont pas présentes dans la machine cloud actuelle. Ne pas créer une nouvelle base ni copier le jeton dans le chat. Dans Vercel, ouvrir le projet puis la base Upstash liée (Storage/Intégrations) ; la console Upstash affiche REST URL et REST TOKEN. L’adresse est non secrète si elle ne contient que l’hôte HTTPS ; le token doit rester dans les paramètres sécurisés. Utiliser la même base pour le site et le webhook.
2. Configurer `SITE_URL` avec l’origine exacte du déploiement, `PREMIUM_ENVIRONMENT=test` pour les premiers essais et `PREMIUM_TELEGRAM_AUTH_ENABLED=1` seulement lors du déploiement préparé. Les suggestions du brouillon gardent l’authentification à 0 pour ne pas activer un parcours non déployé.
3. Déployer les modifications de l’application. Publier l’environnement cloud seul ne déploie pas le code sur Vercel.
4. Depuis un environnement disposant des secrets existants, vérifier Redis avec `NODE_USE_ENV_PROXY=1 node scripts/check-premium-storage.mjs` (lecture et script Lua de lecture uniquement), puis ajouter les notifications privées/callbacks via le script Telegram `--register`, sans changer l’URL du webhook ni supprimer les messages en attente. Voir docs/telegram.md.
5. Tester une connexion réelle avant de tester le paiement. Une session test ne doit jamais attribuer d’accès au canal réel. Reste ensuite à réaliser et vérifier les invitations/retraits, les règles commerciales et les paiements de production.

### Validation de cette étape

99 tests habituels, 12 tests Redis réel isolé, et un test HTTP complet Next.js/Redis réel avec API Stripe simulée réussis ; lint et build réussis. Le test HTTP couvre le cookie, la confirmation explicite, le propriétaire de commande imposé côté serveur, le refus de lecture inter-comptes, le webhook signé idempotent, la déconnexion et la réception inchangée du canal public. Les scripts d’intégration n’envoient rien à Telegram et n’utilisent pas de données Redis de production.

```sh
REDIS_TEST_SERVER=/chemin/redis-server REDIS_TEST_CLI=/chemin/redis-cli \
  node --test tests/premium-redis.integration.mjs
REDIS_TEST_SERVER=/chemin/redis-server REDIS_TEST_CLI=/chemin/redis-cli \
  node --test tests/premium-flow.integration.mjs
```

Aucun déploiement du site, aucun `setWebhook` réel, aucune invitation ni modification des membres effectués. Le branchement réel reste bloqué par l’accès Redis absent de cette machine et par l’absence de déploiement du nouveau code.

### Contrôle Redis réel réussi — 15 novembre 2026

Après configuration sécurisée et publication de l’environnement, le diagnostic de lecture et de scripting Redis réussit dans l’espace test, avec writes=false. Aucune donnée n’a été modifiée. L’ancien blocage de configuration Redis est levé ; il reste à déployer le nouveau code sur Vercel, puis à activer et vérifier la connexion Telegram avant le parcours complet de paiement.

## Pause et reprise — 15 novembre 2026

Le propriétaire a demandé de poursuivre plus tard. Le code a été poussé sur main (`d482240`), mais la réussite du déploiement Vercel n’est pas confirmée. Redis réel est maintenant accessible ; ne pas reprendre l’ancien diagnostic de jeton manquant. Les contrôles passent (99 tests, 12 tests Redis, 1 test HTTP, lint/build). Aucun paiement réel, accès de membre ou changement réel de webhook.

À la reprise : contrôler le déploiement et les domaines réseau déjà en brouillon, vérifier les paramètres Vercel et le secret existant du webhook, puis activer/tester la connexion Telegram et le paiement de test. Les invitations/retraits et SasPay restent à réaliser. La pause n’autorise aucune nouvelle publication ou activation automatique. Le résumé à jour est en tête de PROJECT_MEMORY.md.

## Raccordement SasPay — 16 novembre 2026

Le pilote SasPay Mobile Money est développé à 3000 XAF pour MTN/Airtel Congo-Brazzaville, avec identité Telegram et stockage Redis. Les réseaux sont obtenus du référentiel actif, pas devinés. Paiement direct idempotent et confirmation via signature + vérification prestataire ; aucun succès depuis le seul navigateur. La récupération d’un paiement confirmé avant sa liaison locale est testée. Voir [docs/saspay.md](saspay.md).

Les essais locaux sont simulés côté SasPay. La production reste fermée ; seuls le développement local et une prévisualisation Vercel explicitement configurée peuvent ouvrir les pilotes avec des clés de test. Il reste à connecter le compte Vercel, activer la connexion Telegram, fournir la clé SANDBOX SasPay et son secret de notification, puis effectuer les vrais essais. Les invitations/retraits du canal et les paiements réels ne sont pas activés.

## Correction SasPay sandbox — 16 novembre 2026

La documentation officielle https://docs.saspay.me/sandbox annonce encore « Bientôt disponible » et exige un compte sandbox séparé. Le préfixe sk_test_ est une étiquette : une clé ainsi nommée sur api.saspay.me peut traiter de l’argent réel. Le conseil précédent consistant à créer simplement une clé SANDBOX dans le compte de production est insuffisant et remplacé par cette consigne. Le pilote appelle désormais exclusivement sandbox-api.saspay.me, interdit les redirections HTTP et limite ses checkouts à sandbox-checkout.saspay.me (y compris le stockage Redis test). Aucun repli production. La disponibilité du service et les vrais scénarios restent à vérifier ; aucun appel SasPay authentifié effectué. Validation : 109 tests, parcours HTTP Next.js/Redis avec prestataires simulés, lint et build réussis. Correction locale, non publiée.

### Paiement Stripe navigateur validé — 16 novembre 2026

Après confirmation du propriétaire, lecture Redis et Stripe réelle : une commande Stripe test, statut Redis confirmed, montant457 centimes EUR. Session Stripe complete, payment_status paid, livemode=false, montant/devise et client_reference_id conformes. Période enregistrée du 16 novembre 2026 à 21:17:09 UTC au 16 décembre 2026 à 21:17:09 UTC. Test réussi sans argent réel. Cela valide le parcours navigateur et la confirmation serveur ; ne prouve pas à lui seul que la confirmation vient du webhook plutôt que du polling statut. Aucun accès Telegram privé accordé par le pilote. Invitations/retraits, paiements production et règles commerciales restent hors activation.

### Admission et expiration Telegram préparées — 16 novembre 2026

Service premium-channel-access.ts, routes POST /api/premium/access et /api/premium/access/expire, bouton conditionnel et traitement chat_join_request ajoutés localement. Drapeau PREMIUM_TELEGRAM_ACCESS_ENABLED=0 par défaut ; activation exige environment live, jamais les commandes test. Invitation courte à demande d’adhésion liée au compte authentifié ; vérification des paiements réels et dates ; retrait ban/unban récupérable, administrateurs protégés, autre période active respectée. Stockage Redis durable, verrous par utilisateur et confirmation live différée pendant retrait. Voir docs/premium-channel-access.md pour limites, configuration et ordonnanceur encore à raccorder. Aucun lien réel, admission, retrait, modification de webhook distant ni déploiement de ce service. Les pilotes de paiement live restent à développer/valider avant activation ; ne pas transformer le paiement Stripe test précédent en droit réel.

## Accès au canal déployés et activés — 16 novembre 2026

Le propriétaire autorise explicitement le déploiement et l’activation. Code applicatif poussé sur main : 5786482, puis correctifs workflow 057ff95 et identité OIDC 164e864. Déploiement Production final dpl_85bFL3shfJbFS5i8cpipns67jstW confirmé Ready sur the-browser-one.vercel.app. PREMIUM_ENVIRONMENT=live, PREMIUM_TELEGRAM_ACCESS_ENABLED=1, PREMIUM_TELEGRAM_TEST_AUTH_ENABLED=1 et PREMIUM_ACCESS_GITHUB_OIDC_ENABLED=1 configurés en Production. Les connexions test de la preview restent possibles via le même bot mais isolées des sessions et droits live ; les anciennes sessions test du site public ne sont pas des sessions live.

Webhook Telegram mis à jour sans changement d’URL/purge : chat_join_request ajouté, anciennes notifications préservées, zéro attente et aucune erreur. /premium HTTP 200 affiche le bouton d’accès ; invitation sans session HTTP 401 ; maintenance sans identité valide HTTP 401 ; pilotes Stripe/SasPay de test toujours HTTP 404 en Production. Aucun lien réel, admission ou retrait de membre effectué. Index des membres live vide au contrôle.

Vercel Hobby confirmé ; contrôle d’expiration via GitHub Actions toutes les cinq minutes (cadence indicative, possibles délais), workflow public premium-expiration.yml. GitHub refuse l’API secrets, contournement non nécessaire : authentification OIDC RSA signée strictement liée au dépôt, aux IDs propriétaire230215107/dépôt1455838466, au workflow/main, à l’audience et aux dates. Première tentative refusée car GitHub utilise un sub contenant ces IDs ; format corrigé et testé sans relâcher les autres vérifications. Exécution réelle validée : https://github.com/manuelrt1203/the-browser/actions/runs/43964370019, conclusion success, après déploiement de la correction. Le passage réel avec index vide valide l’ordonnanceur/authentification/lecture ; pas un test de retrait de membre réel.

Validation : 119 tests habituels, 15 résultats d’intégration Redis réel/HTTP, lint sans erreur (avertissements des compétences locales) et build réussis ; test ciblé OIDC repassé après correction. Paiements réels toujours fermés et adaptateurs live non raccordés : le paiement Stripe test précédent ne donne aucun accès réel. Les règles commerciales restantes et le cycle réel invitation/retrait restent à valider avant ouverture des ventes. SasPay reste bloqué sur sa signature externe, voir rapport support.



## Renouvellement manuel et espace abonnement — 16 novembre 2026

Décision confirmée : renouvellement manuel, aucun prélèvement/reconduction automatique. Le propriétaire ne dispose pas des informations professionnelles/contact demandées ; aucune identité, adresse ou e-mail inventé. Il choisit aucune garantie commerciale de remboursement supplémentaire, sans suppression des droits légaux. Conditions, remboursements et support préparés avec avertissement ventes fermées ; trame complète et points à compléter dans docs/commercial-terms-draft.md. SUPPORT_EMAIL peut être renseigné lorsqu’une adresse opérationnelle existe. Ouverture des ventes toujours reportée ; achat anticipé/frais/fiscalité/fuseau contractuel restent à préciser.

Espace /mon-abonnement et API privée /api/premium/subscription implémentés : propriétaire issu uniquement de la session Telegram, historique/statut/échéance sans identifiants prestataire ni identité Telegram exposée, Cache-Control private,no-store. Échéances affichées dans le fuseau de l’appareil. Le bouton d’accès nécessite une période live active et le service activé ; les paiements test restent des démonstrations sans droits réels. Ne pas présenter un renouvellement anticipé ou un cumul de périodes comme implémenté.
