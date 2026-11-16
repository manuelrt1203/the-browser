# Stripe — plan accepté et pilote de test

Date : 15 novembre 2026.

## Planificateur officiel

Le propriétaire a choisi de conserver le planificateur CLI. Les compétences officielles Stripe et la CLI 1.55.11 sont installées, avec le plugin tools 0.20.0. La connexion officielle par navigateur a été approuvée pour le compte de test The Browser. Le plan `iguide_61VlOAzo20DlZaZ8V41R1bnaGRieM` a été généré, précisé puis accepté : réponse `status: accepted`. La réponse officielle est enregistrée dans `docs/stripe-plan.json`.

Commande CLI : `NODE_USE_ENV_PROXY=1 XDG_CONFIG_HOME=/workspace/.stripe-config /workspace/.stripe-tools/bin/stripe tools plan …`. Le proxy exige NODE_USE_ENV_PROXY pour ce composant Node. L’authentification OAuth évite de transmettre le marqueur de secret cloud à la validation locale de la CLI. Les fichiers d’authentification sont hors dépôt, protégés par des permissions restrictives ; ne jamais les afficher ni les commiter.

Le plan préconise Checkout hébergé pour un paiement ponctuel, un produit/prix et une confirmation par webhook. L’implémentation utilise un prix inline côté serveur, en EUR et 457 centimes, plutôt qu’un catalogue produit configuré manuellement. Elle complète le guide par les recommandations officielles sur signatures, paiements asynchrones, idempotence et rapprochement avec une Session fraîchement récupérée.

## Périmètre retenu

- The Browser : marchand direct basé en France, catalogue public et accès à un canal Telegram premium après paiement.
- Stripe : 4,57 EUR pour un mois ; SasPay reste une intégration séparée à réaliser pour 3 000 XAF et notamment MTN/Airtel au Congo-Brazzaville.
- Pas de renouvellement automatique choisi : `mode: payment` dans ce pilote, sans reconduction. Cela ne fixe pas la politique commerciale finale.
- Billing sera étudié si le renouvellement automatique est retenu. Invoicing : besoin de facture à préciser. Issuing : émission de cartes, sans cas d’usage défini ; ce produit est hors couverture du planner.
- Aucun paramétrage fiscal n’est inventé. TVA, taxes, frais, remboursements et fuseau commercial doivent être décidés avant ouverture. Stripe Tax ne sera activé qu’après vérification des réglages et immatriculations nécessaires.

## Code livré

- `/premium/stripe-test` : parcours local vers un vrai Checkout Stripe de test, retour et consultation du statut.
- `POST /api/stripe/test/checkout` : prix serveur de 457 centimes, tentative UUID utilisée pour l’idempotence, vérification du mode de test, création puis sauvegarde de la session.
- `POST /api/stripe/test/webhook` : signature sur le corps brut avec tolérance temporelle du SDK, rejet du mode réel, rapprochement session/commande/montant/devise. Récupération de la Session auprès de Stripe avant attribution d’un mois de test. Un retour navigateur ne confirme rien.
- Événements : `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`. Un completed encore impayé reste en attente. Une notification répétée ne prolonge pas l’échéance ; un échec tardif ne révoque pas un paiement déjà confirmé.
- `GET /api/stripe/test/status` : état de la commande, uniquement après connexion Telegram et contrôle du propriétaire. Aucune clé renvoyée.
- Commandes, liaison des sessions et confirmations dans Redis via `premium-redis.ts`, avec contrôle atomique et unicité des paiements. Le stockage fichier initial a été retiré des routes et du code.
- Page et trois API renvoient 404 en production, même avec le drapeau activé. Elles sont disponibles en développement local ou dans une prévisualisation Vercel explicitement configurée en mode test. Aucun droit Telegram réel.

## Démarrage local

Depuis `/workspace/the-browser`, avec la liaison sécurisée `STRIPE_SECRET_KEY_TEST` déjà injectée. Ne pas copier sa valeur dans les commandes. Une clé restreinte de test est préférable ; ce pilote a besoin de lire le mode du compte via le solde et de créer/lire les sessions Checkout.

```sh
export XDG_CONFIG_HOME=/workspace/.stripe-config
export NODE_USE_ENV_PROXY=1
export STRIPE_TEST_CHECKOUT_ENABLED=1
export PREMIUM_ENVIRONMENT=test
export PREMIUM_TELEGRAM_AUTH_ENABLED=1
export SITE_URL=http://127.0.0.1:3005
# Injecter aussi une paire Redis REST complète et le secret du webhook Telegram.
export STRIPE_WEBHOOK_SECRET="$(/workspace/.stripe-tools/bin/stripe listen --print-secret)"
npm run dev -- --hostname 127.0.0.1 --port 3005
```

