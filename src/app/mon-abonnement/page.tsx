import Link from "next/link";
import { premiumAuthEnabled } from "@/lib/premium-auth";
import { SubscriptionAccount } from "@/components/SubscriptionAccount";
export const metadata = { title: "Mon abonnement — The Browser" };
export default function SubscriptionPage() {
  return <main className="mx-auto w-full max-w-3xl px-5 py-12 text-white">
    <Link href="/" className="text-amber-200 hover:underline">← Retour au catalogue</Link>
    <div className="page-intro"><span className="eyebrow">Votre espace personnel</span><h1>Mon abonnement<span className="text-[var(--amber)]">.</span></h1><p>Votre statut, votre échéance et votre accès au canal privé. Tout est ici.</p></div>
    {premiumAuthEnabled() ? <SubscriptionAccount /> : <p className="mt-6 text-amber-100">La connexion est momentanément indisponible.</p>}
  </main>;
}
