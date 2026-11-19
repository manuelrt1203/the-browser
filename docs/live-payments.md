# Paiements réels — raccordement et exploitation

Le propriétaire demande explicitement l’ouverture le 19 novembre 2026, malgré l’adresse de domiciliation et l’immatriculation restant à compléter. Nom communiqué : Rodrigue Emmanuel ; statut déclaré : entrepreneur individuel ; pays : France ; support : manuelrt1203@gmail.com. Cela ne constitue pas une vérification administrative ni une validation de conformité. Ne pas inventer d’adresse ou d’immatriculation.

## Isolation et activation

- Les pilotes `/api/stripe/test/*` et `/api/saspay/test/*` restent réservés au serveur local/Preview avec environnement test. Jamais de bascule d’un paiement test vers un droit live.
- Les nouvelles routes live ne fonctionnent que sur Vercel Production, `PREMIUM_ENVIRONMENT=live`.
- L’achat exige `PREMIUM_SALES_ENABLED=1`, authentification et accès Telegram activés, `SELLER_NAME`, `SUPPORT_EMAIL`, `COMMERCIAL_TERMS_VERSION`, et au moins un prestataire live configuré et explicitement activé (`STRIPE_LIVE_ENABLED=1` ou `SASPAY_LIVE_ENABLED=1`).
- Le dernier contrôle complet d’expiration doit dater de moins de quinze minutes. Une panne de maintenance bloque une nouvelle commande, mais n’empêche pas la confirmation d’un paiement déjà engagé.
- Garder `PREMIUM_SALES_ENABLED=0` tant que les secrets live réels ne sont pas configurés et la vérification protégée n’est pas réussie. Une présence de variable ne prouve pas que la clé est valide.

## Variables de Production, saisies directement dans Vercel

Stripe : `STRIPE_SECRET_KEY` (sk_live ou rk_live avec les permissions nécessaires), `STRIPE_WEBHOOK_SECRET_LIVE` (whsec). Webhook `https://the-browser-one.vercel.app/api/stripe/webhook`, événements checkout.session.completed, checkout.session.async_payment_succeeded, checkout.session.async_payment_failed, checkout.session.expired.

SasPay : `SASPAY_API_KEY` (sk_live), `SASPAY_WEBHOOK_SECRET` (vrai secret du webhook Live), `SASPAY_LIVE_FEE_MODE=DEDUCTED`. Webhook `https://the-browser-one.vercel.app/api/saspay/webhook`, événements transaction.created/success/failed/cancelled. Base live exclusivement api.saspay.me ; base test exclusivement sandbox-api.saspay.me. Aucune URL de base configurable ni redirection API.

Ne jamais copier un marqueur cloud pour une clé HMAC. Ces secrets sont différents de ceux du Sandbox/Preview. Réenregistrer un secret ne met pas à jour un déploiement déjà publié : redéployer ensuite.

## Parcours

La page `/premium` affiche seulement les prestataires configurés. Stripe : Checkout hébergé, achat ponctuel 457 centimes EUR, sans Billing récurrent, prix serveur. SasPay : checkout hébergé multipays, montant source décimal 3000.00 XAF ; pays, réseau et numéro ne sont plus imposés par le site. Le client choisit parmi les options actives de SasPay, qui gère aussi les OTP. Les options et le montant final dans la devise proposée sont affichés chez SasPay avant validation. `fee_charge_mode=DEDUCTED` est envoyé ; son respect dépend de la configuration marchand `ALLOW_CLIENT_OVERRIDE`, comme le précise la documentation. Ne pas promettre une couverture universelle ni un taux de conversion inventé.

`POST /api/premium/payment` exige origine identique, session Telegram confirmée, UUID de tentative, consentement aux conditions courantes et prix imposé côté serveur. Un verrou par compte sérialise les créations. Une autre commande pending ou une période active bloque une nouvelle commande : pas de renouvellement anticipé/cumul non défini. Conserver le même UUID après erreur réseau. Une tentative terminée utilise un nouvel UUID.

`GET /api/premium/payment/status?order=UUID` appartient uniquement au compte authentifié. Il relit le prestataire et peut proposer une reprise d’un checkout en attente. Si la réponse d’initiation a été perdue avant la liaison du prestataire, le client peut reprendre la demande avec le même UUID et les mêmes coordonnées. Les retours du navigateur n’accordent aucun droit. Les webhooks restent traitables lorsque les ventes sont mises en pause, pour finaliser les paiements déjà engagés. Montant, devise, mode live, commande et identifiant prestataire sont rapprochés ; Redis conserve les confirmations de façon idempotente. Les commandes test n’accordent jamais d’accès réel.

Les demandes de remboursement passent par le support ; aucune promesse de garantie commerciale supplémentaire, aucun effacement des droits légaux, aucune mutation automatique de remboursement ajoutée. Ne pas présenter une confirmation technique comme un règlement bancaire/settlement reçu.

## Contrôle opérationnel privé

`GET /api/premium/payment/readiness`, autorisation de maintenance Bearer existante, renvoie seulement des booléens : clés configurées, compte Stripe réellement live, encaissements et virements activés (balance et account), authentification SasPay (pricing/my-rates), fraîcheur du contrôle et drapeau de ventes. Aucun secret ni donnée de client.

