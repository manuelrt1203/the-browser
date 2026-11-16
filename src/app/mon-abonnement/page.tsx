import Link from "next/link";
import { premiumAuthEnabled } from "@/lib/premium-auth";
import { SubscriptionAccount } from "@/components/SubscriptionAccount";
export const metadata = { title: "Mon abonnement — The Browser" };
export default function SubscriptionPage() {
  return <main className="mx-auto w-full max-w-3xl px-5 py-12 text-white">
    <Link href="/" className="text-sky-300 hover:underline">← Retour au catalogue</Link>
    <h1 className="mt-8 text-4xl font-bold">Mon abonnement</h1>
    <p className="mt-4 text-white/70">Retrouvez votre statut, votre échéance et votre accès au canal privé.</p>
    {premiumAuthEnabled() ? <SubscriptionAccount /> : <p className="mt-6 text-amber-100">La connexion est momentanément indisponible.</p>}
  </main>;
}
