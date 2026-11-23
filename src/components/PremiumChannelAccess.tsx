"use client";
import {useEffect, useRef, useState} from "react";
import {clientRequest} from "@/lib/client-request";
import {useRequestCooldown} from "@/lib/use-request-cooldown";
import {PREMIUM_SESSION_EVENT, type ClientSession} from "@/lib/premium-client-session";
export function PremiumChannelAccess() {
  const [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const [link, setLink] = useState(""), [expires, setExpires] = useState(0);
  const sequence = useRef(0), active = useRef<AbortController | null>(null), revision = useRef<string | null>(null);
  const {seconds, blocked, remember, clear} = useRequestCooldown();
  useEffect(() => {
    const invalidate = () => { sequence.current++; active.current?.abort(); active.current = null; };
    const change = (event: Event) => {
      const session = (event as CustomEvent<ClientSession>).detail;
      if (!session || typeof session.connected !== "boolean") return;
      if (!session.connected || revision.current !== session.revision) {
        invalidate(); clear(); setLink(""); setExpires(0); setMessage(""); setBusy(false);
      }
      revision.current = session.connected ? session.revision : null;
    };
    window.addEventListener(PREMIUM_SESSION_EVENT, change);
    return () => { invalidate(); window.removeEventListener(PREMIUM_SESSION_EVENT, change); };
  }, [clear]);
  useEffect(() => {
    if (!expires) return;
    const timer = setTimeout(() => {setLink(""); setMessage("Ce lien a expiré. Demandez un nouveau lien pour rejoindre le canal.");}, Math.max(0, expires * 1000 - Date.now()));
    return () => clearTimeout(timer);
  }, [expires]);
  async function open() {
    if (active.current || blocked()) return;
    const controller = new AbortController(), id = ++sequence.current; active.current = controller;
    setBusy(true); setMessage(""); setLink(""); setExpires(0);
    try {
      const data = await clientRequest<{member: boolean; inviteUrl?: string; inviteExpiresAt?: number}>("/api/premium/access", {method: "POST", signal: controller.signal}, 45_000);
      if (id !== sequence.current) return;
      if (data.member) setMessage("Votre compte est déjà membre du canal privé.");
      else {
        const url = new URL(data.inviteUrl ?? "");
        if (url.protocol !== "https:" || url.hostname !== "t.me" || url.username || url.password || url.port) throw new Error("Lien indisponible. Réessayez plus tard.");
        setLink(url.toString()); setExpires(data.inviteExpiresAt ?? 0);
      }
    } catch (e) { if (id === sequence.current) {remember(e); setMessage(e instanceof Error ? e.message : "Accès indisponible. Vérifiez votre abonnement.");} }
    finally { if (active.current === controller) active.current = null; if (id === sequence.current) setBusy(false); }
  }
  return <section className="mt-6 rounded-xl border border-amber-200/30 p-5">
    <button onClick={open} disabled={busy || seconds > 0} className="rounded-lg bg-amber-200 px-5 py-3 font-semibold text-slate-950 disabled:opacity-50">{busy ? "Vérification…" : seconds > 0 ? `Réessayer dans ${seconds} s` : "Accéder au canal privé"}</button>
    {message && <p className="mt-3" role="status">{message}</p>}
    {link && <p className="mt-3"><a href={link} target="_blank" rel="noopener noreferrer" className="text-amber-200 underline">Demander à rejoindre le canal</a><br />Utilisez le compte Telegram connecté ici. Le lien expire après dix minutes au maximum.</p>}
  </section>;
}
