# Conditions de vente — document de préparation

Statut : **projet non définitif**, avant ouverture des ventes. Le propriétaire confirme ne disposer actuellement ni d’identité professionnelle renseignée, ni d’adresse professionnelle, ni d’immatriculation communiquée, ni d’adresse de support. Ne pas inventer ces informations et ne pas ouvrir les encaissements sur la base de ce document.

## Décisions confirmées

- Offre : un mois d’accès à un canal Telegram privé, associé au compte authentifié. Catalogue public distinct, sans lecteur intégré.
- Tarif retenu : 3000 XAF ou 4,57 EUR. Traitement fiscal, prix total et éventuels frais à préciser avant vente ; ne pas ajouter une mention TTC ou une exonération supposée.
- **Renouvellement manuel**, aucun prélèvement ni renouvellement automatique. Chaque paiement est une décision distincte du client.
- Même date le mois suivant, dernier jour du mois si la date manque. Début de période après confirmation serveur du paiement. Les dates techniques existantes sont en UTC ; le fuseau contractuel demeure à fixer. L’espace client présente les dates dans le fuseau de l’appareil et l’indique.
- **Aucune garantie commerciale de remboursement supplémentaire**. Cette décision ne supprime jamais les droits légaux de rétractation, de conformité et les recours applicables.
- Droits de test isolés : aucun argent réel, aucun accès au canal commercial.

## Trame des conditions définitives

1. **Vendeur et contact** : identité exacte de l’exploitant, statut, adresse géographique et contact direct, immatriculation et TVA si applicables. À compléter avant publication définitive.
2. **Service et prérequis** : description précise des contenus/services dont la commercialisation est autorisée, nécessité d’un compte Telegram, accès au canal privé, périmètre territorial et disponibilité. Ne pas garantir des droits sur les contenus sans vérification.
3. **Prix et commande** : montants, devise, fiscalité, frais éventuels, récapitulatif avant engagement, consentement aux conditions avec version/date conservées, preuve de commande et confirmation sur support durable. Ne pas activer de facturation récurrente.
4. **Paiement et activation** : moyens réellement disponibles par pays/prestataire, vérification serveur et traitement des paiements en attente/refusés/doubles. Aucun succès déduit du navigateur seul.
5. **Durée et renouvellement** : période mensuelle, règle de fin de mois, fuseau et heure à préciser, expiration et retrait. Le client peut ne pas renouveler sans démarche de résiliation d’un prélèvement automatique. **Achat avant l’échéance et éventuel report de jours non décidés** : ne pas présenter un cumul comme acquis.
6. **Rétractation et exécution anticipée** : préciser la qualification juridique du service/contenu et le droit légal applicable aux contrats à distance. Ne pas imposer une clause « aucun remboursement » et ne pas présumer une renonciation du seul paiement. Toute demande d’exécution anticipée et éventuelle exception légale requiert le consentement et les confirmations appropriés ; ne pas inventer une case précochée.
7. **Réclamations et remboursements** : contact opérationnel, référence de commande, examen des doubles paiements et services non fournis. Aucune garantie commerciale supplémentaire ; appliquer les droits/délais légaux. Définir la gestion des droits après remboursement, sans retrait automatique non spécifié.
8. **Conformité, responsabilité et assistance** : préciser les garanties légales applicables, les mesures en cas d’interruption et les limites autorisées, sans exclure globalement la responsabilité du vendeur ni les recours du client.
9. **Règlement des litiges** : médiation de la consommation si applicable et coordonnées effectives du médiateur, droit applicable sans priver le consommateur de dispositions impératives. À compléter selon la situation réelle.
10. **Données et conservation** : informations de confidentialité, finalités, prestataires et durée de conservation adaptée ; ne pas collecter de justificatifs sensibles par simple messagerie pour une demande courante.

## Support à créer

Créer une adresse effectivement consultée, puis renseigner `SUPPORT_EMAIL` dans les paramètres serveur. Le site n’affiche aucun contact inventé. Prévoir la réception de demandes et un suivi avant ventes. Informations utiles : référence de commande, date, montant, description. Ne jamais demander de code Telegram, mot de passe, clé API ou numéro complet de carte.

## Écrans préparés

- `/conditions`, `/remboursements`, `/support` : informations préalables, bandeau clair « ventes non ouvertes », pas de faux contact ni de formulaire inopérant.
- `/mon-abonnement` : session Telegram, statut et historique propriétaire, échéances et accès réel seulement si abonnement live actif.
- `GET /api/premium/subscription` : lecture privée sans cache, aucune identité fournie par le navigateur, aucune référence de session/prestataire ni lien d’invitation dans l’historique.

Ce document est une trame à compléter et vérifier selon l’activité et les pays de vente ; ce n’est pas une confirmation de conformité permettant d’ouvrir les paiements.
