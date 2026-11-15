"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { TelegramAccount } from "./TelegramAccount";

const labels: Record<string, string> = {
  pending: "En attente de confirmation du paiement", confirmed: "Paiement de test confirmé",
  failed: "Paiement de test refusé", cancelled: "Session de test expirée",
};

export function StripeTestCheckout() {
  const orderId = useSearchParams().get("order") ?? "";
  const [attemptId, setAttemptId] = useState("");
  const [result, setResult] = useState<{ status: string; expiresAt: string | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [connected, setConnected] = useState(false);

  async function checkout() {
    setBusy(true); setError("");
    const id = attemptId || crypto.randomUUID();
    setAttemptId(id);
    try {
      const response = await fetch("/api/stripe/test/checkout", { method: "POST",
        headers: { "Idempotency-Key": id } });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Checkout indisponible");
      window.location.assign(data.checkoutUrl);
    } catch (e) { setError(e instanceof Error ? e.message : "Checkout indisponible"); setBusy(false); }
  }

  async function refresh() {
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/stripe/test/status?order=${encodeURIComponent(orderId)}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Statut indisponible");
      setResult(data);
    } catch (e) { setError(e instanceof Error ? e.message : "Statut indisponible"); }
    finally { setBusy(false); }
  }

  return (
    <section className="mt-8 rounded-2xl border border-sky-400/30 bg-sky-950/30 p-6">
      <h1 className="text-3xl font-bold">Essayer Stripe — 4,57 €</h1>
      <p className="mt-4 text-white/70">Environnement de test uniquement. Utilisez les moyens de paiement de test Stripe, sans argent réel. Aucun accès Telegram ne sera accordé.</p>
      <TelegramAccount onChange={setConnected} />
      {!orderId ? <button onClick={checkout} disabled={busy || !connected} className="mt-6 rounded-lg bg-sky-300 px-5 py-3 font-semibold text-slate-950 disabled:opacity-50">
        {busy ? "Ouverture…" : "Ouvrir le paiement Stripe de test"}
      </button> : <>
        <p className="mt-6 text-white/70">Votre retour sur le site ne confirme pas le paiement. Le statut ci-dessous dépend de la notification Stripe vérifiée par le serveur.</p>
        <button onClick={refresh} disabled={busy || !connected} className="mt-4 rounded-lg border border-sky-300/50 px-5 py-3 disabled:opacity-50">
          {busy ? "Vérification…" : "Vérifier la confirmation"}
        </button>
        <a href="/premium/stripe-test" className="ml-4 inline-block text-sky-300 underline">Nouvel essai</a>
      </>}
      <div className="mt-5 space-y-2" aria-live="polite">
        {error && <p role="alert" className="text-amber-200">{error}</p>}
        {result && <p>{labels[result.status] ?? "Statut inconnu"}.</p>}
        {result?.expiresAt && <p>Échéance de test : {new Intl.DateTimeFormat("fr-FR", {
          dateStyle: "long", timeStyle: "short", timeZone: "UTC",
        }).format(new Date(result.expiresAt))} UTC.</p>}
      </div>
    </section>
  );
}
