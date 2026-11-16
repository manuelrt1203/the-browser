"use client";
import Link from "next/link";
import { useCallback, useEffect, useState, useRef } from "react";
import { TelegramAccount } from "./TelegramAccount";
import { PremiumChannelAccess } from "./PremiumChannelAccess";
import type { SubscriptionAccount as Account } from "@/lib/subscription-account";
const labels: Record<string, string> = { active: "Actif", expired: "Expiré", pending: "Paiement en attente", inactive: "Aucun abonnement actif", failed: "Paiement refusé", cancelled: "Paiement annulé", upcoming: "À venir" };
const date = (value: string) => new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short" }).format(new Date(value));
const amount = (value: number, currency: string) => new Intl.NumberFormat("fr-FR", { style: "currency", currency }).format(currency === "EUR" ? value / 100 : value);
export function SubscriptionAccount() {
  const [connected, setConnected] = useState(false), [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(false), [error, setError] = useState("");
  const requestId = useRef(0), connectedRef = useRef(false);
  const requestController = useRef<AbortController | null>(null);
  const abortRequest = useCallback(() => { requestId.current++; requestController.current?.abort(); }, []);
  const refresh = useCallback(async () => {
    requestController.current?.abort();
    const controller = new AbortController();
    requestController.current = controller;
    const signal = controller.signal;
    const id = ++requestId.current;
    const current = () => !signal?.aborted && id === requestId.current;
    try {
      const response = await fetch("/api/premium/subscription", { cache: "no-store", signal });
      if (!response.ok) throw new Error();
      const data: Account = await response.json();
      if (current()) setAccount(data);
    } catch { if (current()) { setAccount(null); setError("Votre abonnement est momentanément indisponible. Réessayez plus tard."); } }
    finally { if (current()) setLoading(false); }
  }, []);
  const changeConnection = useCallback((value: boolean) => {
    if (connectedRef.current === value) return;
    connectedRef.current = value; abortRequest();
    setConnected(value); setAccount(null); setError(""); setLoading(value);
    if (value) void refresh();
  }, [abortRequest, refresh]);
  useEffect(() => abortRequest, [abortRequest]);
  return <>
    <TelegramAccount onChange={changeConnection} />
    {connected && <section className="mt-6 rounded-2xl border border-white/15 bg-white/5 p-6" aria-busy={loading}>
      <div className="flex flex-wrap items-center justify-between gap-4"><h2 className="text-xl font-semibold">Votre abonnement</h2><button onClick={() => { setLoading(true); setError(""); void refresh(); }} disabled={loading} className="text-sky-300 underline disabled:opacity-50">Actualiser</button></div>
      {loading && <p className="mt-4 text-white/60">Chargement…</p>}
      {error && <p className="mt-4 text-amber-200" role="alert">{error}</p>}
      {account && <>
        {account.environment === "test" && <p className="mt-4 rounded-lg bg-amber-300/10 p-3 text-amber-100">Démonstration : les paiements de test ne donnent aucun accès au canal Premium réel.</p>}
        <p className="mt-5 text-2xl font-semibold" role="status">{labels[account.status]}</p>
        {account.startsAt && <p className="mt-3 text-white/75">Début : {date(account.startsAt)}</p>}
        {account.expiresAt && <p className="mt-2 text-white/75">Échéance : {date(account.expiresAt)}</p>}
        <p className="mt-4 text-white/70">Renouvellement manuel. Aucun prélèvement automatique.</p>
        <p className="mt-2 text-sm text-white/50">Les horaires sont affichés selon le fuseau de votre appareil.</p>
        {account.channelAccessAvailable && <PremiumChannelAccess />}
        {!account.channelAccessAvailable && account.status === "pending" && <p className="mt-4 text-white/70">L’accès sera disponible après confirmation du paiement.</p>}
        {account.orders.length > 0 && <div className="mt-7"><h3 className="font-semibold">Historique</h3><ul className="mt-3 space-y-3">{account.orders.map(order => <li key={order.id} className="rounded-lg border border-white/10 p-4">
          <p>{labels[order.status]} · {amount(order.amountMinor, order.currency)} · {order.provider === "stripe" ? "Stripe" : "SasPay"}</p>
          {order.startsAt && <p className="mt-1 text-sm text-white/60">Du {date(order.startsAt)}{order.expiresAt && <> au {date(order.expiresAt)}</>}</p>}
          <p className="mt-2 break-all text-xs text-white/50">Référence de commande : {order.id}</p>
        </li>)}</ul></div>}
      </>}
    </section>}
    <nav className="mt-6 flex flex-wrap gap-5 text-sky-300 underline"><Link href="/premium">Voir l’offre Premium</Link><Link href="/support">Support</Link><Link href="/remboursements">Remboursements</Link></nav>
  </>;
}
