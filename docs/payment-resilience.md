# Reprise des parcours privés — 23 novembre 2026

Suite de la demande sécurité/fluidité. Aucun tarif, droit ou secret de prestataire modifié ; aucun nouvel essai de débit réel.

## Délais et reprise

`client-request.ts` encadre les en-têtes **et** le corps JSON, même si un transport ignore son signal d’annulation. Aucun retry automatique des POST. Délais :15s pour session/historique,30s pour options,45s pour statut/invitation,90s pour création/annulation. Annulation d’affichage et délai dépassé ne prouvent jamais qu’une opération serveur a échoué.

La référence de tentative est inscrite dans l’URL avant l’envoi du paiement. Une perte de réponse conserve cet UUID, affiche la référence et propose de vérifier la tentative ; aucun second paiement n’est créé pour une simple vérification. Le choix n’est débloqué directement que si l’API confirme `attemptCreated:false` ; autrement, l’annulation sûre existante reste nécessaire. Un verrou client empêche deux envois simultanés avant même le prochain rendu React. Une formule/montant n’est plus supposé pour une référence revenue dans l’URL avant lecture de la commande.

Les erreurs429 tiennent compte de `Retry-After` et affichent un délai avec boutons bloqués jusqu’à échéance. Hors ligne, réponse invalide, chargement bloqué et panne serveur produisent un message lisible. L’historique peut être actualisé après une panne ; un dépassement de délai ne laisse pas son indicateur actif indéfiniment.

## Confidentialité entre sessions

La réponse de session renvoie son statut et, uniquement si connecté, une **révision opaque** de32caractères. C’est un SHA-256 préfixé `ui-session:` puis tronqué, distinct du hash de stockage d’authentification. Ni l’identifiant Telegram, ni le jeton de cookie ne sont renvoyés. Cette révision n’est jamais acceptée comme preuve de connexion.

Au retour/focus, une nouvelle révision permet de détecter une autre session même si le statut reste « connecté ». Ancien historique, tentative affichée et lien privé sont effacés ; les requêtes tardives ne rétablissent pas l’ancien état. L’espace abonnement charge l’historique du compte courant. Un événement navigateur sert seulement à effacer l’affichage des composants privés ; toutes les autorisations restent vérifiées côté serveur.

L’API d’invitation renvoie la véritable échéance `inviteExpiresAt` en secondes Unix, distincte de la date de fin d’abonnement. Le lien est retiré à cette échéance et un nouveau lien peut être demandé. Une réponse d’invitation reçue après déconnexion/changement de session/démontage est ignorée. Les admissions restent liées au compte payé, et l’expiration réelle demeure contrôlée par Telegram/serveur, indépendamment de l’horloge d’affichage du navigateur.

## Disponibilité des paiements

Les options exposent un état `ready`, `disabled` ou `unavailable` pour chaque prestataire, sans erreur interne ni clé. Une panne de vérification n’est plus présentée comme l’absence définitive d’un moyen pour le pays. Le prestataire sain reste utilisable ; le formulaire propose de revérifier. Le serveur refuse avant création une commande dont le prestataire est momentanément non vérifiable.

Cache à lecture unique pendant une requête en cours, durée calculée **après** résolution :5min si les lectures réussissent,15s après panne ou exception. Aucun maintien de l’échec pendant5min, aucun repli activant un prestataire non vérifié. Les réseaux, limites, devises et tarifs déjà validés restent les mêmes.

## Vérifications

- 178 tests unitaires réussis : délais sur transport/corps bloqués, annulation même ignorée par le transport, aucun retry POST implicite, Retry-After, preuve de non-création conservée, révision opaque, cache concurrent et reprise après panne, véritable échéance d’invitation.
- Parcours HTTP Live simulé et ancien parcours Stripe/SasPay test avec Redis isolé réussis ; confirmations, consentement, signatures, tarifs et propriétaire inchangés. La réponse session test vérifie la présence de la révision et l’absence de l’identité Telegram.
- Chromium build Production avec comptes et prestataires simulés : réponse paiement perdue/UUID conservé/un seul POST, vérification sans nouveau paiement, lien réellement expiré, session connecté→connecté remplacée, invitation tardive ignorée, compteur429, historique bloqué puis repris, panne distincte du pays non couvert, tarifs31pays, ancien prix,320/390px et aucune violation CSP.
- Lint ciblé, TypeScript et build réussis. Ces tests ne remplacent pas l’observation du premier achat Live humain.


## Livraison et reprise vérifiées

Code `174bfe1` sur main, Production `dpl_ErycLeV2a42CRRDo1fL19jQJa4Ak` Ready sur https://the-browser-one.vercel.app. Vérifications initiales du23novembre : catalogue200 avec109cartes, options31pays et prestatairesStripe/SasPay `ready`, paiement anonyme401, comptes/webhooks et maintenance confirmés par contrôle privé. Chromium a également vérifié les vrais assets publics, avec comptes et paiements simulés ; le transport des ressources publiques utilise fetch géré/CDP dans cette machine. Aucun débit réel ni message/mutation de membre Telegram.

Le24novembre, à la reprise : même déploiement toujoursReady ; options200 avec31pays et deuxprestatairesready ; contrôle privé200 avec comptes, webhooks et ordonnanceur frais. Seul le compte rendu et la mémoire sont finalisés à cette reprise, sans nouvelle publication applicative.
