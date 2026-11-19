import { commercialInformation } from "@/lib/commercial-information";
import { CommercialPage } from "@/components/CommercialPage";
export const metadata = { title: "Support — The Browser" };
export default function SupportPage() {
  const value = commercialInformation().supportEmail;
  const email = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(value) ? value : null;
  return <CommercialPage title="Support">
    <section><h2 className="text-xl font-semibold text-white">Nous contacter</h2>
      {email ? <p className="mt-2">Écrivez à <a href={`mailto:${email}`} className="text-sky-300 underline">{email}</a>.</p> : <p className="mt-2">L’adresse du support sera publiée avant l’ouverture des ventes. Aucun formulaire de demande n’est actuellement disponible.</p>}
    </section>
    <section><h2 className="text-xl font-semibold text-white">Pour identifier votre commande</h2><p className="mt-2">Votre espace « Mon abonnement » indique le statut, les dates et la référence de commande. Ces informations vous permettront de décrire un éventuel problème de paiement ou d’accès.</p></section>
    <section><h2 className="text-xl font-semibold text-white">Protéger votre compte</h2><p className="mt-2">Le support ne doit pas recevoir votre mot de passe Telegram, votre code de connexion, votre clé de paiement ou le numéro complet de votre carte. La confirmation de connexion passe uniquement par le bot ouvert depuis le site.</p></section>
  </CommercialPage>;
}
