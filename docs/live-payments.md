# Paiements réels — raccordement et exploitation

Le propriétaire demande explicitement l’ouverture le 19 novembre 2026, malgré l’adresse de domiciliation et l’immatriculation restant à compléter. Nom communiqué : Rodrigue Emmanuel ; statut déclaré : entrepreneur individuel ; pays : France ; support : manuelrt1203@gmail.com. Cela ne constitue pas une vérification administrative ni une validation de conformité. Ne pas inventer d’adresse ou d’immatriculation.

## Isolation et activation

- Les pilotes `/api/stripe/test/*` et `/api/saspay/test/*` restent réservés au serveur local/Preview avec environnement test. Jamais de bascule d’un paiement test vers un droit live.
- Les nouvelles routes live ne fonctionnent que sur Vercel Production, `PREMIUM_ENVIRONMENT=live`.
- L’achat exige `PREMIUM_SALES_ENABLED=1`, authentification et accès Telegram activés, `SELLER_NAME`, `SUPPORT_EMAIL`, `COMMERCIAL_TERMS_VERSION`, et au moins un prestataire live configuré.
- Le dernier contrôle complet d’expiration doit dater de moins de quinze minutes. Une panne de maintenance bloque une nouvelle commande, mais n’empêche pas la confirmation d’un paiement déjà engagé.
- Garder `PREMIUM_SALES_ENABLED=0` tant que les secrets live réels ne sont pas configurés et la vérification protégée n’est pas réussie. Une présence de variable ne prouve pas que la clé est valide.

## Variables de Production, saisies directement dans Vercel

Stripe : `STRIPE_SECRET_KEY` (sk_live ou rk_live avec les permissions nécessaires), `STRIPE_WEBHOOK_SECRET_LIVE` (whsec). Webhook `https://the-browser-one.vercel.app/api/stripe/webhook`, événements checkout.session.completed, checkout.session.async_payment_succeeded, checkout.session.async_payment_failed, checkout.session.expired.

SasPay : `SASPAY_API_KEY` (sk_live), `SASPAY_WEBHOOK_SECRET` (vrai secret du webhook Live), `SASPAY_LIVE_FEE_MODE=DEDUCTED`. Webhook `https://the-browser-one.vercel.app/api/saspay/webhook`, événements transaction.created/success/failed/cancelled. Base live exclusivement api.saspay.me ; base test exclusivement sandbox-api.saspay.me. Aucune URL de base configurable ni redirection API.

Ne jamais copier un marqueur cloud pour une clé HMAC. Ces secrets sont différents de ceux du Sandbox/Preview. Réenregistrer un secret ne met pas à jour un déploiement déjà publié : redéployer ensuite.

## Parcours

La page `/premium` affiche seulement les prestataires configurés. Stripe : Checkout hébergé, achat ponctuel 457 centimes EUR, sans Billing récurrent, prix serveur. SasPay : MTN/Airtel CG selon référentiel actif, montant décimal 3000.00 XAF ; frais retenus côté marchand pour ne pas ajouter de supplément au prix du site. Les contraintes opérateur restent à valider lors du premier parcours réel.

`POST /api/premium/payment` exige origine identique, session Telegram confirmée, UUID de tentative, consentement aux conditions courantes et prix imposé côté serveur. Un verrou par compte sérialise les créations. Une autre commande pending ou une période active bloque une nouvelle commande : pas de renouvellement anticipé/cumul non défini. Conserver le même UUID après erreur réseau. Une tentative terminée utilise un nouvel UUID.

`GET /api/premium/payment/status?order=UUID` appartient uniquement au compte authentifié. Il relit le prestataire et peut proposer une reprise d’un checkout en attente. Si la réponse d’initiation a été perdue avant la liaison du prestataire, le client peut reprendre la demande avec le même UUID et les mêmes coordonnées. Les retours du navigateur n’accordent aucun droit. Les webhooks restent traitables lorsque les ventes sont mises en pause, pour finaliser les paiements déjà engagés. Montant, devise, mode live, commande et identifiant prestataire sont rapprochés ; Redis conserve les confirmations de façon idempotente. Les commandes test n’accordent jamais d’accès réel.

Les demandes de remboursement passent par le support ; aucune promesse de garantie commerciale supplémentaire, aucun effacement des droits légaux, aucune mutation automatique de remboursement ajoutée. Ne pas présenter une confirmation technique comme un règlement bancaire/settlement reçu.

## Contrôle opérationnel privé

`GET /api/premium/payment/readiness`, autorisation de maintenance Bearer existante, renvoie seulement des booléens : clés configurées, compte Stripe réellement live, encaissements et virements activés (balance et account), authentification SasPay (pricing/my-rates), fraîcheur du contrôle et drapeau de ventes. Aucun secret ni donnée de client.

`scripts/configure-premium-scheduler.mjs` configure de façon idempotente une seule tâche cron-job.org vers l’endpoint `POST /api/premium/access/expire/run`, cinq minutes, timeout300s, notifications d’échec/rétablissement/désactivation à l’adresse de compte. Clé API dans `CRONJOB_API_KEY` ; le nom historique `CRONJOB_API__KEY` est également accepté. Secret de maintenance via fichier sécurisé indiqué par `PREMIUM_ACCESS_CRON_SECRET_FILE`, hors dépôt. Ne pas partager ce fichier ou l’en-tête dans les logs. GitHub reste en secours.

Validation avant ouverture : vérifier les comptes avec readiness, activer explicitement le drapeau puis redéployer, contrôler l’interface réelle et effectuer un premier règlement choisi par le propriétaire. Le test HTTP local des routes live emploie exclusivement une base Redis et des prestataires simulés ; il ne prouve pas qu’un encaissement Live a eu lieu. Aucun paiement réel automatique ne doit être déclenché par une procédure de validation.
