# Accès gratuit conditionné à l’adhésion — 25 novembre 2026

Décision : imposer l’adhésion **gratuite** au canal public The Browser via le bot, indépendamment des abonnements Premium. Aucun paiement ni accès Premium accordé par ce parcours.

## Pour un spectateur

1. Ouvrir « Regarder / Télécharger · Gratuit » depuis le catalogue ou une nouvelle annonce du canal.
2. Le lien démarre @Thebrowser365_bot avec la référence du fichier ou de la publication.
3. Si le compte n’est pas membre, le bot propose « Rejoindre le canal gratuitement » puis « J’ai rejoint · Vérifier ».
4. Le bot consulte `getChatMember` à chaque demande. Membre, administrateur, créateur, ou membre restreint avec `is_member=true` : accès autorisé. Non-membre/statut inconnu/panne : aucun fichier livré.
5. Pour un fichier publié avec le nouveau système, le bot envoie la vidéo ou le document dans la conversation privée. Pour une ancienne vidéo non migrée, il fournit son lien public après vérification.

**Limite Telegram : une vidéo restée directement dans un canal public demeure accessible par son URL, même sans adhésion. Le parcours du bot ne peut pas changer cette règle. Une protection réelle exige de remplacer le média public par une annonce.** Une copie déjà reçue ne peut pas être révoquée.

## Publier un nouveau fichier, en tant que propriétaire

1. Envoyer le fichier original au bot en privé.
2. Répondre **à ce fichier** avec `/publiergratuit`.
3. Si nécessaire, préciser le titre/l’année/la saison et l’épisode ou un lien TMDB, par exemple `/publiergratuit https://www.themoviedb.org/movie/19995`.
4. Le bot prépare un aperçu. Confirmer « Publier l’annonce gratuite » pour publier dans le canal public.

Une affiche TMDB est utilisée si le titre est identifié sans ambiguïté et dispose d’une affiche ; sinon une annonce texte peut être créée. La vidéo n’est jamais jointe à l’annonce publique. Le fichier reste référencé par son `file_id` Telegram côté serveur, sans téléchargement sur Vercel ni exposition au navigateur. Le nom du fichier et la numérotation du titre sont conservés. Les commandes ne publient rien à la simple réception d’un média : commande et confirmation du propriétaire nécessaires.

## Remplacer une ancienne vidéo publique

1. Fournir au bot le fichier original, avec son nom de fichier d’origine.
2. Répondre au fichier avec `/protegergratuit https://t.me/TheBrowser365/ID` (remplacer ID par le véritable numéro du message).
3. Le bot vérifie le message dans le catalogue, son nom de fichier et la présence d’une affiche fiable, puis montre l’URL exacte à modifier et le fichier sauvegardé.
4. Après confirmation « Remplacer la vidéo par l’affiche », il conserve d’abord la référence privée du fichier puis utilise `editMessageMedia` sur ce seul message. L’ID public reste inchangé ; aucune suppression de message ni migration en masse.

L’action attend une copie originale ou un transfert provenant du canal public configuré. Un transfert d’un autre canal, notamment Premium, est refusé. Un document faisant partie d’un album ne peut pas être remplacé par une photo : créer une nouvelle annonce avec `/publiergratuit` ; l’ancien message restera public jusqu’à traitement séparé.

**Observation du25novembre : le canal active la protection Telegram contre les transferts/enregistrements.** Les anciens fichiers ne sont donc pas automatiquement transférés, copiés ou téléchargés par cet outil. Leur original doit être fourni au bot par le propriétaire. La configuration de protection du canal n’est pas modifiée.

Un rejet Telegram explicite laisse le brouillon disponible pour une nouvelle confirmation manuelle. Une réponse réseau ambiguë garde une réservation durable : aucune répétition automatique. Le fichier privé reste conservé ; il faut vérifier la publication avant toute reprise opérateur. Une erreur de persistance après publication exige également une vérification, jamais un nouvel envoi à l’aveugle.

