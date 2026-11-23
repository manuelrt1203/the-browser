"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PREMIUM_PLANS, formatPremiumAmount, type PremiumPlan } from "@/lib/subscription";
import { PRICING_COUNTRIES, pricingCountry, regionalOffer } from "@/lib/regional-pricing";
import {clientRequest, ClientRequestError} from "@/lib/client-request";
import {useRequestCooldown} from "@/lib/use-request-cooldown";
import type {RegionalAvailability} from "@/lib/regional-payments";
import type {SubscriptionAccount} from "@/lib/subscription-account";
import { TelegramAccount } from "./TelegramAccount";

type PaymentState = {orderId: string; status: string; provider?: "stripe" | "saspay"; plan?: PremiumPlan; amountMinor: number; currency: string; countryCode?: string | null; checkoutUrl?: string | null; needsRetry?: boolean};
export function PremiumCheckout({ stripe, saspay, termsVersion }: { stripe: boolean; saspay: boolean; termsVersion: string }) {
  const params = useSearchParams();
  const {clear: clearCooldown, ...cooldown} = useRequestCooldown();
  const [sessionRevision, setSessionRevision] = useState("");
  const previousRevision = useRef("");
  const formRef = useRef<HTMLFormElement>(null);
  const [connected, setConnected] = useState(false), [provider, setProvider] = useState(stripe ? "stripe" : "saspay");
  const [attempt, setAttempt] = useState(""), [order, setOrder] = useState(params.get("order") ?? "");
  const [plan, setPlan] = useState<PremiumPlan>("monthly");
  const [orderPrice, setOrderPrice] = useState<{amountMinor: number; currency: string} | null>(null);
  const [countryCode, setCountryCode] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [options, setOptions] = useState<Record<string, Record<PremiumPlan, {stripe: boolean; saspay: boolean}>> | null>(null);
  const [providerHealth, setProviderHealth] = useState<RegionalAvailability["providers"] | null>(null);
  const checkingFailed = providerHealth && Object.values(providerHealth).includes("unavailable");
  const [optionsError, setOptionsError] = useState(false), [optionsReload, setOptionsReload] = useState(0);
  const country = pricingCountry(countryCode);
  const regional = country ? regionalOffer(countryCode, plan) : null;
  const methods = options?.[countryCode]?.[plan];
  const stripeAvailable = stripe && methods?.stripe === true, saspayAvailable = saspay && methods?.saspay === true;
  const selectedProvider = attempt || order ? provider : provider === "stripe" && stripeAvailable ? "stripe" : provider === "saspay" && saspayAvailable ? "saspay" : stripeAvailable ? "stripe" : saspayAvailable ? "saspay" : "";
  const priceLabel = attempt && orderPrice ? formatPremiumAmount(orderPrice.amountMinor, orderPrice.currency) : regional?.label;
  useEffect(() => {
    const controller = new AbortController();
    clientRequest<RegionalAvailability & {suggestedCountry: string | null}>("/api/premium/payment/options", {cache: "no-store", signal: controller.signal}, 30_000)
      .then(data => {if (!controller.signal.aborted) {setOptions(data.countries); setProviderHealth(data.providers ?? null); setOptionsError(false); setAccepted(false); if (pricingCountry(data.suggestedCountry)) setCountryCode(current => current || data.suggestedCountry || "");}})
      .catch(() => {if (!controller.signal.aborted) setOptionsError(true);});
    return () => controller.abort();
  }, [optionsReload]);
  const [needsRetry, setNeedsRetry] = useState(false);
  const [resumeUrl, setResumeUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [status, setStatus] = useState("");
  const identityEpoch = useRef(0), wasConnected = useRef(false), operating = useRef(false);
  const changeConnection = useCallback((value: boolean, revision = "") => {
    if (wasConnected.current === value && previousRevision.current === revision) return;
    const changedAccount = wasConnected.current && previousRevision.current !== revision;
    previousRevision.current = revision; setSessionRevision(revision);
    wasConnected.current = value; identityEpoch.current++; setConnected(value);
    if (!value || changedAccount) {
      formRef.current?.reset(); operating.current = false; clearCooldown(); setAccepted(false); setBusy(false); setError("");
      setOrder(""); setAttempt(""); setOrderPrice(null); setStatus(""); setResumeUrl(null); setNeedsRetry(false);
      window.history.replaceState(null, "", "/premium");
    }
  }, [clearCooldown]);
  useEffect(() => () => { identityEpoch.current++; }, []);

  useEffect(() => {
    if (!connected || order || attempt) return;
    const controller = new AbortController(), epoch = identityEpoch.current;
    clientRequest<SubscriptionAccount>("/api/premium/subscription", {cache: "no-store", signal: controller.signal})
      .then(data => { const pending = data.orders?.find((o: { status: string }) => o.status === "pending"); if (epoch === identityEpoch.current && !controller.signal.aborted && pending) { setOrder(pending.id); setProvider(pending.provider); setStatus("pending"); setPlan(pending.plan ?? "monthly"); setOrderPrice(pending); if (pending.countryCode) setCountryCode(pending.countryCode); } })
      .catch(() => {});
    return () => controller.abort();
  }, [connected, order, attempt, sessionRevision]);
  async function changePayment() {
    const epoch = identityEpoch.current;
    if (cooldown.blocked() || operating.current) return;
    const id = order || attempt;
    if (!id) return;
    operating.current = true; setBusy(true); setError("");
    try {
      await clientRequest("/api/premium/payment/cancel", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({orderId: id})}, 90_000);
      if (epoch !== identityEpoch.current) return;
      formRef.current?.reset();
      setProvider(provider === "saspay" && stripe ? "stripe" : saspay ? "saspay" : "stripe");
      setOrder(""); setAttempt(""); setStatus(""); setResumeUrl(null); setNeedsRetry(false); setOrderPrice(null); setAccepted(false);
      window.history.replaceState(null, "", "/premium");
    } catch (e) { if (epoch === identityEpoch.current) {cooldown.remember(e); setError(e instanceof Error ? e.message : "Annulation indisponible");} }
    finally { if (epoch === identityEpoch.current) { operating.current = false; setBusy(false); } }
  }
  async function refresh() {
    if (cooldown.blocked() || operating.current) return;
    const epoch = identityEpoch.current, id = order || attempt;
    if (!id) return;
    operating.current = true; setBusy(true); setError("");
    try {
      const data = await clientRequest<PaymentState>(`/api/premium/payment/status?order=${encodeURIComponent(id)}`, {cache: "no-store"}, 45_000);
      if (epoch !== identityEpoch.current) return;
      setOrder(data.orderId ?? id); setStatus(data.status); setResumeUrl(data.checkoutUrl ?? null); setNeedsRetry(!!data.needsRetry);
      if (data.provider) setProvider(data.provider); if (data.plan) setPlan(data.plan);
      if (typeof data.amountMinor === "number") setOrderPrice(data); if (data.countryCode) setCountryCode(data.countryCode);
    } catch (e) { if (epoch === identityEpoch.current) {cooldown.remember(e); setError(e instanceof ClientRequestError && e.status === 404 ? "Cette tentative n’a pas encore été retrouvée. Patientez puis vérifiez à nouveau avant de payer." : e instanceof Error ? e.message : "Vérification indisponible");} }
    finally { if (epoch === identityEpoch.current) { operating.current = false; setBusy(false); } }
  }
  async function pay(event: React.FormEvent<HTMLFormElement>) {
    const epoch = identityEpoch.current;
    event.preventDefault(); if (cooldown.blocked() || operating.current) return; operating.current = true; setBusy(true); setError("");
    const id = attempt || crypto.randomUUID(); setProvider(selectedProvider); setAttempt(id);
    window.history.replaceState(null, "", `/premium?order=${encodeURIComponent(id)}`);
    try {
      const values = Object.fromEntries(new FormData(event.currentTarget));
      const data = await clientRequest<PaymentState>("/api/premium/payment", {method: "POST", headers: {"Content-Type": "application/json", "Idempotency-Key": id}, body: JSON.stringify({...values, provider: selectedProvider, plan, countryCode, termsVersion})}, 90_000);
      if (epoch !== identityEpoch.current) return;
      setProvider(selectedProvider); setOrder(data.orderId); setStatus(data.status); setOrderPrice(data); window.history.replaceState(null, "", `/premium?order=${encodeURIComponent(data.orderId)}`);
      if (data.checkoutUrl) window.location.assign(data.checkoutUrl);
    } catch (e) { if (epoch === identityEpoch.current) {
      cooldown.remember(e);
      if (e instanceof ClientRequestError && e.body.attemptCreated === false) {setAttempt(""); window.history.replaceState(null, "", "/premium");}
      setError(e instanceof ClientRequestError && ["timeout", "network", "invalid"].includes(e.kind) ? "La confirmation de la demande n’a pas été reçue. Conservez cette référence et vérifiez la tentative avant tout nouveau paiement." : e instanceof Error ? e.message : "Paiement indisponible");
    } }
    finally { if (epoch === identityEpoch.current) { operating.current = false; setBusy(false); } }
  }
  return <section className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6" aria-labelledby="achat-titre">
    <h2 id="achat-titre" className="text-2xl font-semibold">Mon abonnement Premium</h2>
    <TelegramAccount onChange={changeConnection} />
    {order ? <div className="mt-6 space-y-4"><p className="font-semibold">{orderPrice ? <>{PREMIUM_PLANS[plan].label} · {PREMIUM_PLANS[plan].duration} · {formatPremiumAmount(orderPrice.amountMinor, orderPrice.currency)}</> : "Vérifiez cette tentative pour retrouver sa formule et son montant."}</p><p>Votre tentative est conservée. Un retour de la page de paiement ne suffit pas à confirmer le règlement.</p><button type="button" className="button-primary" disabled={!connected || busy || cooldown.seconds > 0} onClick={refresh}>{busy ? "Vérification…" : "Vérifier ma commande"}</button>{needsRetry && <><p>La demande doit être reprise avec les mêmes coordonnées. Votre référence de tentative sera conservée.</p><button type="button" className="button-secondary" onClick={() => { setAttempt(order); setOrder(""); setNeedsRetry(false); }}>Reprendre la demande</button></>}{resumeUrl && status === "pending" && <a className="button-primary block" href={resumeUrl}>Continuer le paiement →</a>}<Link className="button-secondary block" href="/mon-abonnement">Voir mon abonnement et accéder au canal →</Link></div> : <form ref={formRef} className="mt-6 grid gap-4" onSubmit={pay}>
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
      {country && options && !checkingFailed && !stripeAvailable && !saspayAvailable && !attempt && <p role="status" className="text-amber-100">Aucun moyen de paiement n’est actuellement disponible pour ce pays et cette formule. <Link href="/support" className="underline">Contacter le support</Link></p>}
      {checkingFailed && <p role="status" className="text-amber-100">La vérification de certains moyens de paiement est momentanément indisponible. Les options déjà vérifiées restent utilisables. <button type="button" className="underline" disabled={busy || !!attempt} onClick={() => setOptionsReload(n => n + 1)}>Revérifier les moyens</button></p>}
      <label className="grid gap-2">Moyen de paiement<select value={selectedProvider} disabled={busy || !!attempt || !selectedProvider} onChange={e => {setProvider(e.target.value); setAccepted(false);}} className="genre-select">
        {!selectedProvider && <option value="">{checkingFailed ? "Vérification temporairement indisponible" : country ? "Aucun moyen disponible" : "Choisissez d’abord votre pays"}</option>}
        {(stripeAvailable || (!!attempt && provider === "stripe")) && <option value="stripe">Carte bancaire · Stripe</option>}
        {(saspayAvailable || (!!attempt && provider === "saspay")) && <option value="saspay">SasPay · Mobile Money</option>}
      </select></label>
      {selectedProvider === "saspay" && <><p className="text-sm text-zinc-300">Prix de référence : {priceLabel} pour {PREMIUM_PLANS[plan].duration}. {country && !attempt ? "Votre pays est présélectionné sur SasPay." : "Le tarif enregistré de cette tentative est conservé."} Les réseaux disponibles, une éventuelle conversion et les frais sont présentés sur sa page sécurisée avant validation.</p><label className="grid gap-2">Nom complet<input name="name" required autoComplete="name" maxLength={160} className="genre-select" /></label><label className="grid gap-2">E-mail<input name="email" required type="email" autoComplete="email" maxLength={254} className="genre-select" /></label></>}
      {priceLabel && <p className="font-semibold">Total à payer : {priceLabel} · {PREMIUM_PLANS[plan].duration}</p>}
      <p>{PREMIUM_PLANS[plan].duration} d’accès, renouvellement manuel. Aucun prélèvement automatique. Le règlement doit être confirmé avant l’accès au canal.</p>
      <label className="flex items-start gap-3"><input name="acceptedTerms" type="checkbox" required checked={accepted} onChange={e => setAccepted(e.target.checked)} className="mt-1" /> <span>Je confirme mon pays de facturation et j’accepte les <Link href="/conditions" className="underline">conditions de vente</Link> et les informations sur les <Link href="/remboursements" className="underline">remboursements</Link>.</span></label>
      <button disabled={busy || cooldown.seconds > 0 || !connected || (!country && !(attempt && orderPrice)) || !selectedProvider || (!attempt && !stripeAvailable && !saspayAvailable)} className="button-primary">{busy ? "Demande en cours…" : selectedProvider === "stripe" ? `Commander et payer ${priceLabel ?? ""}` : "Continuer vers SasPay →"}</button>
    </form>}
    {attempt && !order && <div className="mt-4 space-y-3"><p className="break-all text-xs text-white/60">Référence de tentative : {attempt}</p><button type="button" className="button-secondary" disabled={!connected || busy || cooldown.seconds > 0} onClick={refresh}>Vérifier cette tentative</button></div>}
    {cooldown.seconds > 0 && <p role="status" className="mt-4 text-amber-100">Réessayez dans {cooldown.seconds} s.</p>}
    {(order || attempt) && !["confirmed", "cancelled", "failed"].includes(status) && <button type="button" disabled={!connected || busy || cooldown.seconds > 0} className="button-secondary mt-4" onClick={changePayment}>{busy ? "Vérification…" : "Changer de pays, de formule ou de paiement"}</button>}
    {["failed", "cancelled"].includes(status) && <button type="button" className="button-secondary mt-4" onClick={() => { setOrder(""); setAttempt(""); setStatus(""); setResumeUrl(null); setOrderPrice(null); setAccepted(false); window.history.replaceState(null, "", "/premium"); }}>Lancer une nouvelle tentative</button>}
    <p role="status" className="mt-4">{({ pending: "Paiement en attente", confirmed: "Paiement confirmé : retrouvez votre accès dans Mon abonnement.", failed: "Paiement refusé", cancelled: "Paiement annulé" } as Record<string, string>)[status] ?? ""}</p>
    {error && <p role="alert" className="mt-4 text-amber-200">{error}</p>}
  </section>;
}
