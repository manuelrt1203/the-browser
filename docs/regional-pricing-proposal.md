# Grille régionale — approuvée le 23 novembre 2026

Statut : montants approuvés par le propriétaire (« mettons tout ça en place »). Grille mise en œuvre dans le code sous la version `2026-11-23-regional`. La priorité reste l’Europe et l’Afrique francophones. Les prix hors CFA sont des choix commerciaux arrondis, pas des cours de change ni une mesure vérifiée du pouvoir d’achat. Disponibilité de paiement vérifiée séparément, pays par pays et formule par formule.

## Bases déjà choisies

- Europe : 4,57 EUR / 13 EUR / 50 EUR pour 1 / 3 / 12 mois, tarifs conservés. Pays : France, Belgique, Luxembourg, Monaco et Suisse. La Suisse est facturée en EUR ; une carte en CHF peut subir une conversion bancaire.
- Congo-Brazzaville : 1 500 XAF / 4 000 XAF / 15 000 XAF, tarifs conservés. Extension de cette base aux pays CFA de la grille approuvée.
- Afrique hors CFA : montants locaux approuvés, avec remise trimestrielle et annuelle. Paiement de toute la période, renouvellement manuel.

## Grille approuvée

| Pays ou zone | Devise de facturation | 1 mois | 3 mois | 12 mois |
|---|---|---:|---:|---:|
| Europe francophone | EUR | 4,57 | 13 | 50 |
| Zone CFA centrale | XAF | 1 500 | 4 000 | 15 000 |
| Zone CFA occidentale | XOF | 1 500 | 4 000 | 15 000 |
| République démocratique du Congo | CDF | 6 000 | 16 000 | 60 000 |
| Guinée | GNF | 25 000 | 65 000 | 250 000 |
| Madagascar | MGA | 12 000 | 32 000 | 120 000 |
| Rwanda | RWF | 3 500 | 9 500 | 35 000 |
| Burundi | BIF | 8 000 | 21 000 | 80 000 |
| Djibouti | DJF | 500 | 1 300 | 5 000 |
| Comores | KMF | 1 250 | 3 300 | 12 500 |
| Maroc | MAD | 25 | 65 | 250 |
| Algérie | DZD | 350 | 950 | 3 500 |
| Tunisie | TND | 8 | 21 | 80 |
| Mauritanie | MRU | 100 | 270 | 1 000 |
| Maurice | MUR | 125 | 330 | 1 250 |
| Seychelles | SCR | 50 | 130 | 500 |

Zone CFA centrale : Congo-Brazzaville, Cameroun, Gabon, République centrafricaine, Tchad, Guinée équatoriale. Zone CFA occidentale francophone : Bénin, Burkina Faso, Côte d’Ivoire, Mali, Niger, Sénégal, Togo. La RDC est distincte du Congo-Brazzaville : facturation en CDF ; aucune variante commerciale USD ajoutée.

Les monnaies XAF et XOF sont distinctes malgré le même libellé FCFA. Ne pas les confondre dans les commandes. Tous les montants de cette grille sont en unités principales de la monnaie, jamais en centimes ou millièmes techniques.

## Vérifications et limites de couverture

Source lue le 23 novembre 2026 : https://api.saspay.me/api/v1/countries/ (HTTP200, endpoint public documenté). Référence API : https://docs.saspay.me/llms.txt et https://docs.saspay.me/api-reference/openapi.json. Le registre public ne prouve pas la disponibilité d’un encaissement pour notre marchand. /pricing/my-rates/ est la source authentifiée à vérifier avant activation, réseau par réseau et avec ses minimums/frais.

Dans ce registre public, Luxembourg (LU), Tchad (TD) et Guinée équatoriale (GQ) sont actuellement inactifs. Cela ne tranche pas l’acceptation d’une carte Stripe ni ne valide tous les autres pays marqués actifs. Le champ CSV saspay_public_country_active rapporte uniquement cet état observé.