## Administration et sécurité

- `/gratuit` explique le parcours. Les instructions de publication ne sont montrées qu’au propriétaire.
- Publication, remplacement, annulation de brouillon et désactivation exigent le rôle Telegram `creator` actuel du **canal public**, et le compte ayant préparé le brouillon. Un administrateur ordinaire n’est pas autorisé par défaut.
- La confirmation d’une publication publiée propose « Désactiver cet accès gratuit ». Cela ferme les nouvelles livraisons du fichier ; aucune suppression de message ou de fichier Telegram.
- Drapeau serveur : `TELEGRAM_FREE_GATE_ENABLED=1`, uniquement en Production. Le webhook existant et ses secrets restent inchangés. Les préfixes `free_…` sont séparés de `premium_test/live_…`, des commandes de copie et des paiements.
- Le bot doit être administrateur du canal public pour vérifier les membres, avec publication et édition pour les annonces/remplacements. Contrôle réel du25novembre : @Thebrowser365_bot administrateur, `can_post_messages=true`, `can_edit_messages=true`.
- Redis : espace `the-browser:{telegram-free:CHANNEL_ID}:…`, distinct des paiements et du catalogue source. Fichiers référencés en privé ; manifeste public sans `file_id`, avec uniquement token public, métadonnées, numérotation et ID d’annonce. Le catalogue réunit ce manifeste aux publications sans perdre le lien si le webhook de l’annonce arrive avant/après sa création.
- Jetons opaques24caractères ; aucune entrée ne peut choisir un autre canal, une URL de fichier ou un fichier Premium. Les anciens liens `free_post_ID` sont validés dans le catalogue source ; après migration ils retrouvent le fichier privé correspondant.
- Limite12demandes/minute par utilisateur ; traces de livraison conservées24h avec déduplication des retries d’un même update. Une erreur Redis ou de lecture de membre n’est pas un succès. Aucune conservation d’un état « abonné » en cache entre demandes.
- Les annonces protégées ne sont pas traitées comme des vidéos par `/copier` : copier leur message public ne copierait que l’affiche. Les anciennes commandes de copie et les paiements conservent leur fonctionnement.
- La désactivation du drapeau coupe le bot gratuit ; les nouveaux fichiers protégés ne disposent pas d’un repli public vers leurs octets.

Diagnostic privé en lecture : `GET /api/telegram/free/readiness`, authentification de maintenance existante. Renvoie droits, nombre d’annonces protégées et de médias historiques restants, sans référence de fichier, identité utilisateur ni secret.

## Validation

181tests unitaires réussis ;14résultats Redis isolé pour le parcours gratuit, plus8résultats de non-régression des copies. Propriétaire/non-membre/membre, statut restreint, identités mal formées, canal étranger/Premium, confirmation, annulation concurrente, remplacement ciblé, désactivation, perte de réponse, rejet explicite et absence de doublons testés.

Parcours HTTP Next/Redis avec Telegram simulé : aperçu sans publication, confirmation puis affiche seule, manifeste avant webhook de canal, lien du catalogue, référence privée absente du HTML, non-membre refusé et membre recevant le fichier. Parcours de paiement Live simulé conservé. Chromium : fiche directe, annonce protégée prioritaire, anciens liens via le bot, texte d’adhésion gratuite, aucune référence privée exposée,320/390px. Lint/TypeScript/build réussis.

Aucun fichier réel publié, remplacé ou livré par les tests automatisés ; aucune vidéo historique modifiée sans commande/confirmation du propriétaire. Le premier essai humain du bot reste à effectuer avec un fichier original.

Référence de méthodes consultée : SDK python-telegram-bot, `src/telegram/_bot.py` (getChatMember, sendVideo/sendDocument/sendPhoto, editMessageMedia) ; le site core.telegram.org n’était pas accessible depuis la politique réseau de cette machine. Les méthodes de lecture ont également été vérifiées sur le vrai bot, sans message envoyé.