Dans un second terminal, démarrer le relais obligatoire :

```sh
XDG_CONFIG_HOME=/workspace/.stripe-config /workspace/.stripe-tools/bin/stripe listen --skip-update \
  --forward-to http://127.0.0.1:3005/api/stripe/test/webhook \
  --events checkout.session.completed,checkout.session.async_payment_succeeded,checkout.session.async_payment_failed,checkout.session.expired
```

Consulter `/premium/stripe-test` sur ce serveur. Utiliser uniquement des moyens de paiement Stripe de test. La connexion Telegram explicite est maintenant obligatoire ; les commandes sont conservées dans Redis et liées à cette identité. Le webhook Telegram doit déjà être déployé avec les notifications privées et callbacks activées pour ce même environnement. Voir docs/payments.md. Ne pas publier ce parcours comme une vente opérationnelle.

### Limite réseau actuelle du relais

L’obtention du secret de relais fonctionne, mais le flux WebSocket est refusé sur `stripecli-ws-nw.stripe.com`. Ce domaine précis a été enregistré dans le nouveau brouillon, sans publication. Les notifications externes réelles ne sont donc pas encore validées. L’accès à r.stripe.com observé dans les logs est de la télémétrie et n’a pas été ajouté.

## Vérifications effectuées

- 86 tests réussis : périodes mensuelles, signatures et notifications altérées/périmées, impayé puis succès différé, doublons, montants/devises/identités incompatibles, écritures concurrentes dans le processus local et fermeture en production.
- Lint, TypeScript via build et compilation Next.js réussis.
- Vraies sessions créées dans le compte Stripe de test : montant 457, devise eur, mode non réel et référence de commande vérifiés par lecture API. Tentative répétée : même URL/session. Sessions expirées après vérification, aucun débit.
- Requêtes HTTP : origine étrangère, UUID invalide et signature invalide refusés ; état rechargé depuis un nouveau processus Node.
- Notifications synthétiques signées : rapprochement avec une vraie Session Stripe impayée empêche d’attribuer un mois, doublon sans effet, mode réel refusé et expiration rapprochée enregistrée.
- Production : page et trois API Stripe de test renvoient 404 malgré le drapeau activé.

Un paiement complet dans le navigateur et la réception d’un vrai webhook externe restent à vérifier après déblocage du relais. Aucun accès Telegram donné, aucun encaissement réel, aucun déploiement de l’application.

## Suite avant production

Authentifier et associer l’identité Telegram ; stockage durable transactionnel multi-instance avec identifiants prestataire uniques ; invitations et retrait à expiration avec reprise sur erreur ; politique d’achat anticipé et de renouvellement ; webhooks, remboursements et litiges de production ; fiscalité, frais, conditions de vente ; tests de bout en bout. Préserver le webhook du catalogue public.

## Évolution suivante : identité et Redis raccordés

Les routes Stripe de test exigent désormais la session Telegram côté serveur. Une commande existante d’un autre compte est refusée, même si le navigateur fournit son UUID. Le prix et le propriétaire ne sont pas lus dans le corps client. Le webhook signé rapproche la session Stripe avec la commande puis appelle la confirmation atomique Redis ; les résultats impayés sont enregistrés sans pouvoir annuler une confirmation ultérieure. Le fichier local de commandes a été retiré, sans suppression des anciens fichiers de données de la machine.

Validation actuelle : 99 tests habituels, 12 tests d’intégration Redis et un test du parcours HTTP complet avec Next.js + Redis réel + API Stripe simulée. Ce test couvre connexion, consentement Telegram, refus inter-comptes, signature altérée, paiement confirmé une seule fois, déconnexion et conservation du traitement du canal public. Il n’est pas une nouvelle validation du parcours Stripe externe ni un déploiement.

## Prévisualisation Vercel — 16 novembre 2026

Le même pilote peut désormais être ouvert dans une prévisualisation (`VERCEL=1`, `VERCEL_ENV=preview`), seulement avec l’espace test et le drapeau explicite. SITE_URL doit être exactement l’origine de la prévisualisation ; la vérification de l’origine ne fait pas confiance au Host fourni par le client. Le site Vercel de production reste fermé aux paiements de test. Ne pas promouvoir une prévisualisation de test comme vente opérationnelle. Les variables sensibles doivent être configurées dans le bon environnement Vercel ; leur présence dans la machine cloud ne les configure pas sur Vercel. La connexion Vercel officielle reste à autoriser. Voir docs/saspay.md pour le raccordement Mobile Money complémentaire.
