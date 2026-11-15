import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { stripeTestEnabled } from "@/lib/stripe-test";
import { StripeTestCheckout } from "@/components/StripeTestCheckout";

export const metadata = { title: "Test Stripe — The Browser", robots: { index: false, follow: false } };

export default function StripeTestPage() {
  if (!stripeTestEnabled()) notFound();
  return <main className="mx-auto w-full max-w-3xl px-5 py-12 text-white">
    <Link href="/premium" className="text-sky-300 hover:underline">← Retour à Premium</Link>
    <Suspense fallback={<p>Chargement du paiement de test…</p>}><StripeTestCheckout /></Suspense>
  </main>;
}
