"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { TelegramAccount } from "./TelegramAccount";

export function PremiumCheckout({ stripe, saspay, termsVersion }: { stripe: boolean; saspay: boolean; termsVersion: string }) {
  const params = useSearchParams();
  const [connected, setConnected] = useState(false), [provider, setProvider] = useState(stripe ? "stripe" : "saspay");
  const [attempt, setAttempt] = useState(""), [order, setOrder] = useState(params.get("order") ?? "");
  const [resumeUrl, setResumeUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [status, setStatus] = useState("");
  const [networks, setNetworks] = useState<{ code: string; name: string }[]>([]);
  useEffect(() => {
    if (!connected || !saspay) return;
    const controller = new AbortController();
    fetch("/api/premium/payment/networks", { signal: controller.signal, cache: "no-store" })
      .then(r => { if (!r.ok) throw new Error(); return r.json(); }).then(data => setNetworks(data.networks))
      .catch(() => { if (!controller.signal.aborted) setError("Réseaux Mobile Money momentanément indisponibles."); });
    return () => controller.abort();
  }, [connected, saspay]);
  async function refresh() {
    setBusy(true); setError("");
    try { const r = await fetch(`/api/premium/payment/status?order=${encodeURIComponent(order)}`, { cache: "no-store" }); const data = await r.json().catch(() => ({})); if (!r.ok) throw new Error(r.status === 401 ? "Reconnectez votre compte Telegram." : data.error ?? "Vérification indisponible"); setStatus(data.status); setResumeUrl(data.checkoutUrl ?? null); }
    catch (e) { setError(e instanceof Error ? e.message : "Vérification indisponible"); }
    finally { setBusy(false); }
  }
  async function pay(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const id = attempt || crypto.randomUUID(); setAttempt(id);
    try {
      const values = Object.fromEntries(new FormData(event.currentTarget));
      const r = await fetch("/api/premium/payment", { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": id }, body: JSON.stringify({ ...values, provider, termsVersion }) });
      const data = await r.json().catch(() => ({})); if (!r.ok) throw new Error(r.status === 401 ? "Reconnectez votre compte Telegram." : data.error ?? "Paiement indisponible");
      setOrder(data.orderId); setStatus(data.status); window.history.replaceState(null, "", `/premium?order=${encodeURIComponent(data.orderId)}`);
      if (data.checkoutUrl) window.location.assign(data.checkoutUrl);
    } catch (e) { setError(e instanceof Error ? e.message : "Paiement indisponible"); }
    finally { setBusy(false); }
  }
  return <section className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6" aria-labelledby="achat-titre">
    <h2 id="achat-titre" className="text-2xl font-semibold">Mon mois Premium</h2>
    <TelegramAccount onChange={setConnected} />
    {order ? <div className="mt-6 space-y-4"><p>Votre commande est enregistrée. Un retour de la page de paiement ne suffit pas à confirmer le règlement.</p><button type="button" className="button-primary" disabled={!connected || busy} onClick={refresh}>{busy ? "Vérification…" : "Vérifier ma commande"}</button>{resumeUrl && status === "pending" && <a className="button-primary block" href={resumeUrl}>Continuer le paiement →</a>}<Link className="button-secondary block" href="/mon-abonnement">Voir mon abonnement et accéder au canal →</Link></div> : <form className="mt-6 grid gap-4" onSubmit={pay}>
      <label className="grid gap-2">Moyen de paiement<select value={provider} disabled={!!attempt} onChange={e => setProvider(e.target.value)} className="genre-select">{stripe && <option value="stripe">Carte bancaire · 4,57 €</option>}{saspay && <option value="saspay">Mobile Money Congo · 3 000 FCFA</option>}</select></label>
      {provider === "saspay" && <><label className="grid gap-2">Prénom<input name="firstName" required autoComplete="given-name" maxLength={80} className="genre-select" /></label><label className="grid gap-2">Nom<input name="lastName" required autoComplete="family-name" maxLength={80} className="genre-select" /></label><label className="grid gap-2">E-mail<input name="email" required type="email" autoComplete="email" maxLength={254} className="genre-select" /></label><label className="grid gap-2">Téléphone Mobile Money<input name="phone" required type="tel" autoComplete="tel" placeholder="+242…" className="genre-select" /></label><label className="grid gap-2">Réseau<select name="network" required className="genre-select" defaultValue=""><option value="" disabled>Choisir le réseau</option>{networks.map(n => <option key={n.code} value={n.code}>{n.name}</option>)}</select></label></>}
      <p>Un mois, renouvellement manuel. Aucun prélèvement automatique. Le règlement doit être confirmé avant l’accès au canal.</p>
      <label className="flex items-start gap-3"><input name="acceptedTerms" type="checkbox" required className="mt-1" /> <span>J’ai lu et j’accepte les <Link href="/conditions" className="underline">conditions de vente</Link> et les informations sur les <Link href="/remboursements" className="underline">remboursements</Link>.</span></label>
      <button disabled={busy || !connected || (!stripe && !saspay) || (provider === "saspay" && networks.length === 0)} className="button-primary">{busy ? "Demande en cours…" : `Commander et payer ${provider === "stripe" ? "4,57 €" : "3 000 FCFA"}`}</button>
    </form>}
    {["failed", "cancelled"].includes(status) && <button type="button" className="button-secondary mt-4" onClick={() => { setOrder(""); setAttempt(""); setStatus(""); setResumeUrl(null); window.history.replaceState(null, "", "/premium"); }}>Lancer une nouvelle tentative</button>}
    <p role="status" className="mt-4">{({ pending: "Paiement en attente", confirmed: "Paiement confirmé : retrouvez votre accès dans Mon abonnement.", failed: "Paiement refusé", cancelled: "Paiement annulé" } as Record<string, string>)[status] ?? ""}</p>
    {error && <p role="alert" className="mt-4 text-amber-200">{error}</p>}
  </section>;
}
