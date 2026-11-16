"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
export function SiteHeader() {
  const path = usePathname();
  return <header className="site-header">
    <div className="site-header-inner">
      <Link href="/" className="brand" aria-label="The Browser — accueil"><span className="brand-mark" aria-hidden="true">b<span>.</span></span><span translate="no">the browser<span className="brand-dot">.</span></span></Link>
      <nav aria-label="Navigation principale" className="main-navigation">
        <Link href="/#catalogue" className={path === "/" ? "nav-link is-active" : "nav-link"} aria-current={path === "/" ? "page" : undefined}>Catalogue</Link>
        <Link href="/premium" className={path.startsWith("/premium") ? "nav-link is-active" : "nav-link"} aria-current={path === "/premium" ? "page" : undefined}>Premium<span className="nav-star" aria-hidden="true">✦</span></Link>
        <Link href="/mon-abonnement" className="account-link"><svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="8" r="3.5"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/></svg><span>Mon abonnement</span></Link>
      </nav>
    </div>
  </header>;
}
