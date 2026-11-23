# Sécurité et fluidité — 23 novembre 2026

Première passe appliquée au code du site et à ses API. Il s’agit d’une revue ciblée avec tests de non-régression, pas d’une certification ni d’un test d’intrusion exhaustif.

## Protections livrées dans le code

- En-têtes globaux : CSP, refus d’intégration dans une iframe, MIME `nosniff`, référent désactivé, caméra/micro/géolocalisation navigateur désactivés, HSTS en production. Suppression de `X-Powered-By`. Toutes les API sont marquées privées et non stockables, y compris les réponses d’erreur.
- CSP compatible avec le rendu statique/PPR et les affiches `image.tmdb.org`. Objets, bases HTML, cadres et formulaires externes interdits ; scripts/connexions externes non autorisés par défaut. **Limite explicite :** Next génère des scripts/styles inline ; `unsafe-inline` est conservé. Ce n’est pas une CSP stricte à nonce. `unsafe-eval` est limité au développement. Le cache/PPR n’est pas remplacé par un rendu dynamique global.
- Limites distribuées via un script Lua Redis atomique, séparées entre test/live et entre opérations. Compteurs éphémères, clés contenant une empreinte SHA-256, aucune IP brute stockée dans ces clés. Réponses429 avec `Retry-After`, fenêtre fixe sans prolongation par les refus ; panne Redis →503 pour ne pas désactiver la protection.
- Seule l’adresse IP fournie par Vercel est utilisée sur Vercel (`x-vercel-forwarded-for`). Hors Vercel ou sans IP valide, les requêtes anonymes partagent une limite de repli ; un en-tête envoyé librement en développement ne choisit pas sa propre limite. Source : https://vercel.com/docs/headers/request-headers.
- API de session : `status` et, depuis la deuxième passe, une révision opaque de session sont renvoyés ; l’identifiant Telegram reste dans le service serveur. Cookies HttpOnly/Secure/SameSite, consentement, vérification du propriétaire, prix immuables et confirmation serveur des paiements conservés.
- Lecture des corps limitée pendant la consommation du flux, même sans `Content-Length` ou avec une valeur fausse. JSON objet imposé sur création/annulation Live (400/413). Notifications Telegram/Stripe/SasPay limitées à128000octets ; **octets originaux** conservés pour les signatures Stripe/SasPay.
- Après déconnexion/changement de session ou démontage du formulaire, une ancienne réponse de paiement/statut/historique ne peut plus rétablir son affichage ni provoquer une redirection tardive. Aucun paiement distant n’est annulé par une déconnexion : une tentative serveur reste récupérable dans le compte de son propriétaire.

| Opération | Limite | Sujet |
|---|---:|---|
| Nouveau lien Telegram | 20 /10min | IP de l’hébergeur |
| Lecture de session | 120 /min | IP de l’hébergeur |
| Création de paiement | 12 /min | Compte authentifié |
| Vérification de paiement | 30 /min | Compte authentifié |
| Annulation de paiement | 12 /min | Compte authentifié |
| Historique abonnement | 30 /min | Compte authentifié |
| Invitation au canal | 10 /min | Compte authentifié |

Les notifications des prestataires et la maintenance ne passent pas par ces limites utilisateur ; leurs protections par signature/secret/identité demeurent. Les clients partageant une IP peuvent partager les limites anonymes. Ces protections applicatives ne remplacent pas un filtrage volumétrique chez l’hébergeur.

## Fluidité

- Métadonnées TMDB mises en cache séparément par titre (profil Next `days`), sans saison/épisode dans la clé. Les publications, épisodes et liens Telegram sont toujours reconstruits depuis l’état actualisé du canal. Une copie du titre est enrichie, sans modifier l’objet de métadonnées en cache.
- Test réel Next/Redis isolé : après invalidation du catalogue, **zéro nouvel appel TMDB pour les titres inchangés** ; ajout d’un titre → **un seul appel** supplémentaire. Les erreurs du fournisseur ne sont pas transformées en catalogue vide.
- Fiches détaillées chargées à la demande ; recherche différée et résultats mémorisés ; décodage asynchrone des affiches. Les cartes hors écran peuvent différer leur rendu via `content-visibility`, avec espace réservé et repli CSS standard.
- Connexion Telegram : requêtes de statut sans chevauchement, vérification toutes4s uniquement pendant l’attente et quand l’onglet est visible, reprise au retour/focus, délai réseau limité. Une réponse reçue après déconnexion est ignorée.
- Une commande déjà confirmée affiche son état stocké sans nouvelle interrogation du prestataire à chaque clic de consultation. Les webhooks conservent leur propre vérification.

## Vérifications

- `npm audit --omit=dev` : aucune vulnérabilité connue signalée parmi les dépendances de production à cette date.
- 171 tests unitaires réussis, dont flux fragmenté/trop grand, JSON invalide, en-têtes et refus fermé en panne Redis.
- 15 résultats Redis réel isolé : concurrence sur les limites, exactement12autorisations sur32appels simultanés, TTL fixe, test/live séparés ; tests de paiement/authentification existants conservés.
- Parcours HTTP Live simulé et ancien parcours Stripe/SasPay test réussis : signatures, droits, propriétaires, consentements, anciens prix, nouveaux tarifs, plafonnement, corps trop grands et cache TMDB.
- Chromium sur un build Production local : réponses de session/paiement/historique retardées après déconnexion ignorées, lectures de session regroupées, aucune violation CSP. Fiches, liens directs, Échap, favoris persistants, filtres, choix des31pays, changement de moyen et anciens tarifs vérifiés ; absence de débordement320/390px.
- Lint ciblé, TypeScript et build réussis. Aucun débit réel, changement de secret ou mutation de membre Telegram effectué pour ces essais.

Les gains de cache et les comportements sont testés ; aucun score Lighthouse ou gain chiffré de temps de chargement sur les connexions réelles des clients n’est revendiqué. Le premier achat Live humain et le cycle complet d’attribution restent à observer comme auparavant.


## Livraison vérifiée

Code `cdfbfd2` sur main, Production `dpl_5p1hVQEXxSBioYpRAEyiYDhSYQLY` Ready, domaine https://the-browser-one.vercel.app. Contrôles HTTP : en-têtes présents sur pages et API, X-Powered-By absent ; session anonyme limitée àstatus ; achat anonyme401 sans cache ;31pays de paiement et109cartes catalogue, sans erreur de chargement. Readiness privé :Stripe/SasPay et leurs destinations webhook vérifiés, maintenance fraîche. Aucun débit réel ni changement des secrets/configurations des prestataires.

Chromium a également vérifié les vrais assets du domaine Production, avec compte et paiements simulés : réponses tardives ignorées après déconnexion, appels de session sans chevauchement et aucune violationCSP. Transport des ressources publiques par fetch géré/CDP dans cette machine, sans mutation de paiement.


La deuxième passe de reprise réseau et confidentialité entre sessions est décrite dans [payment-resilience.md](payment-resilience.md). La révision opaque n’est pas un identifiant Telegram ni une preuve d’authentification.
