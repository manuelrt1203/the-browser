import { CommercialPage } from "@/components/CommercialPage";
export const metadata = { title: "Remboursements — The Browser" };
export default function RefundPage() {
  return <CommercialPage title="Remboursements">
    <section><h2 className="text-xl font-semibold text-white">Vos droits</h2><p className="mt-2">Aucune garantie commerciale supplémentaire de remboursement n’est prévue. Cela ne supprime ni ne limite les droits légaux applicables, notamment en matière de rétractation et de conformité. Aucun renoncement à ces droits n’est présumé du seul fait d’un paiement.</p></section>
    <section><h2 className="text-xl font-semibold text-white">Paiement en double ou problème d’accès</h2><p className="mt-2">Une procédure de demande sera disponible avant l’ouverture des ventes pour signaler un double paiement, un paiement contesté ou un accès non fourni. Elle permettra d’identifier la commande et d’examiner la situation, sans promettre un délai ou un résultat qui ne serait pas encore défini.</p></section>
    <section><h2 className="text-xl font-semibold text-white">Préparer une demande</h2><p className="mt-2">Conservez la référence de commande affichée dans « Mon abonnement », la date et le montant du paiement, ainsi qu’une description du problème. Ne communiquez jamais de mot de passe, de code de connexion ou de numéro complet de carte bancaire.</p></section>
    <p>Les coordonnées de contact et les modalités complètes seront publiées avant l’ouverture. Les paiements de démonstration n’impliquent aucun débit réel.</p>
  </CommercialPage>;
}