Le registre SasPay indique CHF pour la Suisse ; la facturation EUR est notre choix commercial. Il comporte aussi des entrées techniques non ISO (notamment XC pour RDC en USD), qui ne doivent pas devenir des pays de résidence dans le site. Ne pas déduire automatiquement les règles de devises d’une simple liste du fournisseur.

## Règles mises en place

1. Le pays de facturation détermine la grille et la devise ; le choix Stripe/SasPay n’attribue plus à lui seul un tarif européen ou africain.
2. La localisation peut proposer un pays, puis le client le confirme et voit le montant total avant paiement. Une IP seule ne constitue pas une preuve de résidence. Le pays est déclaratif et doit être confirmé avec le consentement. Stripe collecte l’adresse de facturation. Aucun contrôle fort de résidence ni blocage fondé sur une IP seule n’est revendiqué.
3. Le tarif source de la zone est identique quel que soit le prestataire disponible : par exemple France en EUR, Congo-Brazzaville en XAF, Sénégal en XOF. Une conversion éventuelle reste affichée par le prestataire.
4. Le pays, la zone, la devise, le montant, le plan et la version tarifaire sont figés dans une nouvelle commande. Les anciennes commandes, consentements et droits restent intacts.
5. Le changement de pays ou de formule d’une tentative suit l’annulation sûre déjà existante, puis une nouvelle commande.
6. Les pays hors du périmètre francophone et les moyens de paiement non confirmés ne reçoivent pas automatiquement un tarif CFA. Définir leur politique séparément.

Détail par pays : [CSV](regional-pricing-proposal.csv). Grille de 31 pays : 5 en Europe et 26 en Afrique.


## Disponibilité technique et compatibilité

Le module `regional-payments.ts` lit le pays du compte Stripe et ses `supported_payment_currencies` via Country Specs, ainsi que `/pricing/my-rates/` côté SasPay Live. Pour SasPay, un réseau payin actif du pays, dans la bonne devise, doit posséder une tranche couvrant le montant de la formule. Une liste de tranches vide ne constitue pas une validation des limites. Les pseudo-pays internationaux ne sont pas étendus automatiquement à tous les pays. Lectures réussies mises en cache cinq minutes, erreurs réessayées après quinze secondes. Une panne ne réactive jamais un moyen non vérifié. Le serveur revérifie la disponibilité avant de créer toute nouvelle commande.

Chaque prix stocké est en unités mineures de sa devise : EUR/CDF/MAD/DZD/MRU/MUR/SCR à deux décimales, TND à trois, autres devises de la grille à zéro. SasPay reçoit une chaîne décimale en unités principales ; Stripe reçoit un entier en unités mineures. Aucune conversion de prix maison ou demande de taux externe n’est effectuée. Stripe Adaptive Pricing est désactivé.

La nouvelle API Live impose un pays proposé ; le navigateur ne peut imposer ni montant, ni devise, ni zone. Un pays hors périmètre n’obtient pas silencieusement le prix CFA. Les deux générations historiques de commandes (mensuel 3000 XAF et plans du 22 novembre) gardent leur tarif, durée, confirmation et consentement d’origine. Les pilotes de test historiques sont conservés séparément et ne simulent pas l’activation Live.

Validation : 165 tests unitaires, intégration HTTP Live et ancien parcours test avec Redis isolé, 14 tests Redis réel isolé ; contrôles de prix/devise, pays invalide, modification du pays refusée, prestataire indisponible, doublons et confirmation. Tests réels sans paiement : six sessions SasPay Sandbox en EUR/XAF/XOF/CDF/MGA/TND créées, validées et annulées ; cinq sessions Stripe test EUR/XAF/XOF/CDF/MGA au prix attendu puis expirées. Chromium : suggestion de pays, 31 pays, prix, changement de moyen, consentement réinitialisé, pays indisponible, absence de débordement 320/390px, reprise d’un ancien 3000 XAF, tableau des tarifs. Aucun débit Live ni modification d’un membre Telegram.
