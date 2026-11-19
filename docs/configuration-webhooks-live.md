# Activer les notifications de paiements réels

Les clés API sont distinctes des secrets de signature ci-dessous. Ne collez aucune valeur secrète dans le chat ou dans Git. Les variables doivent être saisies **directement sur Vercel, cible Production**, et non copiées depuis les marqueurs de l’environnement cloud.

## Stripe

1. Ouvrir https://dashboard.stripe.com/workbench/webhooks et choisir le mode réel (pas test).
2. Cliquer Ajouter une destination / Ajouter un endpoint.
3. Choisir les événements de son compte, puis :
   - checkout.session.completed
   - checkout.session.async_payment_succeeded
   - checkout.session.async_payment_failed
   - checkout.session.expired
4. Choisir Endpoint webhook et saisir https://the-browser-one.vercel.app/api/stripe/webhook.
5. Créer la destination. Dans son détail, afficher le secret de signature (whsec_…).
6. Ouvrir https://vercel.com/manuels-projects-d0a3bea0/the-browser/settings/environment-variables, ajouter STRIPE_WEBHOOK_SECRET_LIVE, coller cette valeur, sélectionner Production et enregistrer.

## SasPay

1. Ouvrir https://app.saspay.me/ en environnement Live.
2. Ouvrir Développeur → Webhooks → Créer, nom The Browser Live.
3. Saisir https://the-browser-one.vercel.app/api/saspay/webhook.
4. Sélectionner transaction.created, transaction.success, transaction.failed et transaction.cancelled.
5. Créer et conserver immédiatement le secret affiché : il peut n’être montré qu’une fois.
6. Dans les mêmes paramètres Vercel, ajouter SASPAY_WEBHOOK_SECRET avec cette valeur réelle, cible Production.
7. Conserver le webhook Sandbox existant et son secret TEST séparé.

## Après saisie

Indiquer que les valeurs sont enregistrées. Un nouveau déploiement doit ensuite charger ces secrets. La vérification privée contrôle l’état du compte Stripe (mode réel, encaissements et virements), l’authentification SasPay et la fraîcheur du contrôle d’expiration. L’activation du bouton d’achat vient après ce contrôle, pas de la seule présence de clés. Un premier paiement réel ne sera pas déclenché automatiquement : il sera choisi et réalisé par le propriétaire ou un client.
