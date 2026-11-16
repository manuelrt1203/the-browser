"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { TelegramAccount } from "./TelegramAccount";

export function SasPayTestCheckout() {
  const savedOrder = useSearchParams().get("order") ?? "";
  const [createdOrder, setCreatedOrder] = useState("");
  const orderId = createdOrder || savedOrder;
  const [connected, setConnected] = useState(false);
  const [networks, setNetworks] = useState<{ code: string; name: string }[]>([]);
  const [attempt, setAttempt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [result, setResult] = useState<{ status: string; expiresAt?: string | null } | null>(null);
  useEffect(() => {
    if (!connected) return;
    const controller = new AbortController();
    fetch("/api/saspay/test/networks", { cache: "no-store", signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(data => { setNetworks(data.networks); setError(""); })
      .catch(() => { if (!controller.signal.aborted) setError("Les réseaux SasPay de test ne sont pas disponibles actuellement."); });
    return () => controller.abort();
  }, [connected]);

  async function initiate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const id = attempt || crypto.randomUUID(); setAttempt(id);
    const body = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const response = await fetch("/api/saspay/test/payment", { method: "POST", headers: {
        "Content-Type": "application/json", "Idempotency-Key": id,
      }, body: JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Paiement indisponible");
      setCreatedOrder(data.orderId); setResult({ status: data.status }); setCheckoutUrl(data.checkoutUrl);
      window.history.replaceState(null, "", `?order=${encodeURIComponent(data.orderId)}`);
    } catch (e) { setError(e instanceof Error ? e.message : "Paiement indisponible"); }
    finally { setBusy(false); }
  }
  async function refresh() {
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/saspay/test/status?order=${encodeURIComponent(orderId)}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Vérification indisponible");
      setResult(data);
    } catch (e) { setError(e instanceof Error ? e.message : "Vérification indisponible"); }
    finally { setBusy(false); }
  }
  const labels: Record<string, string> = { pending: "En attente de confirmation", confirmed: "Paiement de test confirmé", failed: "Paiement refusé", cancelled: "Paiement annulé" };
  return <section className="mt-8 rounded-2xl border border-violet-400/30 bg-violet-950/30 p-6">
    <h1 className="text-3xl font-bold">Essayer SasPay — 3 000 FCFA</h1>
    <p className="mt-4 text-white/70">MTN et Airtel au Congo-Brazzaville. Tests uniquement, sans argent réel ni accès au canal Premium. Vos coordonnées sont transmises à SasPay pour le paiement.</p>
    <TelegramAccount onChange={setConnected} />
    {!orderId ? <form onSubmit={initiate} className="mt-6 grid gap-4 sm:grid-cols-2">
      <label className="grid gap-2">Prénom<input required name="firstName" autoComplete="given-name" maxLength={80} className="rounded-lg bg-slate-900 p-3" /></label>
      <label className="grid gap-2">Nom<input required name="lastName" autoComplete="family-name" maxLength={80} className="rounded-lg bg-slate-900 p-3" /></label>
      <label className="grid gap-2">Email<input required name="email" type="email" autoComplete="email" maxLength={254} className="rounded-lg bg-slate-900 p-3" /></label>
      <label className="grid gap-2">Numéro Mobile Money<input required name="phone" type="tel" autoComplete="tel" placeholder="+242…" className="rounded-lg bg-slate-900 p-3" /></label>
      <label className="grid gap-2 sm:col-span-2">Réseau<select required name="network" className="rounded-lg bg-slate-900 p-3" defaultValue="">
        <option value="" disabled>Choisissez votre réseau</option>
        {networks.map(n => <option key={n.code} value={n.code}>{n.name}</option>)}
      </select></label>
      <button disabled={busy || !connected || networks.length === 0} className="rounded-lg bg-sky-300 px-5 py-3 font-semibold text-slate-950 disabled:opacity-50 sm:col-span-2">{busy ? "Demande en cours…" : "Demander le paiement de test"}</button>
    </form> : <div className="mt-6 space-y-4">
      <p>Confirmez la demande dans votre application Mobile Money de test, puis vérifiez le résultat ici.</p>
      {checkoutUrl && <a href={checkoutUrl} target="_blank" rel="noopener noreferrer" className="block text-sky-300 underline">Continuer sur la page de paiement SasPay</a>}
      <button onClick={refresh} disabled={busy || !connected} className="rounded-lg border border-sky-300/50 px-5 py-3 disabled:opacity-50">{busy ? "Vérification…" : "Vérifier le paiement"}</button>
    </div>}
    <div aria-live="polite" className="mt-5 space-y-2">
      {error && <p role="alert" className="text-amber-200">{error}</p>}
      {result && <p>{labels[result.status] ?? "Statut inconnu"}.</p>}
      {result?.expiresAt && <p>Échéance de test : {new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short", timeZone: "UTC" }).format(new Date(result.expiresAt))} UTC.</p>}
    </div>
  </section>;
}
