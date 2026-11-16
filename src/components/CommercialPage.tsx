import Link from "next/link";
import type { ReactNode } from "react";
export function CommercialPage({ title, children }: { title: string; children: ReactNode }) {
  return <main className="mx-auto w-full max-w-3xl px-5 py-12 text-white">
    <Link href="/" className="text-amber-200 hover:underline">← Retour au catalogue</Link>
    <div className="page-intro"><p className="eyebrow">The Browser · Informations</p><h1>{title}<span className="text-[var(--amber)]">.</span></h1></div>
    <p className="mt-6 rounded-xl border border-amber-300/25 bg-amber-300/10 p-4 text-amber-100">Les ventes ne sont pas ouvertes. Ces informations préparatoires seront complétées avant toute commercialisation.</p>
    <div className="mt-8 space-y-6 leading-relaxed text-white/80">{children}</div>
    <nav aria-label="Informations commerciales" className="mt-10 flex flex-wrap gap-5 border-t border-white/10 pt-6 text-amber-200 underline"><Link href="/conditions">Conditions de vente</Link><Link href="/remboursements">Remboursements</Link><Link href="/support">Support</Link><Link href="/mon-abonnement">Mon abonnement</Link></nav>
  </main>;
}
