# SasPay — raccordement de test

État au 16 novembre 2026 : connecteur implémenté et testé avec un prestataire simulé ; aucune requête d’encaissement réelle ni confirmation contre un compte SasPay effectuée. Activation de la connexion Telegram sur Vercel encore en attente d’accès administrateur.

## Périmètre

- Offre serveur : 3 000 XAF pour un mois, sans renouvellement automatique.
- Premier marché : Congo-Brazzaville, code CG. MTN/Airtel sont proposés uniquement s’ils sont actifs dans le référentiel renvoyé par SasPay pour ce pays. Aucun code réseau n’est deviné ou pris dans le JSON client sans vérification.
- Paiement direct `POST /payments/softpay/`, avec `Idempotency-Key` stable par commande : cette route documente l’idempotence, contrairement à la création de checkout hébergé. Le résultat peut être un push ou une redirection ; une URL non vide doit être proposée au client. Seul sandbox-checkout.saspay.me en HTTPS est actuellement pris en charge ; les autres redirections sont refusées avant affichage.
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

La [documentation sandbox](https://docs.saspay.me/sandbox) consultée le 16 novembre annonce encore « Bientôt disponible ». Créer un **compte sandbox séparé** via le sélecteur Sandbox / Live du tableau de bord, lorsque disponible, puis sa clé scope PAYIN. Une clé créée avec une étiquette SANDBOX dans le compte de production ne suffit pas. La clé sk_live_ évoquée par le propriétaire n’est pas utilisée. Configurer SASPAY_API_KEY_TEST et le secret de signature SASPAY_WEBHOOK_SECRET_TEST dans les variables sécurisées de la prévisualisation ; jamais dans le chat ni le dépôt.

**Le préfixe de clé ne protège pas contre un débit réel.** Le connecteur utilise exclusivement `https://sandbox-api.saspay.me/api/v1`, sans bascule configurable vers la production, et refuse les redirections HTTP. Les URL de checkout doivent appartenir à sandbox-checkout.saspay.me, y compris dans Redis test. Une indisponibilité du sandbox produit une erreur, jamais un repli sur api.saspay.me. Le refus des clés étiquetées live et des marqueurs proxy reste un contrôle complémentaire. Dans l’environnement cloud, les secrets réseau peuvent être des marqueurs de substitution. Ne jamais copier ces marqueurs dans Vercel ni les utiliser pour un calcul HMAC : la substitution n’est pas garantie lors d’un transfert vers un autre service. Enregistrer la véritable valeur directement dans les variables sécurisées de Vercel Preview. Le secret HMAC doit également être une valeur brute sur le serveur qui vérifie la notification, distincte de la clé API.

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

## Scénarios sandbox documentés

Quand le service sera disponible, utiliser des numéros complets plausibles : dernier chiffre 0 pour succès, 1 pour échec, 2 pour solde insuffisant, 9 pour attente persistante. Ces scénarios externes et la disponibilité effective du service ne sont pas encore vérifiés. Aucun appel SasPay authentifié effectué pendant cette correction.

### Essais externes SasPay sandbox — 16 novembre 2026

Tests autorisés sur sandbox-api.saspay.me uniquement, données client fictives +242, montant serveur 3000 XAF. MTN numéro finissant par 0 : création réussie, verify SUCCESS, rapprochement strict verifiedSasPayResult confirmé (montant/type/sens/description/date). Airtel finissant par 1 et MTN finissant par 2 : softpay renvoie HTTP 422, success=false, code client_fault, sans ID à vérifier dans cette réponse ; ne pas prétendre avoir observé verify FAILED ou un code spécifique solde insuffisant. Airtel finissant par 9 : création HTTP 201 PENDING, verify HTTP 200 PENDING. Ce dernier statut observé ne prouve pas une attente indéfinie. Les requêtes diagnostiques ont utilisé de nouvelles intentions/idempotency keys, pas des retries aveugles. Aucun paiement réel, droit Redis/Telegram, invitation, déploiement ni changement de webhook. Livraison externe du webhook et parcours navigateur restent non vérifiés.

### Réception webhook test vérifiée et URL SasPay à corriger — 16 novembre 2026

La prévisualisation est accessible : POST webhook.test signé localement avec SASPAY_WEBHOOK_SECRET_TEST renvoie HTTP 200 ; mauvaise signature HTTP 400. Ce test est synthétique, pas une livraison SasPay. Lecture du compte sandbox : un webhook actif SANDBOX vise https://the-browser-one.vercel.app/webhooks/saspay, différent de la route déployée. 12 abonnements et zéro journal renvoyés par les listes consultées. Le propriétaire doit modifier l’URL depuis le tableau de bord sandbox vers https://the-browser-ct93diwel-manuels-projects-d0a3bea0.vercel.app/api/saspay/test/webhook ; création/modification non disponible par clé API selon documentation. Ne pas toucher au webhook live ni régénérer le secret pour une simple modification URL. Aucune configuration distante changée pendant ce contrôle.


### Cause du rejet identifiée — 19 novembre 2026

Le secret TEST disponible au processus cloud est un marqueur technique de substitution. Des notifications synthétiques signées localement avec ce marqueur ont reçu HTTP200 sur le déploiement historique et sur l’alias stable Preview, alors qu’une clé aléatoire reçoit HTTP400. Cela démontre que ces serveurs utilisent le marqueur pour leur HMAC ; ce résultat ne valide pas la véritable clé SasPay. Les précédents contrôles synthétiques étaient donc insuffisants et leur conclusion de synchronisation du secret est retirée. Ne pas attribuer ce rejet à SasPay sans nouvel élément.

Correctif : refuser les marqueurs techniques et les valeurs absentes/blanches avant tout HMAC (HTTP503 pour configuration invalide), vérifier le corps binaire exact avant décodage JSON. Configurer ensuite **directement dans Vercel Preview** SASPAY_WEBHOOK_SECRET_TEST avec la véritable valeur du webhook Sandbox. Si elle n’est plus disponible, rotation depuis le tableau de bord SasPay puis saisie immédiate dans Vercel ; ne pas demander au proxy de révéler la valeur et ne pas la coller dans le chat. Redéployer après la modification de variable et utiliser l’URL stable https://the-browser-premium-test-manuels-projects-d0a3bea0.vercel.app/api/saspay/test/webhook dans SasPay : l’ancienne URL de déploiement est immuable et ne reçoit pas les mises à jour. Aucun changement du webhook commercial.


### Livraison Sandbox rétablie — 19 novembre 2026

Après saisie directe du véritable secret dans Vercel Preview et recréation du webhook Sandbox sur l’URL stable, la livraison fournisseur est validée : paiement MTN CG 3000.00 XAF SUCCESS ; événements transaction.created et transaction.success HTTP200 DELIVERED. Déploiement dpl_2iy8FzfBzBFZwbQNE5ZRiJK4hGKS, webhook 9475095e-1e24-4b34-8624-7721d10dd1a5. Signature incorrecte et ancien marqueur rejetés400 ; route test Production404. Le problème HMAC n’est plus bloquant en Sandbox.

Paiement diagnostic sans commande Redis : réponse received/ignored attendue, aucune confirmation d’abonnement ni droit de canal. Prochaine validation SasPay : vraie commande test du compte authentifié, paiement sandbox, confirmation stockée idempotente et parcours navigateur. Cela ne signifie pas que l’encaissement Live est ouvert. Les entrées antérieures décrivant l’échec de signature sont historiques.
