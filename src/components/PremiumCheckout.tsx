"use client";
import Link from "next/link";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { TelegramAccount } from "./TelegramAccount";

export function PremiumCheckout({ stripe, saspay, termsVersion }: { stripe: boolean; saspay: boolean; termsVersion: string }) {
  const params = useSearchParams();
  const [connected, setConnected] = useState(false), [provider, setProvider] = useState(stripe ? "stripe" : "saspay");
  const [attempt, setAttempt] = useState(""), [order, setOrder] = useState(params.get("order") ?? "");
  const [needsRetry, setNeedsRetry] = useState(false);
  const [resumeUrl, setResumeUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [status, setStatus] = useState("");
  async function refresh() {
    setBusy(true); setError("");
    try { const r = await fetch(`/api/premium/payment/status?order=${encodeURIComponent(order)}`, { cache: "no-store" }); const data = await r.json().catch(() => ({})); if (!r.ok) throw new Error(r.status === 401 ? "Reconnectez votre compte Telegram." : data.error ?? "Vérification indisponible"); setStatus(data.status); setResumeUrl(data.checkoutUrl ?? null); setNeedsRetry(!!data.needsRetry); if (data.provider) setProvider(data.provider); }
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
    {order ? <div className="mt-6 space-y-4"><p>Votre commande est enregistrée. Un retour de la page de paiement ne suffit pas à confirmer le règlement.</p><button type="button" className="button-primary" disabled={!connected || busy} onClick={refresh}>{busy ? "Vérification…" : "Vérifier ma commande"}</button>{needsRetry && <><p>La demande doit être reprise avec les mêmes coordonnées. Votre référence de tentative sera conservée.</p><button type="button" className="button-secondary" onClick={() => { setAttempt(order); setOrder(""); setNeedsRetry(false); }}>Reprendre la demande</button></>}{resumeUrl && status === "pending" && <a className="button-primary block" href={resumeUrl}>Continuer le paiement →</a>}<Link className="button-secondary block" href="/mon-abonnement">Voir mon abonnement et accéder au canal →</Link></div> : <form className="mt-6 grid gap-4" onSubmit={pay}>
      <label className="grid gap-2">Moyen de paiement<select value={provider} disabled={!!attempt} onChange={e => setProvider(e.target.value)} className="genre-select">{stripe && <option value="stripe">Carte bancaire · 4,57 €</option>}{saspay && <option value="saspay">SasPay · Mobile Money et autres pays</option>}</select></label>
      {provider === "saspay" && <><p className="text-sm text-zinc-300">Prix de référence : 3 000 FCFA (XAF). Choisissez votre pays et votre moyen de paiement sur la page sécurisée SasPay. Les options disponibles et le montant dans la devise proposée y sont présentés avant validation.</p><label className="grid gap-2">Nom complet<input name="name" required autoComplete="name" maxLength={160} className="genre-select" /></label><label className="grid gap-2">E-mail<input name="email" required type="email" autoComplete="email" maxLength={254} className="genre-select" /></label></>}
      <p>Un mois, renouvellement manuel. Aucun prélèvement automatique. Le règlement doit être confirmé avant l’accès au canal.</p>
      <label className="flex items-start gap-3"><input name="acceptedTerms" type="checkbox" required className="mt-1" /> <span>J’ai lu et j’accepte les <Link href="/conditions" className="underline">conditions de vente</Link> et les informations sur les <Link href="/remboursements" className="underline">remboursements</Link>.</span></label>
      <button disabled={busy || !connected || (!stripe && !saspay)} className="button-primary">{busy ? "Demande en cours…" : provider === "stripe" ? "Commander et payer 4,57 €" : "Continuer vers SasPay →"}</button>
    </form>}
    {["failed", "cancelled"].includes(status) && <button type="button" className="button-secondary mt-4" onClick={() => { setOrder(""); setAttempt(""); setStatus(""); setResumeUrl(null); window.history.replaceState(null, "", "/premium"); }}>Lancer une nouvelle tentative</button>}
    <p role="status" className="mt-4">{({ pending: "Paiement en attente", confirmed: "Paiement confirmé : retrouvez votre accès dans Mon abonnement.", failed: "Paiement refusé", cancelled: "Paiement annulé" } as Record<string, string>)[status] ?? ""}</p>
    {error && <p role="alert" className="mt-4 text-amber-200">{error}</p>}
  </section>;
}
