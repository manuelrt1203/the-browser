# SasPay — raccordement de test

État au 16 novembre 2026 : connecteur implémenté et testé avec un prestataire simulé ; aucune requête d’encaissement réelle ni confirmation contre un compte SasPay effectuée. Activation de la connexion Telegram sur Vercel encore en attente d’accès administrateur.

## Périmètre

- Offre serveur : 3 000 XAF pour un mois, sans renouvellement automatique.
- Premier marché : Congo-Brazzaville, code CG. MTN/Airtel sont proposés uniquement s’ils sont actifs dans le référentiel renvoyé par SasPay pour ce pays. Aucun code réseau n’est deviné ou pris dans le JSON client sans vérification.
- Paiement direct `POST /payments/softpay/`, avec `Idempotency-Key` stable par commande : cette route documente l’idempotence, contrairement à la création de checkout hébergé. Le résultat peut être un push ou une redirection ; une URL non vide doit être proposée au client. Seul pay.saspay.me en HTTPS est actuellement pris en charge ; les autres redirections sont refusées avant affichage.
- Les prénom, nom, email et téléphone sont exigés par SasPay et transmis au prestataire, pas conservés dans nos commandes Redis. Numéro attendu : +242 suivi de neuf chiffres. L’identité Telegram vient exclusivement de la session vérifiée, pas des coordonnées du payeur.
- Les frais restent ceux du compte marchand ; aucune règle commerciale n’a été inventée ni surcharge forcée. À décider et vérifier avant ouverture des paiements réels.

## Contrôles serveur

Les commandes sont liées au compte Telegram, les prix sont fixés côté serveur et les sessions/paiements sont uniques dans Redis. La notification est vérifiée par HMAC-SHA256 sur `timestamp.corps_brut`, comparaison en temps constant, horodatage à cinq minutes et concordance du nom d’événement dans le header et le corps. Un webhook de succès seul ne donne jamais de droits : `/payments/{id}/verify/` doit confirmer statut SUCCESS, montant demandé 3000 XAF, flux entrant, type PAIEMENT et référence de commande.

Les événements pris en charge sont transaction.success, transaction.failed et transaction.cancelled. Un paiement pending reste en attente, une répétition ne prolonge jamais la période et un échec tardif ne révoque pas une confirmation déjà enregistrée. Les données du test sont séparées des données réelles. Aucun accès Telegram n’est accordé par ce pilote.

Un paiement direct peut être confirmé avant l’enregistrement local de son ID. Pour ce cas, le serveur écrit l’UUID de commande dans la description documentée de la demande et la retrouve uniquement dans la réponse de vérification SasPay, jamais dans du JSON non vérifié. Le montant/type/sens sont contrôlés avant de lier l’ID. Si cette description n’est pas conservée par le prestataire, le rapprochement est refusé ; ce point doit faire partie du vrai essai SANDBOX. Le test HTTP couvre ce scénario de course après une création distante.

## Routes

- `/premium/saspay-test` : connexion Telegram et formulaire Mobile Money de test.
- `GET /api/saspay/test/networks` : réseaux CG actifs pour le compte authentifié.
- `POST /api/saspay/test/payment` : prix serveur, identité propriétaire et idempotence.
- `GET /api/saspay/test/status?order=UUID` : consultation réservée au propriétaire et vérification réelle du statut côté prestataire.
- `POST /api/saspay/test/webhook` : signature et rapprochement serveur.

Les routes sont fermées par défaut. Elles ne s’ouvrent qu’en développement local ou dans une prévisualisation Vercel explicitement configurée (`VERCEL_ENV=preview`), avec PREMIUM_ENVIRONMENT=test et SASPAY_TEST_ENABLED=1. Elles restent fermées sur le site Vercel de production même si ce drapeau est à 1. Le même cadre de prévisualisation est disponible pour le pilote Stripe ; il ne permet pas d’ouvrir des paiements réels.

## Clés et déploiement

Créer dans SasPay une clé **SANDBOX**, scope **PAYIN**, préfixée sk_test_. La clé sk_live_ évoquée par le propriétaire n’est pas utilisée. Configurer SASPAY_API_KEY_TEST et le secret de signature SASPAY_WEBHOOK_SECRET dans les variables sécurisées de la prévisualisation ; jamais dans le chat ni le dépôt.

La documentation ne fournit pas d’introspection du mode d’une clé. Le connecteur refuse donc une clé réelle ou un marqueur de proxy à la place d’une clé de test brute. Dans l’environnement cloud, les secrets peuvent être des marqueurs : ils servent à transmettre la valeur au déploiement via l’API Vercel autorisée, sans l’afficher, mais ne permettent pas d’initier directement un push avec ce connecteur local. Le serveur Vercel doit recevoir la véritable valeur en variable sécurisée. Le secret HMAC doit également être une valeur brute sur le serveur qui vérifie la notification, distincte de la clé API.

Configurer la notification SANDBOX depuis le tableau de bord SasPay (création/modification non disponibles par clé API) sur `https://ADRESSE-DE-PREVISUALISATION/api/saspay/test/webhook`, avec le même secret et les événements ci-dessus. L’adresse réelle dépendra du déploiement ; le texte ci-dessus est un modèle, pas une URL utilisable. Ne pas rediriger le webhook Telegram public vers la prévisualisation : l’identité fonctionne via le webhook existant, la même base Redis et l’espace test, après activation de la connexion sur le site.

La connexion Vercel officielle n’est pas encore autorisée. La CLI 65.16.0 est disponible via npx, avec répertoires modifiables :

```sh
NODE_USE_ENV_PROXY=1 XDG_DATA_HOME=/workspace/.vercel-data XDG_CONFIG_HOME=/workspace/.vercel-config \
  npm_config_cache=/workspace/.npm-cache npx --yes vercel --global-config /workspace/.vercel-config login
```

L’accès à vercel.com/api.vercel.com est ajouté au brouillon, sans publication par l’agent. Après application, terminer l’authentification par le lien officiel, vérifier le projet manuels-projects-d0a3bea0/the-browser et ses paramètres, puis activer PREMIUM_TELEGRAM_AUTH_ENABLED=1 avec SITE_URL correct. Le secret existant TELEGRAM_WEBHOOK_SECRET doit être réutilisé lors de l’ajout des notifications privées/callbacks, sans changement d’URL ni purge des mises à jour.

## Vérification

107 tests habituels, 12 tests Redis réel isolé, 1 test HTTP Next.js/Redis avec Stripe et SasPay simulés, lint et build. Vérifiés : refus inter-comptes, montant imposé, idempotence, signature altérée/périmée, pays/réseau incorrects, confirmation API contredisant un faux succès dans la notification, récupération d’un paiement non encore lié localement et absence de prolongation sur répétition.

Un vrai paiement SANDBOX, les opérateurs effectivement exposés au compte et la livraison du webhook externe restent à tester. Les OTP spécifiques ne sont pas implémentés ; si un réseau les exige, la demande échoue sans repli ni fausse confirmation. Aucun paiement de production, abonnement automatique, invitation ou retrait de membre n’a été activé.

Références consultées le 16 novembre 2026 :

- https://docs.saspay.me/api-reference/openapi.json
- https://docs.saspay.me/api-reference/payments/softpay
- https://docs.saspay.me/api-reference/payments/verify
- https://docs.saspay.me/api-reference/webhooks
- https://docs.saspay.me/account-setup
