"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PREMIUM_PLANS, formatPremiumAmount, type PremiumPlan } from "@/lib/subscription";
import { PRICING_COUNTRIES, pricingCountry, regionalOffer } from "@/lib/regional-pricing";
import { TelegramAccount } from "./TelegramAccount";

export function PremiumCheckout({ stripe, saspay, termsVersion }: { stripe: boolean; saspay: boolean; termsVersion: string }) {
  const params = useSearchParams();
  const formRef = useRef<HTMLFormElement>(null);
  const [connected, setConnected] = useState(false), [provider, setProvider] = useState(stripe ? "stripe" : "saspay");
  const [attempt, setAttempt] = useState(""), [order, setOrder] = useState(params.get("order") ?? "");
  const [plan, setPlan] = useState<PremiumPlan>("monthly");
  const [orderPrice, setOrderPrice] = useState<{amountMinor: number; currency: string} | null>(null);
  const [countryCode, setCountryCode] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [options, setOptions] = useState<Record<string, Record<PremiumPlan, {stripe: boolean; saspay: boolean}>> | null>(null);
  const [optionsError, setOptionsError] = useState(false), [optionsReload, setOptionsReload] = useState(0);
  const country = pricingCountry(countryCode);
  const regional = country ? regionalOffer(countryCode, plan) : null;
  const methods = options?.[countryCode]?.[plan];
  const stripeAvailable = stripe && methods?.stripe === true, saspayAvailable = saspay && methods?.saspay === true;
  const selectedProvider = attempt || order ? provider : provider === "stripe" && stripeAvailable ? "stripe" : provider === "saspay" && saspayAvailable ? "saspay" : stripeAvailable ? "stripe" : saspayAvailable ? "saspay" : "";
  const priceLabel = attempt && orderPrice ? formatPremiumAmount(orderPrice.amountMinor, orderPrice.currency) : regional?.label;
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/premium/payment/options", {cache: "no-store", signal: controller.signal})
      .then(r => {if (!r.ok) throw new Error(); return r.json();})
      .then(data => {if (!controller.signal.aborted) {setOptions(data.countries); setOptionsError(false); setAccepted(false); if (pricingCountry(data.suggestedCountry)) setCountryCode(current => current || data.suggestedCountry);}})
      .catch(() => {if (!controller.signal.aborted) setOptionsError(true);});
    return () => controller.abort();
  }, [optionsReload]);
  const [needsRetry, setNeedsRetry] = useState(false);
  const [resumeUrl, setResumeUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [status, setStatus] = useState("");
  const identityEpoch = useRef(0), wasConnected = useRef(false);
  const changeConnection = useCallback((value: boolean) => {
    if (wasConnected.current === value) return;
    wasConnected.current = value; identityEpoch.current++; setConnected(value);
    if (!value) {
      formRef.current?.reset(); setAccepted(false); setBusy(false); setError("");
      setOrder(""); setAttempt(""); setOrderPrice(null); setStatus(""); setResumeUrl(null); setNeedsRetry(false);
      window.history.replaceState(null, "", "/premium");
    }
  }, []);
  useEffect(() => () => { identityEpoch.current++; }, []);

  useEffect(() => {
    if (!connected || order || attempt) return;
    const controller = new AbortController(), epoch = identityEpoch.current;
    fetch("/api/premium/subscription", { cache: "no-store", signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(data => { const pending = data.orders?.find((o: { status: string }) => o.status === "pending"); if (epoch === identityEpoch.current && !controller.signal.aborted && pending) { setOrder(pending.id); setProvider(pending.provider); setStatus("pending"); setPlan(pending.plan ?? "monthly"); setOrderPrice(pending); if (pending.countryCode) setCountryCode(pending.countryCode); } })
      .catch(() => {});
    return () => controller.abort();
  }, [connected, order, attempt]);
  async function changePayment() {
    const epoch = identityEpoch.current;
    const id = order || attempt;
    if (!id) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/premium/payment/cancel", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId: id }) });
      const data = await response.json().catch(() => ({}));
      if (epoch !== identityEpoch.current) return;
      if (!response.ok) throw new Error(response.status === 401 ? "Reconnectez votre compte Telegram." : data.error ?? "Annulation indisponible");
      formRef.current?.reset();
      setProvider(provider === "saspay" && stripe ? "stripe" : saspay ? "saspay" : "stripe");
      setOrder(""); setAttempt(""); setStatus(""); setResumeUrl(null); setNeedsRetry(false); setOrderPrice(null); setAccepted(false);
      window.history.replaceState(null, "", "/premium");
    } catch (e) { if (epoch === identityEpoch.current) setError(e instanceof Error ? e.message : "Annulation indisponible"); }
    finally { if (epoch === identityEpoch.current) setBusy(false); }
  }
  async function refresh() {
    const epoch = identityEpoch.current;
    setBusy(true); setError("");
    try { const r = await fetch(`/api/premium/payment/status?order=${encodeURIComponent(order)}`, { cache: "no-store" }); const data = await r.json().catch(() => ({})); if (epoch !== identityEpoch.current) return; if (!r.ok) throw new Error(r.status === 401 ? "Reconnectez votre compte Telegram." : data.error ?? "Vérification indisponible"); setStatus(data.status); setResumeUrl(data.checkoutUrl ?? null); setNeedsRetry(!!data.needsRetry); if (data.provider) setProvider(data.provider); if (data.plan) setPlan(data.plan); if (typeof data.amountMinor === "number") setOrderPrice(data); if (data.countryCode) setCountryCode(data.countryCode); }
    catch (e) { if (epoch === identityEpoch.current) setError(e instanceof Error ? e.message : "Vérification indisponible"); }
    finally { if (epoch === identityEpoch.current) setBusy(false); }
  }
  async function pay(event: React.FormEvent<HTMLFormElement>) {
    const epoch = identityEpoch.current;
    event.preventDefault(); setBusy(true); setError("");
    const id = attempt || crypto.randomUUID(); setProvider(selectedProvider); setAttempt(id);
    try {
      const values = Object.fromEntries(new FormData(event.currentTarget));
      const r = await fetch("/api/premium/payment", { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": id }, body: JSON.stringify({ ...values, provider: selectedProvider, plan, countryCode, termsVersion }) });
      const data = await r.json().catch(() => ({})); if (epoch !== identityEpoch.current) return; if (!r.ok) { if (data.attemptCreated === false) setAttempt(""); throw new Error(r.status === 401 ? "Reconnectez votre compte Telegram." : data.error ?? "Paiement indisponible"); }
      setProvider(selectedProvider); setOrder(data.orderId); setStatus(data.status); setOrderPrice(data); window.history.replaceState(null, "", `/premium?order=${encodeURIComponent(data.orderId)}`);
      if (data.checkoutUrl) window.location.assign(data.checkoutUrl);
    } catch (e) { if (epoch === identityEpoch.current) setError(e instanceof Error ? e.message : "Paiement indisponible"); }
    finally { if (epoch === identityEpoch.current) setBusy(false); }
  }
  return <section className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6" aria-labelledby="achat-titre">
    <h2 id="achat-titre" className="text-2xl font-semibold">Mon abonnement Premium</h2>
    <TelegramAccount onChange={changeConnection} />
    {order ? <div className="mt-6 space-y-4"><p className="font-semibold">{PREMIUM_PLANS[plan].label} · {PREMIUM_PLANS[plan].duration}{orderPrice && <> · {formatPremiumAmount(orderPrice.amountMinor, orderPrice.currency)}</>}</p><p>Votre commande est enregistrée. Un retour de la page de paiement ne suffit pas à confirmer le règlement.</p><button type="button" className="button-primary" disabled={!connected || busy} onClick={refresh}>{busy ? "Vérification…" : "Vérifier ma commande"}</button>{needsRetry && <><p>La demande doit être reprise avec les mêmes coordonnées. Votre référence de tentative sera conservée.</p><button type="button" className="button-secondary" onClick={() => { setAttempt(order); setOrder(""); setNeedsRetry(false); }}>Reprendre la demande</button></>}{resumeUrl && status === "pending" && <a className="button-primary block" href={resumeUrl}>Continuer le paiement →</a>}<Link className="button-secondary block" href="/mon-abonnement">Voir mon abonnement et accéder au canal →</Link></div> : <form ref={formRef} className="mt-6 grid gap-4" onSubmit={pay}>
      {!(attempt && orderPrice) && <>
      <label className="grid gap-2">Pays de facturation
        <select name="countryCode" autoComplete="country" value={countryCode} required disabled={busy || !!attempt} onChange={e => {setCountryCode(e.target.value); setAccepted(false);}} className="genre-select w-full min-w-0">
          <option value="">Choisissez votre pays</option>
          {[...new Set(PRICING_COUNTRIES.map(c => c.zone))].map(zone => <optgroup key={zone} label={zone}>{PRICING_COUNTRIES.filter(c => c.zone === zone).map(c => <option key={c.code} value={c.code}>{c.name}</option>)}</optgroup>)}
        </select>
      </label>
      <p className="text-sm text-white/60">Confirmez votre pays de facturation. Il détermine le tarif et la devise, quel que soit le moyen de paiement.</p>
      {countryCode === "CH" && <p className="text-sm text-amber-100">En Suisse, les prix sont en euros. Votre banque peut appliquer une conversion depuis le franc suisse.</p>}
      <fieldset disabled={busy || !!attempt || !country} className="grid gap-3"><legend className="mb-3 font-semibold">Choisissez votre formule</legend><div className="grid gap-3 sm:grid-cols-3">{(Object.keys(PREMIUM_PLANS) as PremiumPlan[]).map(key => {
        const price = country ? regionalOffer(countryCode, key) : null;
        return <label key={key} className={`min-w-0 cursor-pointer rounded-xl border p-4 ${plan === key ? "border-amber-200/70 bg-amber-200/10" : "border-white/10 bg-white/[0.02]"}`}><span className="flex items-center gap-2"><input type="radio" name="plan" value={key} checked={plan === key} onChange={() => {setPlan(key); setAccepted(false);}} className="accent-amber-200" /><span className="font-semibold">{PREMIUM_PLANS[key].label}</span></span><span className="mt-2 block text-sm text-white/60">{PREMIUM_PLANS[key].duration}</span><span className="mt-3 block font-semibold text-amber-100">{price?.label ?? "Choisissez un pays"}</span>{price && price.savingMinor > 0 && <span className="mt-3 block text-xs text-emerald-200">{price.savingLabel} économisés</span>}</label>;
      })}</div></fieldset>
      <p className="text-sm text-white/60">Votre pays ne figure pas dans la liste ? <Link href="/support" className="underline">Contactez le support</Link>.</p>
      </>}
      {attempt && orderPrice && <p className="text-amber-100">Prix enregistré de cette tentative : {formatPremiumAmount(orderPrice.amountMinor, orderPrice.currency)}. Il reste inchangé.</p>}
      {!options && !optionsError && <p role="status">Vérification des moyens de paiement…</p>}
      {optionsError && <p role="alert">Les moyens de paiement sont momentanément indisponibles. <button type="button" className="underline" onClick={() => setOptionsReload(n => n + 1)}>Réessayer</button></p>}
      {country && options && !stripeAvailable && !saspayAvailable && !attempt && <p role="status" className="text-amber-100">Aucun moyen de paiement n’est actuellement disponible pour ce pays et cette formule. <Link href="/support" className="underline">Contacter le support</Link></p>}
      <label className="grid gap-2">Moyen de paiement<select value={selectedProvider} disabled={busy || !!attempt || !selectedProvider} onChange={e => {setProvider(e.target.value); setAccepted(false);}} className="genre-select">
        {!selectedProvider && <option value="">{country ? "Aucun moyen disponible" : "Choisissez d’abord votre pays"}</option>}
        {(stripeAvailable || (!!attempt && provider === "stripe")) && <option value="stripe">Carte bancaire · Stripe</option>}
        {(saspayAvailable || (!!attempt && provider === "saspay")) && <option value="saspay">SasPay · Mobile Money</option>}
      </select></label>
      {selectedProvider === "saspay" && <><p className="text-sm text-zinc-300">Prix de référence : {priceLabel} pour {PREMIUM_PLANS[plan].duration}. {country && !attempt ? "Votre pays est présélectionné sur SasPay." : "Le tarif enregistré de cette tentative est conservé."} Les réseaux disponibles, une éventuelle conversion et les frais sont présentés sur sa page sécurisée avant validation.</p><label className="grid gap-2">Nom complet<input name="name" required autoComplete="name" maxLength={160} className="genre-select" /></label><label className="grid gap-2">E-mail<input name="email" required type="email" autoComplete="email" maxLength={254} className="genre-select" /></label></>}
      {priceLabel && <p className="font-semibold">Total à payer : {priceLabel} · {PREMIUM_PLANS[plan].duration}</p>}
      <p>{PREMIUM_PLANS[plan].duration} d’accès, renouvellement manuel. Aucun prélèvement automatique. Le règlement doit être confirmé avant l’accès au canal.</p>
      <label className="flex items-start gap-3"><input name="acceptedTerms" type="checkbox" required checked={accepted} onChange={e => setAccepted(e.target.checked)} className="mt-1" /> <span>Je confirme mon pays de facturation et j’accepte les <Link href="/conditions" className="underline">conditions de vente</Link> et les informations sur les <Link href="/remboursements" className="underline">remboursements</Link>.</span></label>
      <button disabled={busy || !connected || (!country && !(attempt && orderPrice)) || !selectedProvider || (!attempt && !stripeAvailable && !saspayAvailable)} className="button-primary">{busy ? "Demande en cours…" : selectedProvider === "stripe" ? `Commander et payer ${priceLabel ?? ""}` : "Continuer vers SasPay →"}</button>
    </form>}
    {(order || attempt) && !["confirmed", "cancelled", "failed"].includes(status) && <button type="button" disabled={!connected || busy} className="button-secondary mt-4" onClick={changePayment}>{busy ? "Vérification…" : "Changer de pays, de formule ou de paiement"}</button>}
    {["failed", "cancelled"].includes(status) && <button type="button" className="button-secondary mt-4" onClick={() => { setOrder(""); setAttempt(""); setStatus(""); setResumeUrl(null); setOrderPrice(null); setAccepted(false); window.history.replaceState(null, "", "/premium"); }}>Lancer une nouvelle tentative</button>}
    <p role="status" className="mt-4">{({ pending: "Paiement en attente", confirmed: "Paiement confirmé : retrouvez votre accès dans Mon abonnement.", failed: "Paiement refusé", cancelled: "Paiement annulé" } as Record<string, string>)[status] ?? ""}</p>
    {error && <p role="alert" className="mt-4 text-amber-200">{error}</p>}
  </section>;
}