`scripts/configure-premium-scheduler.mjs` configure de façon idempotente une seule tâche cron-job.org vers l’endpoint `POST /api/premium/access/expire/run`, cinq minutes, timeout300s, notifications d’échec/rétablissement/désactivation à l’adresse de compte. Clé API dans `CRONJOB_API_KEY` ; le nom historique `CRONJOB_API__KEY` est également accepté. Secret de maintenance via fichier sécurisé indiqué par `PREMIUM_ACCESS_CRON_SECRET_FILE`, hors dépôt. Ne pas partager ce fichier ou l’en-tête dans les logs. GitHub reste en secours.

Validation avant ouverture : vérifier les comptes avec readiness, activer explicitement le drapeau puis redéployer, contrôler l’interface réelle et effectuer un premier règlement choisi par le propriétaire. Le test HTTP local des routes live emploie exclusivement une base Redis et des prestataires simulés ; il ne prouve pas qu’un encaissement Live a eu lieu. Aucun paiement réel automatique ne doit être déclenché par une procédure de validation.


Chaque prestataire est activé séparément après le contrôle privé. Un compte Stripe non vérifié reste à STRIPE_LIVE_ENABLED=0 même si SasPay est ouvert, afin de ne pas afficher un moyen indisponible. La route d’achat vérifie aussi ce drapeau côté serveur. Le webhook d’un paiement déjà engagé reste traitable pendant une suspension du prestataire.

Le contrôle privé vérifie également les destinations enregistrées chez les prestataires : URL exacte, mode Live, activité du webhook et événements requis. Il n’affiche aucune donnée de compte Stripe, seulement mode/encaissements/virements et un statut d’erreur technique sans message susceptible de contenir une clé. Un simple secret enregistré localement ne prouve pas la configuration distante ni une livraison signée réelle ; conserver la validation du premier paiement choisi par le client.

## État vérifié du 19 novembre 2026

Stripe et SasPay sont ouverts en Production : carte4,57EUR et Mobile Money Congo3000FCFA, authentification et consentement obligatoires. L’ancienne erreur401 Stripe est résolue après nouvelle clé et redéploiement : compte Live, encaissements/virements autorisés et webhook corrects. API/réseaux/webhook SasPay et fraîcheur de maintenance validés. Les trois drapeaux de ventes/prestataires sont à1. Achat anonyme refusé401, pilotes testProduction404. Aucun encaissement Live de test n’a été déclenché automatiquement ; ne pas confondre ouverture du formulaire et paiement réel de bout en bout déjà validé.


## Checkout SasPay multipays — 19 novembre 2026

Références officielles vérifiées : [vue d’ensemble](https://docs.saspay.me/api-reference/payments), [création](https://docs.saspay.me/api-reference/payments/checkout-create), [statut](https://docs.saspay.me/api-reference/payments/checkout-status), [OpenAPI](https://docs.saspay.me/api-reference/openapi.json). `country` est facultatif et ne fait que présélectionner un pays. La détection automatique du pays par géolocalisation n’est pas explicitement garantie par ces pages : ne pas la présenter comme un fait vérifié. Aucune géolocalisation/IP du serveur Vercel n’est transmise comme celle du client.

Le site crée `POST /checkout-sessions/` avec nom/e-mail, référence de commande, métadonnées environnement, retour /premium?order=UUID et expiration24h. Une session ne débite rien avant validation du client. Son ID est stocké avec `providerFlow=checkout`, distinct de l’ID transaction. Les anciennes commandes softpay restent vérifiables sans migration. Les URL et signatures webhook existantes sont conservées.

Confirmation : statut marchand PAID → détail marchand avec prix source3000 XAF et bonne commande/environnement → même transaction liée dans les deux réponses → `GET /payments/{id}/verify/` SUCCESS entrant. La devise locale de transaction peut différer de XAF ; seule la session marchande d’origine justifie le prix contractuel enregistré. Retour navigateur, payload webhook seul, transaction non liée, mauvais prix ou environnement ne livrent rien. Redis garde l’unicité du paiement et ne prolonge pas un abonnement lors d’un doublon. Le webhook peut retrouver la session par sa relation marchande `transaction`, sans supposer que la description soit recopiée dans le paiement.

L’endpoint de création SasPay ne prend PAS en charge Idempotency-Key. Un marqueur Redis durable réserve l’unique création par commande. Après une réponse perdue, rechercher la session via la liste marchande et ses métadonnées ; ne pas relancer aveuglément une création. Si la session reste introuvable ou s’il existe plusieurs correspondances, échouer sans nouvelle création et faire rapprocher la commande par le support. Le marqueur est volontairement conservé, sans expiration qui autoriserait un doublon. Un échec de transaction peut être réessayé dans la même session hébergée ; seules les sessions annulées/expirées terminent la tentative locale.

Vérifié : création d’une vraie session Sandbox sans pays imposé, référence3000.00 XAF conservée, URL sandbox-checkout.saspay.me, statut PENDING et annulation HTTP200 ; aucun numéro ni débit. Conversion et confirmation multipays couvertes par tests isolés (prestataire simulé), pas encore par un paiement humain réel dans une autre devise. Le pilote Sandbox historique MTN/Airtel reste disponible uniquement en Preview/test et conserve son flux direct.

Livraison : commits19dca5c et519ac0c sur main ; déploiement Production dpl_FHfJzYzaBTex6X1PMDpsPgms7tV1 Ready. Formulaire public multipays vérifié dans Chromium à390/320px ; contrôle privé des deux prestataires/webhooks et maintenance réussi. 152 tests, intégrations HTTP/Redis isolées et compilation réussis. Aucun paiement Live de validation automatique.
