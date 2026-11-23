# Grille régionale — proposition du 23 novembre 2026

Statut : proposition commerciale à discuter, sans modification des tarifs de Production. Priorité confirmée par le propriétaire : Europe francophone et Afrique francophone. Les prix hors zone CFA ci-dessous sont des suggestions commerciales arrondies, pas des cours de change ni une mesure vérifiée du pouvoir d’achat. Aucun nouveau montant ne doit être présenté comme validé sans décision du propriétaire.

## Bases déjà choisies

- Europe : 4,57 EUR / 13 EUR / 50 EUR pour 1 / 3 / 12 mois, tarifs conservés. Pays proposés : France, Belgique, Luxembourg, Monaco et Suisse. La Suisse serait facturée en EUR ; une carte en CHF peut subir une conversion bancaire.
- Congo-Brazzaville : 1 500 XAF / 4 000 XAF / 15 000 XAF, tarifs conservés. Extension de cette base aux autres pays CFA proposée.
- Afrique hors CFA : montants locaux à valider, avec remise trimestrielle et annuelle. Paiement de toute la période, renouvellement manuel.

## Grille proposée

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

Zone CFA centrale : Congo-Brazzaville, Cameroun, Gabon, République centrafricaine, Tchad, Guinée équatoriale. Zone CFA occidentale francophone : Bénin, Burkina Faso, Côte d’Ivoire, Mali, Niger, Sénégal, Togo. La RDC est distincte du Congo-Brazzaville : proposition en CDF, avec une éventuelle variante USD à décider.

Les monnaies XAF et XOF sont distinctes malgré le même libellé FCFA. Ne pas les confondre dans les commandes. Tous les montants de cette grille sont en unités principales de la monnaie, jamais en centimes ou millièmes techniques.

## Vérifications et limites de couverture

Source lue le 23 novembre 2026 : https://api.saspay.me/api/v1/countries/ (HTTP200, endpoint public documenté). Référence API : https://docs.saspay.me/llms.txt et https://docs.saspay.me/api-reference/openapi.json. Le registre public ne prouve pas la disponibilité d’un encaissement pour notre marchand. /pricing/my-rates/ est la source authentifiée à vérifier avant activation, réseau par réseau et avec ses minimums/frais.

Dans ce registre public, Luxembourg (LU), Tchad (TD) et Guinée équatoriale (GQ) sont actuellement inactifs. Cela ne tranche pas l’acceptation d’une carte Stripe ni ne valide tous les autres pays marqués actifs. Le champ CSV saspay_public_country_active rapporte uniquement cet état observé.

Le registre SasPay indique CHF pour la Suisse ; la facturation EUR serait notre choix commercial. Il comporte aussi des entrées techniques non ISO (notamment XC pour RDC en USD), qui ne doivent pas devenir des pays de résidence dans le site. Ne pas déduire automatiquement les règles de devises d’une simple liste du fournisseur.

## Règles proposées pour la mise en place

1. Le pays de facturation détermine la grille et la devise ; le choix Stripe/SasPay n’attribue plus à lui seul un tarif européen ou africain.
2. La localisation peut proposer un pays, puis le client le confirme et voit le montant total avant paiement. Une IP seule ne constitue pas une preuve de résidence. La politique de contrôle du pays reste à préciser.
3. Le tarif source de la zone est identique quel que soit le prestataire disponible : par exemple France en EUR, Congo-Brazzaville en XAF, Sénégal en XOF. Une conversion éventuelle reste affichée par le prestataire.
4. Le pays, la zone, la devise, le montant, le plan et la version tarifaire sont figés dans une nouvelle commande. Les anciennes commandes, consentements et droits restent intacts.
5. Le changement de pays ou de formule d’une tentative suit l’annulation sûre déjà existante, puis une nouvelle commande.
6. Les pays hors du périmètre francophone et les moyens de paiement non confirmés ne reçoivent pas automatiquement un tarif CFA. Définir leur politique séparément.

Détail par pays : [CSV](regional-pricing-proposal.csv). Proposition de 31 pays : 5 en Europe et 26 en Afrique.
