import { Suspense } from "react";
import { PremiumCheckout } from "@/components/PremiumCheckout";
import { premiumSalesEnabled, liveProviderEnabled } from "@/lib/premium-sales";
import Link from "next/link";
import { PREMIUM_OFFERS } from "@/lib/subscription";
import { PremiumDemo } from "@/components/PremiumDemo";
import { stripeTestEnabled } from "@/lib/stripe-test";
import { premiumAuthEnabled } from "@/lib/premium-auth";
import { TelegramAccount } from "@/components/TelegramAccount";
import { saspayTestEnabled } from "@/lib/saspay";
import { premiumChannelAccessEnabled } from "@/lib/premium-channel-access";
import { PremiumChannelAccess } from "@/components/PremiumChannelAccess";
export const metadata = { title: "Premium — The Browser" };
export default function PremiumPage() {
  const sales = premiumSalesEnabled();
  const demo = process.env.NODE_ENV === "development" && process.env.PREMIUM_DEMO_ENABLED === "1";
  return <main className="mx-auto w-full max-w-5xl px-5 pb-16 text-white sm:px-8">
    <div className="premium-layout mt-8 sm:mt-14">
      <div className="page-intro !mt-0"><p className="eyebrow">The Browser Premium</p><h1>Vos découvertes.<br /><span className="text-[var(--amber)]">Un accès privilégié.</span></h1><p>Retrouvez l’accès au canal Telegram privé dans un abonnement mensuel, associé à votre compte.</p><Link href="/mon-abonnement" className="button-primary mt-7">Mon abonnement <span aria-hidden="true">↗</span></Link><Link href="/" className="button-secondary mt-3 block">Explorer le catalogue public →</Link></div>
      <section className="premium-price" aria-labelledby="offre-titre"><p className="eyebrow">Une formule. Un mois.</p><h2 id="offre-titre">{PREMIUM_OFFERS.saspay.label} <span>/ mois</span></h2><p className="mt-2 text-sm text-white/55">{!sales || liveProviderEnabled("stripe") ? <>Ou {PREMIUM_OFFERS.stripe.label} en euros.</> : "Le paiement par carte sera proposé prochainement."}</p><ul className="premium-perks"><li>Accès au canal privé après confirmation du paiement.</li><li>Du 10 au 10 du mois suivant, ou au dernier jour si la date n’existe pas.</li><li>Renouvellement manuel, sans prélèvement automatique.</li><li>Le catalogue public reste accessible à tous.</li></ul><p className="premium-notice">{sales ? "Choisissez votre moyen de paiement ci-dessous." : "Ouverture prochainement. Les paiements ne sont pas encore disponibles."}</p></section>
    </div>
    <div className="mx-auto max-w-2xl">{sales && <Suspense fallback={<p>Chargement du paiement…</p>}><PremiumCheckout stripe={liveProviderEnabled("stripe")} saspay={liveProviderEnabled("saspay")} termsVersion={process.env.COMMERCIAL_TERMS_VERSION!} /></Suspense>}{demo && <PremiumDemo />}{!sales && premiumAuthEnabled() && <TelegramAccount />}{premiumChannelAccessEnabled() && <PremiumChannelAccess />}
    {stripeTestEnabled() && <Link href="/premium/stripe-test" className="button-secondary mt-6">Essayer le paiement Stripe en mode test →</Link>}
    {saspayTestEnabled() && <Link href="/premium/saspay-test" className="button-secondary mt-3">Essayer MTN / Airtel avec SasPay en mode test →</Link>}</div>
  </main>;
}
