import { Suspense } from "react";
import { Catalogue } from "@/components/Catalogue";
import type { Title } from "@/data/catalogue";
import { getCatalogue, hasTmdbToken } from "@/lib/tmdb";

async function CatalogueSection() {
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
  return (
    <>
      <header className="border-b border-white/10 bg-gradient-to-b from-violet-950/60 to-transparent">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16">
          <p className="text-sm font-medium uppercase tracking-widest text-sky-300">
            Discover. Watch. Enjoy.
          </p>
          <h1 className="mt-2 text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
            The Browser
          </h1>
          <p className="mt-3 max-w-xl text-white/70">
            Notre sélection de films et séries, avec les plateformes où les
            regarder légalement en France.
          </p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
        <Suspense
          fallback={<p className="text-white/60">Chargement du catalogue…</p>}
        >
          <CatalogueSection />
        </Suspense>
      </main>

      <footer className="border-t border-white/10 px-4 py-6 text-center text-xs text-white/50">
        <p>
          Données de films et séries fournies par TMDB. Ce produit utilise
          l&apos;API TMDB mais n&apos;est ni approuvé ni certifié par TMDB.
        </p>
        <p className="mt-1">
          Informations « Où regarder » fournies par JustWatch via TMDB.
        </p>
      </footer>
    </>
  );
}
