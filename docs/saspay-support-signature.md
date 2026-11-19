# Diagnostic signature webhook SasPay sandbox

> Mise à jour du 19 novembre : le diagnostic initial ci-dessous est historique. Une erreur de configuration côté application a été identifiée : un marqueur de substitution cloud est utilisé comme clé HMAC sur les previews existantes. Le succès du test synthétique ne validait donc pas le véritable secret SasPay. Correction du contrôle préparée ; saisir le vrai secret dans Vercel Preview, redéployer et mettre à jour l’URL SasPay avant le prochain renvoi. Ne pas transmettre ce rapport initial comme preuve d’un défaut fournisseur.

Bonjour,

Notre intégration sandbox rencontre un refus de signature sur les notifications transaction.created et transaction.success. Pourriez-vous vérifier les en-têtes et la signature effectivement émis par le sandbox ?

## Éléments vérifiés le 16 novembre 2026

- API appelée exclusivement : https://sandbox-api.saspay.me/api/v1.
- Paiements MTN Congo-Brazzaville, 3000 XAF, numéro de test finissant par 0 : verify renvoie SUCCESS.
- Webhook actif SANDBOX, adresse : https://the-browser-ct93diwel-manuels-projects-d0a3bea0.vercel.app/api/saspay/test/webhook.
- Les livraisons atteignent l’application et reçoivent HTTP 400 avec « Signature ou horodatage invalide ».
- Le serveur suit votre documentation : HMAC-SHA256 avec le signing_secret brut sur timestamp + point + corps brut, signature hexadécimale minuscule, comparaison en temps constant, tolérance 300 secondes.
- Un webhook.test synthétique signé avec le secret configuré reçoit HTTP 200 ; une mauvaise signature reçoit HTTP 400.
- La valeur configurée ne contient ni espace de début/fin ni guillemets d’encadrement.
- La liste et le détail des journaux API contiennent payload et réponse, mais pas les en-têtes de la requête ; nous ne pouvons donc pas comparer la signature et l’horodatage émis.

## Demande

Merci de vérifier sur les livraisons refusées : présence et format de X-Webhook-Signature et X-Webhook-Timestamp (secondes Unix), signature calculée sur les octets exacts envoyés, et utilisation du signing_secret du webhook sandbox recréé. Pouvez-vous confirmer si la signature suit bien timestamp.corps_brut ?

Nous n’avons pas désactivé la vérification et ne considérons pas le paiement comme une livraison réussie. Aucun secret ni clé API n’est inclus dans ce rapport. L’origine exacte du refus n’est pas encore établie.
