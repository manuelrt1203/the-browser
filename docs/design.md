# Direction visuelle — The Browser

Choix confirmé : cinéma sombre et élégant, touches ambrées. Compétences appliquées : web-design-guidelines (règles Vercel fraîches) et vercel-react-best-practices.

- Fond graphite #101113, surfaces #191a1d, accent #e8b96b. Couleurs d’état conservées pour les confirmations/erreurs.
- Typographie Geist locale ; italique Georgia système pour le mot de découverte en accueil. Aucun téléchargement de police externe ajouté.
- Navigation et pied de page partagés, mot-symbole visuel en minuscules ; nom du produit et métadonnées inchangés.
- Accueil à trois affiches réelles du catalogue, sans classement de popularité inventé ni lecteur vidéo. La sélection visuelle n’annonce pas une nouveauté.
- Catalogue alphabétique conservé, filtres existants, recherche sans accents/casse, affiches 2:3, provenance des épisodes et liens exacts conservés. Les cartes distinguent Telegram et offres légales.
- Premium, compte et informations commerciales harmonisés. Tarifs, droits, renouvellement manuel et fermeture des ventes inchangés.

## Accessibilité et performance

Lien d’évitement, focus visible, libellés des contrôles, vrais boutons/liens, compteur annoncé, état vide avec remise à zéro, tailles des images explicites, chargement différé des affiches et priorité à l’affiche centrale. Grille avec content-visibility pour la liste de plus de cent titres. Animations limitées au survol et désactivées selon prefers-reduced-motion. Les photos sont déjà redimensionnées par le CDN TMDB ; pas de nouvelle chaîne d’optimisation payante ajoutée.

Contrôle Chromium avec catalogue réel : 107 titres, ordinateur 1440 px, mobile 390 px et contrôle de débordement à 320 px. Recherche, filtres Films/Séries, reset et sélection d’épisodes vérifiés ; pages Premium et compte mobile vérifiées (données de compte simulées). Le rendu ordinateur et mobile a été inspecté visuellement. Pas de prétention à un audit WCAG exhaustif. Les filtres restent un état local, comme avant cette refonte.

La refonte est préparée pour revue en prévisualisation ; aucune ouverture de paiements réels ni modification d’accès au canal n’en découle.

## Motion design — 17 novembre 2026

Le hero utilise désormais un coverflow à trois affiches visibles, avec jusqu’à deux affiches hors champ préchargées. Tous les titres de 2026 ayant une affiche et un lien vers une publication du canal public participent à la rotation ; aucun classement de popularité n’est inventé. Au contrôle : 23 titres éligibles parmi 107 titres du catalogue. Sélection dédupliquée et alphabétique, indépendante des filtres du catalogue.

Transitions 3D, inclinaison discrète au pointeur, entrée progressive du texte et progression du défilement. Rotation toutes les 5,5 secondes ; boutons précédent/suivant/pause, touches gauche/droite et lien vers la publication active. Pause au survol/focus, hors champ et onglet masqué. Toute navigation manuelle met le défilement en pause. Avec prefers-reduced-motion : pas de rotation automatique, pas de transition ni inclinaison, navigation manuelle conservée.

État isolé dans CinemaCarousel : l’avancement ne relance pas le rendu des 107 cartes. Les mouvements animent transform et opacity, sans dépendance d’animation supplémentaire. Tests unitaires de sélection/positions et essai Chromium de rotation, pause, navigation clavier sans focus caché, hors champ et mouvement réduit réussis ; aucun débordement à 390 et 320 px.
