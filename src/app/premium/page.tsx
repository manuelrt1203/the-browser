import Link from "next/link";
import { PREMIUM_OFFERS } from "@/lib/subscription";
import { PremiumDemo } from "@/components/PremiumDemo";
import { stripeTestEnabled } from "@/lib/stripe-test";
import { premiumAuthEnabled } from "@/lib/premium-auth";
import { TelegramAccount } from "@/components/TelegramAccount";
import { saspayTestEnabled } from "@/lib/saspay";

export const metadata = { title: "Premium — The Browser" };

export default function PremiumPage() {
  const demo = process.env.NODE_ENV === "development" && process.env.PREMIUM_DEMO_ENABLED === "1";
  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-12 text-white">
      <Link href="/" className="text-sky-300 hover:underline">← Retour au catalogue</Link>
      <p className="mt-10 text-sm uppercase tracking-widest text-sky-300">The Browser</p>
      <h1 className="mt-2 text-4xl font-bold">Un mois de Premium</h1>
      <p className="mt-4 text-lg text-white/70">L’accès au canal Telegram privé, après confirmation de votre paiement.</p>
      <section className="mt-8 rounded-2xl border border-violet-400/30 bg-violet-950/30 p-6">
        <h2 className="text-3xl font-bold">{PREMIUM_OFFERS.saspay.label} <span className="text-base font-normal text-white/60">par mois</span></h2>
        <p className="mt-2 text-white/70">Ou {PREMIUM_OFFERS.stripe.label} en euros.</p>
        <ul className="mt-6 space-y-3 text-white/80">
          <li>Un abonnement commencé le 10 expire le 10 du mois suivant.</li>
          <li>Si la date n’existe pas, expiration le dernier jour du mois suivant.</li>
          <li>Le catalogue public reste accessible à tous.</li>
        </ul>
        <p className="mt-6 rounded-lg bg-white/5 p-4 text-sm text-amber-100">Ouverture prochainement. Les paiements ne sont pas encore disponibles.</p>
      </section>
      {demo && <PremiumDemo />}
      {premiumAuthEnabled() && <TelegramAccount />}
      {stripeTestEnabled() && <Link href="/premium/stripe-test" className="mt-6 inline-block text-sky-300 underline">Essayer le paiement Stripe en mode test</Link>}
      {saspayTestEnabled() && <Link href="/premium/saspay-test" className="mt-6 block text-sky-300 underline">Essayer MTN / Airtel avec SasPay en mode test</Link>}
    </main>
  );
}
