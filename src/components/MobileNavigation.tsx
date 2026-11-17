"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { catalogueHref } from "@/lib/catalogue-browsing";
export function MobileNavigation() {
  const path = usePathname(), params = useSearchParams();
  const here = path === "/" ? new URLSearchParams(params.toString()) : new URLSearchParams();
  const saved = path === "/" && params.get("vue") === "a-voir";
  return <nav className="mobile-navigation" aria-label="Navigation mobile">
    <Link href="/#catalogue" aria-current={path === "/" && !saved ? "page" : undefined}><svg aria-hidden="true" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>Catalogue</Link>
    <Link href={catalogueHref(here,{focus:"recherche",fiche:null})} onClick={event => { const input = document.querySelector<HTMLInputElement>("#recherche"); if (path === "/" && input && !event.ctrlKey && !event.metaKey && !event.shiftKey) { event.preventDefault(); input.focus(); input.scrollIntoView({ block: "center", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" }); } }}><svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg>Recherche</Link>
    <Link href="/?vue=a-voir#catalogue" aria-current={saved ? "page" : undefined}><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M20.4 4.6a5.4 5.4 0 0 0-7.6 0l-.8.8-.8-.8a5.4 5.4 0 0 0-7.6 7.6L12 21l8.4-8.8a5.4 5.4 0 0 0 0-7.6Z"/></svg>À voir</Link>
    <Link href="/mon-abonnement" aria-current={path === "/mon-abonnement" ? "page" : undefined}><svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 22v-2a8 8 0 0 1 16 0v2"/></svg>Compte</Link>
  </nav>;
}
