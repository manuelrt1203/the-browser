"use client";
import { useMemo, useState, useSyncExternalStore } from "react";
import { decodeWatchlist, validTitleId } from "./catalogue-browsing.ts";
const KEY = "the-browser:watchlist:v1", EVENT = "the-browser-watchlist-change";
function snapshot() { try { return localStorage.getItem(KEY) ?? "[]"; } catch { return "[]"; } }
function subscribe(callback: () => void) {
  const storage = (event: StorageEvent) => { if (event.key === KEY || event.key === null) callback(); };
  window.addEventListener("storage", storage); window.addEventListener(EVENT, callback);
  return () => { window.removeEventListener("storage", storage); window.removeEventListener(EVENT, callback); };
}
export function useWatchlist() {
  const raw = useSyncExternalStore(subscribe, snapshot, () => "[]");
  const saved = useMemo(() => new Set(decodeWatchlist(raw)), [raw]);
  const [error, setError] = useState("");
  function toggle(id: string) {
    if (!validTitleId(id)) return;
    try {
      const values = new Set(decodeWatchlist(snapshot()));
      if (values.has(id)) values.delete(id);
      else { if (values.size >= 1000) { setError("Votre liste contient déjà 1 000 titres. Retirez-en un avant d’en ajouter un autre."); return; } values.add(id); }
      localStorage.setItem(KEY, JSON.stringify([...values]));
      window.dispatchEvent(new Event(EVENT)); setError("");
    } catch { setError("Impossible d’enregistrer la liste dans ce navigateur. Vérifiez que le stockage local est autorisé et dispose d’espace libre."); }
  }
  return { saved, toggle, error };
}
