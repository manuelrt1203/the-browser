"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PREMIUM_PLANS, premiumOffer, formatPremiumAmount, type PremiumPlan } from "@/lib/subscription";
import { TelegramAccount } from "./TelegramAccount";

export function PremiumCheckout({ stripe, saspay, termsVersion }: { stripe: boolean; saspay: boolean; termsVersion: string }) {
  const params = useSearchParams();
  const formRef = useRef<HTMLFormElement>(null);
  const [connected, setConnected] = useState(false), [provider, setProvider] = useState(stripe ? "stripe" : "saspay");
  const [attempt, setAttempt] = useState(""), [order, setOrder] = useState(params.get("order") ?? "");
  const [plan, setPlan] = useState<PremiumPlan>("monthly");
  const [orderPrice, setOrderPrice] = useState<{amountMinor: number; currency: string} | null>(null);
  const offer = premiumOffer(provider as "stripe" | "saspay", plan);
  const [needsRetry, setNeedsRetry] = useState(false);
  const [resumeUrl, setResumeUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [status, setStatus] = useState("");
  useEffect(() => {
    if (!connected || order || attempt) return;
    const controller = new AbortController();
    fetch("/api/premium/subscription", { cache: "no-store", signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(data => { const pending = data.orders?.find((o: { status: string }) => o.status === "pending"); if (!controller.signal.aborted && pending) { setOrder(pending.id); setProvider(pending.provider); setStatus("pending"); setPlan(pending.plan ?? "monthly"); setOrderPrice(pending); } })
      .catch(() => {});
    return () => controller.abort();
  }, [connected, order, attempt]);
  async function changePayment() {
    const id = order || attempt;
    if (!id) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/premium/payment/cancel", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId: id }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(response.status === 401 ? "Reconnectez votre compte Telegram." : data.error ?? "Annulation indisponible");
      formRef.current?.reset();
      setProvider(provider === "saspay" && stripe ? "stripe" : saspay ? "saspay" : "stripe");
      setOrder(""); setAttempt(""); setStatus(""); setResumeUrl(null); setNeedsRetry(false); setOrderPrice(null);
      window.history.replaceState(null, "", "/premium");
    } catch (e) { setError(e instanceof Error ? e.message : "Annulation indisponible"); }
    finally { setBusy(false); }
  }
  async function refresh() {
    setBusy(true); setError("");
    try { const r = await fetch(`/api/premium/payment/status?order=${encodeURIComponent(order)}`, { cache: "no-store" }); const data = await r.json().catch(() => ({})); if (!r.ok) throw new Error(r.status === 401 ? "Reconnectez votre compte Telegram." : data.error ?? "Vérification indisponible"); setStatus(data.status); setResumeUrl(data.checkoutUrl ?? null); setNeedsRetry(!!data.needsRetry); if (data.provider) setProvider(data.provider); if (data.plan) setPlan(data.plan); if (typeof data.amountMinor === "number") setOrderPrice(data); }
    catch (e) { setError(e instanceof Error ? e.message : "Vérification indisponible"); }
    finally { setBusy(false); }
  }
  async function pay(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const id = attempt || crypto.randomUUID(); setAttempt(id);
    try {
      const values = Object.fromEntries(new FormData(event.currentTarget));
      const r = await fetch("/api/premium/payment", { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": id }, body: JSON.stringify({ ...values, provider, plan, termsVersion }) });
      const data = await r.json().catch(() => ({})); if (!r.ok) throw new Error(r.status === 401 ? "Reconnectez votre compte Telegram." : data.error ?? "Paiement indisponible");
      setOrder(data.orderId); setStatus(data.status); setOrderPrice(data); window.history.replaceState(null, "", `/premium?order=${encodeURIComponent(data.orderId)}`);
      if (data.checkoutUrl) window.location.assign(data.checkoutUrl);
    } catch (e) { setError(e instanceof Error ? e.message : "Paiement indisponible"); }
    finally { setBusy(false); }
  }
  return <section className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6" aria-labelledby="achat-titre">
    <h2 id="achat-titre" className="text-2xl font-semibold">Mon abonnement Premium</h2>
    <TelegramAccount onChange={setConnected} />
    {order ? <div className="mt-6 space-y-4"><p className="font-semibold">{PREMIUM_PLANS[plan].label} · {PREMIUM_PLANS[plan].duration}{orderPrice && <> · {formatPremiumAmount(orderPrice.amountMinor, orderPrice.currency)}</>}</p><p>Votre commande est enregistrée. Un retour de la page de paiement ne suffit pas à confirmer le règlement.</p><button type="button" className="button-primary" disabled={!connected || busy} onClick={refresh}>{busy ? "Vérification…" : "Vérifier ma commande"}</button>{needsRetry && <><p>La demande doit être reprise avec les mêmes coordonnées. Votre référence de tentative sera conservée.</p><button type="button" className="button-secondary" onClick={() => { setAttempt(order); setOrder(""); setNeedsRetry(false); }}>Reprendre la demande</button></>}{resumeUrl && status === "pending" && <a className="button-primary block" href={resumeUrl}>Continuer le paiement →</a>}<Link className="button-secondary block" href="/mon-abonnement">Voir mon abonnement et accéder au canal →</Link></div> : <form ref={formRef} className="mt-6 grid gap-4" onSubmit={pay}>
      <fieldset disabled={busy || !!attempt} className="grid gap-3"><legend className="mb-3 font-semibold">Choisissez votre formule</legend><div className="grid gap-3 sm:grid-cols-3">{(Object.keys(PREMIUM_PLANS) as PremiumPlan[]).map(key => <label key={key} className={`min-w-0 cursor-pointer rounded-xl border p-4 ${plan === key ? "border-amber-200/70 bg-amber-200/10" : "border-white/10 bg-white/[0.02]"}`}><span className="flex items-center gap-2"><input type="radio" name="plan" value={key} checked={plan === key} onChange={() => setPlan(key)} className="accent-amber-200" /><span className="font-semibold">{PREMIUM_PLANS[key].label}</span></span><span className="mt-2 block text-sm text-white/60">{PREMIUM_PLANS[key].duration}</span><span className="mt-3 block font-semibold text-amber-100">{premiumOffer("saspay", key).label}</span><span className="mt-1 block text-sm text-white/65">ou {premiumOffer("stripe", key).label}</span>{premiumOffer(provider as "stripe" | "saspay", key).savingMinor > 0 && <span className="mt-3 block text-xs text-emerald-200">{premiumOffer(provider as "stripe" | "saspay", key).savingLabel} économisés</span>}</label>)}</div></fieldset>
      <label className="grid gap-2">Moyen de paiement<select value={provider} disabled={!!attempt} onChange={e => setProvider(e.target.value)} className="genre-select">{stripe && <option value="stripe">Carte bancaire · {premiumOffer("stripe", plan).label}</option>}{saspay && <option value="saspay">SasPay · Mobile Money et autres pays</option>}</select></label>
      {provider === "saspay" && <><p className="text-sm text-zinc-300">Prix de référence : {premiumOffer("saspay", plan).label} (XAF) pour {PREMIUM_PLANS[plan].duration}. Choisissez votre pays et votre moyen de paiement sur la page sécurisée SasPay. Les options disponibles et le montant dans la devise proposée y sont présentés avant validation.</p><label className="grid gap-2">Nom complet<input name="name" required autoComplete="name" maxLength={160} className="genre-select" /></label><label className="grid gap-2">E-mail<input name="email" required type="email" autoComplete="email" maxLength={254} className="genre-select" /></label></>}
      <p>{PREMIUM_PLANS[plan].duration} d’accès, renouvellement manuel. Aucun prélèvement automatique. Le règlement doit être confirmé avant l’accès au canal.</p>
      <label className="flex items-start gap-3"><input name="acceptedTerms" type="checkbox" required className="mt-1" /> <span>J’ai lu et j’accepte les <Link href="/conditions" className="underline">conditions de vente</Link> et les informations sur les <Link href="/remboursements" className="underline">remboursements</Link>.</span></label>
      <button disabled={busy || !connected || (!stripe && !saspay)} className="button-primary">{busy ? "Demande en cours…" : provider === "stripe" ? `Commander et payer ${offer.label}` : "Continuer vers SasPay →"}</button>
    </form>}
    {(order || attempt) && !["confirmed", "cancelled", "failed"].includes(status) && <button type="button" disabled={!connected || busy} className="button-secondary mt-4" onClick={changePayment}>{busy ? "Vérification…" : "Changer de formule ou de paiement"}</button>}
    {["failed", "cancelled"].includes(status) && <button type="button" className="button-secondary mt-4" onClick={() => { setOrder(""); setAttempt(""); setStatus(""); setResumeUrl(null); window.history.replaceState(null, "", "/premium"); }}>Lancer une nouvelle tentative</button>}
    <p role="status" className="mt-4">{({ pending: "Paiement en attente", confirmed: "Paiement confirmé : retrouvez votre accès dans Mon abonnement.", failed: "Paiement refusé", cancelled: "Paiement annulé" } as Record<string, string>)[status] ?? ""}</p>
    {error && <p role="alert" className="mt-4 text-amber-200">{error}</p>}
  </section>;
}
