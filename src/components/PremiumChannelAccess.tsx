"use client";
import { useState } from "react";
export function PremiumChannelAccess() {
  const [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const [link, setLink] = useState("");
  async function open() {
    setBusy(true); setMessage(""); setLink("");
    try {
      const response = await fetch("/api/premium/access", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error();
      if (data.member) setMessage("Votre compte est déjà membre du canal privé.");
      else setLink(data.inviteUrl);
    } catch { setMessage("Accès indisponible. Connectez votre compte Telegram et vérifiez votre abonnement."); }
    finally { setBusy(false); }
  }
  return <section className="mt-6 rounded-xl border border-amber-200/30 p-5">
    <button onClick={open} disabled={busy} className="rounded-lg bg-amber-200 px-5 py-3 font-semibold text-slate-950 disabled:opacity-50">{busy ? "Vérification…" : "Accéder au canal privé"}</button>
    {message && <p className="mt-3" role="status">{message}</p>}
    {link && <p className="mt-3"><a href={link} target="_blank" rel="noopener noreferrer" className="text-amber-200 underline">Demander à rejoindre le canal</a><br />Utilisez le compte Telegram connecté ici. Le lien expire après dix minutes au maximum.</p>}
  </section>;
}
