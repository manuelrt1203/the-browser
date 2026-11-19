import { premiumSalesEnabled } from "@/lib/premium-sales";
import { CommercialPage } from "@/components/CommercialPage";
import { commercialInformation } from "@/lib/commercial-information";
export const metadata = { title: "Informations sur l’éditeur — The Browser" };
export default function LegalPage() {
  const seller = commercialInformation();
  return <CommercialPage title="Informations sur l’éditeur">
    <section><h2 className="text-xl font-semibold">Exploitant indiqué</h2><p className="mt-2">{seller.name} · {seller.legalStatus} · {seller.country}.</p><p className="mt-2">Contact : <a className="underline" href={`mailto:${seller.supportEmail}`}>{seller.supportEmail}</a>.</p><p className="mt-2">{seller.address ? `Adresse de domiciliation : ${seller.address}` : "L’adresse de domiciliation de l’activité reste à compléter. Aucune adresse personnelle n’est publiée à cette étape."}</p><p className="mt-2">{seller.registration ? `Immatriculation : ${seller.registration}` : "Les références d’immatriculation restent à renseigner et vérifier avant l’ouverture des ventes."}</p></section>
    <section><h2 className="text-xl font-semibold">Hébergement et services</h2><p className="mt-2">Le site est hébergé sur Vercel. Le catalogue s’appuie sur les publications Telegram et les informations TMDB ; les offres de visionnage légal proviennent de JustWatch via TMDB. Les informations complètes d’hébergement et les mentions applicables seront vérifiées avant commercialisation.</p></section>
    <section><h2 className="text-xl font-semibold">État du service</h2><p className="mt-2">Le catalogue public est accessible. {premiumSalesEnabled() ? "L’accès Premium est accordé après confirmation serveur d’un paiement réel." : "Les ventes Premium ne sont pas encore ouvertes."} Les essais de paiement n’accordent pas d’accès commercial. Cette page ne remplace pas la finalisation administrative de l’activité.</p></section>
  </CommercialPage>;
}
