import Link from "next/link";
export function SiteFooter() {
  return <footer className="site-footer"><div className="site-footer-inner">
    <div><Link href="/" className="footer-brand" translate="no">the browser<span>.</span></Link><p className="mt-3 text-sm text-white/55" translate="no">Discover. Watch. Enjoy.</p></div>
    <nav aria-label="Informations et assistance" className="footer-links"><Link href="/conditions">Conditions de vente</Link><Link href="/remboursements">Remboursements</Link><Link href="/support">Support</Link></nav>
    <p className="footer-credits">Données fournies par TMDB. Ce produit utilise l’API TMDB mais n’est ni approuvé ni certifié par TMDB.<br />Informations « Où regarder » fournies par JustWatch via TMDB.</p>
  </div></footer>;
}
