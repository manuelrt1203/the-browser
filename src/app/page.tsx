import { Suspense } from "react";
import { connection } from "next/server";
import { Catalogue } from "@/components/Catalogue";
import type { Title } from "@/data/catalogue";
import { getCatalogue, hasTmdbToken } from "@/lib/tmdb";

async function CatalogueSection() {
  await connection();
  if (!hasTmdbToken()) {
    return (
      <p className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-6 text-amber-100">
        Le catalogue n&apos;est pas encore configuré : ajoutez{" "}
        <code className="font-mono">TMDB_READ_TOKEN</code> dans{" "}
        <code className="font-mono">.env.local</code>.
      </p>
    );
  }

  let items: Title[];
  try {
    items = await getCatalogue();
  } catch {
    return (
      <p className="rounded-xl border border-white/10 bg-white/5 p-6 text-white/70">
        Le catalogue est momentanément indisponible. Réessayez dans quelques
        instants.
      </p>
    );
  }

  if (items.length === 0) {
    return (
      <p className="rounded-xl border border-white/10 bg-white/5 p-6 text-white/70">
        Aucun titre à afficher pour le moment.
      </p>
    );
  }

  return <Catalogue items={items} />;
}

export default function Home() {
  return <main className="catalogue-page">
    <Suspense fallback={<div className="catalogue-loading" role="status"><span className="eyebrow">Votre prochaine découverte</span><h1>Le cinéma vous attend.</h1><p>Chargement du catalogue…</p><div className="loading-posters" aria-hidden="true"><span /><span /><span /><span /><span /></div></div>}>
      <CatalogueSection />
    </Suspense>
  </main>;
}
