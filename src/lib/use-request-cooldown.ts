"use client";
import {useCallback, useEffect, useRef, useState} from "react";
import {ClientRequestError} from "./client-request.ts";

export function useRequestCooldown() {
  const untilRef = useRef(0), [until, setUntil] = useState(0), [clock, setClock] = useState(0);
  const clear = useCallback(() => { untilRef.current = 0; setUntil(0); }, []);
  const remember = useCallback((error: unknown) => {
    if (error instanceof ClientRequestError && error.retryAfter > 0) {
      const now = Date.now(), deadline = now + error.retryAfter * 1000;
      untilRef.current = deadline; setUntil(deadline); setClock(now);
    }
  }, []);
  const blocked = useCallback(() => untilRef.current > Date.now(), []);
  useEffect(() => {
    if (!until) return;
    const timer = setInterval(() => { const now = Date.now(); setClock(now); if (now >= until) clear(); }, 1000);
    return () => clearInterval(timer);
  }, [until, clear]);
  return {seconds: Math.max(0, Math.ceil((until - clock) / 1000)), blocked, remember, clear};
}
