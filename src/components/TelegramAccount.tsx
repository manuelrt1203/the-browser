"use client";

import { useCallback, useEffect, useState } from "react";

export function TelegramAccount({ onChange }: { onChange?: (connected: boolean) => void }) {
  const [status, setStatus] = useState("loading");
  const [telegramUrl, setTelegramUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/premium/auth/session", { cache: "no-store" });
      if (!response.ok) throw new Error();
      const session = await response.json();
      setStatus(session.status); onChange?.(session.status === "connected"); setError("");
      if (session.status !== "pending") setTelegramUrl("");
    } catch { setError("Connexion Telegram momentanément indisponible."); onChange?.(false); }
  }, [onChange]);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/premium/auth/session", { cache: "no-store", signal: controller.signal })
      .then(response => { if (!response.ok) throw new Error(); return response.json(); })
      .then(session => { setStatus(session.status); onChange?.(session.status === "connected"); })
      .catch(() => { if (!controller.signal.aborted) { setStatus("anonymous"); setError("Connexion Telegram momentanément indisponible."); onChange?.(false); } });
    return () => controller.abort();
  }, [onChange]);
  useEffect(() => {
    if (!telegramUrl) return;
    const interval = setInterval(() => { void refresh(); }, 3000);
    return () => clearInterval(interval);
  }, [telegramUrl, refresh]);

  async function start() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/premium/auth/start", { method: "POST" });
      if (!response.ok) throw new Error();
      const data = await response.json();
      setTelegramUrl(data.telegramUrl); setStatus("pending"); onChange?.(false);
    } catch { setError("Impossible de démarrer la connexion. Réessayez plus tard."); }
    finally { setBusy(false); }
  }
  async function logout() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/premium/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error();
      setStatus("anonymous"); setTelegramUrl(""); onChange?.(false);
    } catch { setError("Déconnexion indisponible. Réessayez."); }
    finally { setBusy(false); }
  }
  return <section className="mt-8 surface-panel p-6">
    <h2 className="text-xl font-semibold">Votre compte Telegram</h2>
    <p className="mt-2 text-white/70">Associez votre compte pour que l’abonnement soit attribué à la bonne personne.</p>
    {status === "connected" ? <>
      <p className="mt-4 text-emerald-300">Votre compte Telegram est connecté.</p>
      <button onClick={logout} disabled={busy} className="mt-4 text-amber-200 underline disabled:opacity-50">Se déconnecter</button>
    </> : <>
      <button onClick={start} disabled={busy || status === "pending" || status === "loading"} className="mt-4 rounded-lg border border-amber-200/50 px-5 py-3 disabled:opacity-50">
        {busy ? "Connexion…" : "Connecter mon compte Telegram"}
      </button>
      {telegramUrl && <div className="mt-4 space-y-3">
        <a href={telegramUrl} target="_blank" rel="noopener noreferrer" className="inline-block rounded-lg bg-amber-200 px-5 py-3 font-semibold text-slate-950">Ouvrir Telegram</a>
        <p className="text-sm text-white/70">Appuyez sur « Démarrer », puis sur « Confirmer ma connexion » dans le bot. Revenez ensuite ici. Le lien expire après dix minutes.</p>
        <button onClick={() => { void refresh(); }} className="block text-amber-200 underline">J’ai confirmé dans Telegram</button>
      </div>}
      {status === "pending" && !telegramUrl && <button onClick={start} disabled={busy} className="mt-4 block text-amber-200 underline">Créer un nouveau lien de connexion</button>}
    </>}
    <p role="status" aria-live="polite" className="mt-3 text-amber-200">{error}</p>
  </section>;
}
