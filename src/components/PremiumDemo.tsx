"use client";

import { useState } from "react";
import type { PremiumOrder } from "@/lib/subscription";

const statuses = { pending: "En attente", confirmed: "Confirmé", failed: "Refusé", cancelled: "Annulé" };

export function PremiumDemo() {
  const [provider, setProvider] = useState("saspay");
  const [outcome, setOutcome] = useState("confirmed");
  const [result, setResult] = useState<{ order: PremiumOrder; simulatedAccess: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function simulate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(""); setResult(null);
    try {
      const response = await fetch("/api/premium/demo", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, outcome }),
      });
      if (!response.ok) throw new Error("Simulation indisponible. Réessayez.");
      setResult(await response.json());
    } catch (e) { setError(e instanceof Error ? e.message : "Simulation indisponible."); }
    finally { setBusy(false); }
  }

  return (
    <section className="mt-10 rounded-2xl border border-sky-400/30 bg-sky-950/30 p-6">
      <h2 className="text-xl font-semibold">Essayer le parcours</h2>
      <p className="mt-2 text-sm text-white/70">Démonstration locale : aucun débit, aucune donnée conservée et aucun accès Telegram réel.</p>
      <form onSubmit={simulate} className="mt-5 flex flex-col gap-4">
        <label className="flex flex-col gap-2">Moyen de paiement
          <select className="rounded-lg bg-slate-900 p-3" value={provider} onChange={e => { setProvider(e.target.value); setResult(null); }}>
            <option value="saspay">SasPay — 3 000 FCFA</option>
            <option value="stripe">Stripe — 4,57 €</option>
          </select>
        </label>
        <label className="flex flex-col gap-2">Résultat à simuler
          <select className="rounded-lg bg-slate-900 p-3" value={outcome} onChange={e => { setOutcome(e.target.value); setResult(null); }}>
            {Object.entries(statuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <button disabled={busy} className="rounded-lg bg-sky-400 px-5 py-3 font-semibold text-slate-950 disabled:opacity-50">
          {busy ? "Simulation…" : "Simuler le paiement"}
        </button>
      </form>
      <div aria-live="polite" className="mt-4">
        {error && <p role="alert" className="text-amber-200">{error}</p>}
        {result && <div className="space-y-2">
          <p>Paiement simulé : <strong>{statuses[result.order.status]}</strong>.</p>
          <p>{result.simulatedAccess ? "Abonnement actif dans la simulation." : "Aucun droit premium dans la simulation."}</p>
          {result.order.expiresAt && <p>Expiration simulée : {new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short", timeZone: "UTC" }).format(new Date(result.order.expiresAt))} UTC.</p>}
        </div>}
      </div>
    </section>
  );
}
