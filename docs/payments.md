# Paiements — décisions et reprise ultérieure

Statut au 13 novembre 2026 : **cadrage en cours, suite reportée par le propriétaire à une prochaine session**. Aucun prestataire intégré, tarif fixé ou encaissement activé.

## Confirmé

- Une offre d’abonnement mensuel au lancement.
- Un canal privé distinct pour les clients.
- @TheBrowser365 reste public pour la découverte.
- Activité exercée depuis la France, clients également au Congo.
- Une solution de paiement existe déjà pour les clients africains ; le propriétaire la présentera plus tard.
- Pas de lecteur vidéo intégré, pas de développement Rust pour cette évolution.

## À décider avec le propriétaire

| Sujet | Décision attendue |
|---|---|
| Pays | RDC ou République du Congo ; autres pays éventuels |
| Prix | Montants France/Congo et éventuelle différenciation |
| Devise | Devise affichée, facturée et encaissée ; frais et conversion |
| Prestataire | Solution déjà disponible, moyens acceptés, disponibilité et conditions |
| Période | Mois calendaire ou nombre fixe de jours ; date/heure d’échéance |
| Renouvellement | Manuel ou automatique, consentement et information du client |
| Achat anticipé | Prolongation de la période active, plutôt qu’une perte de jours, à confirmer |
| Activation | Événement de paiement confirmé et moment précis de début d’accès |
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
