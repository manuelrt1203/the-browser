/** One request, with a deadline covering both headers and JSON body. Mutations
 * are never automatically retried: the caller retains its existing attempt. */
export class ClientRequestError extends Error {
  readonly kind: "http" | "timeout" | "network" | "invalid";
  readonly status: number;
  readonly retryAfter: number;
  readonly body: Record<string, unknown>;
  constructor(message: string, kind: ClientRequestError["kind"], status = 0, retryAfter = 0, body: Record<string, unknown> = {}) {
    super(message); this.kind = kind; this.status = status; this.retryAfter = retryAfter; this.body = body;
  }
}
export function retryAfterSeconds(value: string | null, now = Date.now()) {
  if (!value) return 60;
  const seconds = /^\d+$/.test(value) ? Number(value) : Math.ceil((Date.parse(value) - now) / 1000);
  return Number.isFinite(seconds) ? Math.min(3600, Math.max(1, seconds)) : 60;
}
export async function clientRequest<T = Record<string, unknown>>(url: string, options: RequestInit = {}, timeoutMs = 15_000): Promise<T> {
  const controller = new AbortController(), parent = options.signal;
  let timer: ReturnType<typeof setTimeout> | undefined, abort: (() => void) | undefined;
  const stopped = new Promise<never>((_, reject) => {
    abort = () => { reject(new DOMException("Requête annulée", "AbortError")); controller.abort(); };
    if (parent?.aborted) { abort(); return; }
    parent?.addEventListener("abort", abort, {once: true});
    timer = setTimeout(() => { reject(new ClientRequestError("La réponse prend trop de temps. Vérifiez votre connexion.", "timeout")); controller.abort(); }, timeoutMs);
  });
  try {
    if (parent?.aborted) return await stopped;
    return await Promise.race([stopped, (async () => {
      const response = await fetch(url, {...options, signal: controller.signal});
      const value: unknown = await response.json().catch(() => null);
      const body = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
      if (!response.ok) {
        const retryAfter = response.status === 429 ? retryAfterSeconds(response.headers.get("retry-after")) : 0;
        const message = response.status === 429 ? `Trop de demandes. Réessayez dans ${retryAfter} seconde${retryAfter > 1 ? "s" : ""}.`
          : response.status === 401 ? "Reconnectez votre compte Telegram."
          : typeof body.error === "string" ? body.error.slice(0, 500) : "Le service est momentanément indisponible.";
        throw new ClientRequestError(message, "http", response.status, retryAfter, body);
      }
      if (!value || typeof value !== "object" || Array.isArray(value)) throw new ClientRequestError("La réponse du service est invalide. Réessayez plus tard.", "invalid");
      return value as T;
    })()]);
  } catch (error) {
    if (error instanceof ClientRequestError || parent?.aborted) throw error;
    throw new ClientRequestError("La connexion a été interrompue. Vérifiez votre réseau.", "network");
  } finally {
    clearTimeout(timer); if (abort) parent?.removeEventListener("abort", abort);
  }
}
