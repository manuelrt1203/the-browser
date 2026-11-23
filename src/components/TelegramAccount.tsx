"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {clientRequest} from "@/lib/client-request";
import {publishClientSession} from "@/lib/premium-client-session";
import {useRequestCooldown} from "@/lib/use-request-cooldown";

export function TelegramAccount({ onChange }: { onChange?: (connected: boolean, revision?: string) => void }) {
  const [status, setStatus] = useState("loading");
  const [telegramUrl, setTelegramUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const {seconds, blocked, remember, clear} = useRequestCooldown();
  const sequence = useRef(0), active = useRef<AbortController | null>(null), mutating = useRef(false);

  const refresh = useCallback(async () => {
    if (active.current || mutating.current || blocked()) return;
    const controller = new AbortController(), id = ++sequence.current;
    active.current = controller;
    try {
      const session = await clientRequest<{status: string; sessionRevision?: string}>("/api/premium/auth/session", {cache: "no-store", signal: controller.signal});
      if (id !== sequence.current) return;
      if (!["anonymous", "pending", "connected"].includes(session.status)) throw new Error();
      setStatus(session.status); clear(); setError("");
      const connected = session.status === "connected", revision = connected ? session.sessionRevision ?? "" : "";
      publishClientSession(connected, revision); onChange?.(connected, revision);
      if (session.status !== "pending") setTelegramUrl("");
    } catch (e) { if (id === sequence.current) { remember(e); setStatus("unavailable"); setError(e instanceof Error ? e.message : "Connexion Telegram momentanément indisponible."); publishClientSession(false); onChange?.(false); } }
    finally { if (active.current === controller) active.current = null; }
  }, [onChange, blocked, remember, clear]);

  const cancelRequests = useCallback(() => {
    sequence.current++; active.current?.abort(); active.current = null; mutating.current = false;
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => { void refresh(); }, 0);
    return () => { clearTimeout(timer); cancelRequests(); };
  }, [refresh, cancelRequests]);
  useEffect(() => {
    if (status !== "pending") return;
    const interval = setInterval(() => { if (document.visibilityState === "visible") void refresh(); }, 4000);
    return () => clearInterval(interval);
  }, [status, refresh]);
  useEffect(() => {
    const resume = () => { if (document.visibilityState === "visible") void refresh(); };
    document.addEventListener("visibilitychange", resume); window.addEventListener("focus", resume);
    return () => { document.removeEventListener("visibilitychange", resume); window.removeEventListener("focus", resume); };
  }, [refresh]);

  async function start() {
    if (mutating.current || blocked()) return;
    mutating.current = true; const id = ++sequence.current;
    active.current?.abort(); const controller = new AbortController(); active.current = controller;
    setBusy(true); setError("");
    try {
      const data = await clientRequest<{telegramUrl: string}>("/api/premium/auth/start", {method: "POST", signal: controller.signal});
      if (id !== sequence.current) return;
      setTelegramUrl(data.telegramUrl); setStatus("pending"); clear(); publishClientSession(false); onChange?.(false);
    } catch (e) { if (id === sequence.current) {remember(e); setError(e instanceof Error ? e.message : "Impossible de démarrer la connexion. Patientez puis réessayez.");} }
    finally { if (active.current === controller) active.current = null; if (id === sequence.current) { mutating.current = false; setBusy(false); } }
  }
  async function logout() {
    if (mutating.current) return;
    mutating.current = true; const id = ++sequence.current;
    active.current?.abort(); const controller = new AbortController(); active.current = controller;
    setBusy(true); setError("");
    try {
      await clientRequest("/api/premium/auth/logout", {method: "POST", signal: controller.signal});
      if (id !== sequence.current) return;
      setStatus("anonymous"); setTelegramUrl(""); clear(); publishClientSession(false); onChange?.(false);
    } catch (e) { if (id === sequence.current) setError(e instanceof Error ? e.message : "Déconnexion indisponible. Réessayez."); }
    finally { if (active.current === controller) active.current = null; if (id === sequence.current) { mutating.current = false; setBusy(false); } }
  }
  return <section className="mt-8 surface-panel p-6">
    <h2 className="text-xl font-semibold">Votre compte Telegram</h2>
    <p className="mt-2 text-white/70">Associez votre compte pour que l’abonnement soit attribué à la bonne personne.</p>
    {status === "connected" ? <>
      <p className="mt-4 text-emerald-300">Votre compte Telegram est connecté.</p>
      <button onClick={logout} disabled={busy} className="mt-4 text-amber-200 underline disabled:opacity-50">Se déconnecter</button>
    </> : <>
      <button onClick={start} disabled={busy || seconds > 0 || status === "pending" || status === "loading"} className="mt-4 rounded-lg border border-amber-200/50 px-5 py-3 disabled:opacity-50">
        {busy ? "Connexion…" : seconds > 0 ? `Réessayer dans ${seconds} s` : "Connecter mon compte Telegram"}
      </button>
      {telegramUrl && <div className="mt-4 space-y-3">
        <a href={telegramUrl} target="_blank" rel="noopener noreferrer" className="inline-block rounded-lg bg-amber-200 px-5 py-3 font-semibold text-slate-950">Ouvrir Telegram</a>
        <p className="text-sm text-white/70">Appuyez sur « Démarrer », puis sur « Confirmer ma connexion » dans le bot. Revenez ensuite ici. Le lien expire après dix minutes.</p>
        <button disabled={busy || seconds > 0} onClick={() => { void refresh(); }} className="block text-amber-200 underline">J’ai confirmé dans Telegram</button>
      </div>}
      {status === "pending" && !telegramUrl && <button onClick={start} disabled={busy} className="mt-4 block text-amber-200 underline">Créer un nouveau lien de connexion</button>}
    </>}
    <p role="status" aria-live="polite" className="mt-3 text-amber-200">{error}</p>
  </section>;
}
