export class RequestBodyError extends Error {
  readonly status: 400 | 413;
  constructor(status: 400 | 413) { super("Requête invalide"); this.status = status; }
}
/** Bound memory while reading, including when Content-Length is absent or false.
 * Return original bytes so webhook signatures never use re-serialized JSON. */
export async function limitedRequestBody(request: Request, maximum: number): Promise<Buffer> {
  const length = request.headers.get("content-length");
  if (length && /^\d+$/.test(length) && Number(length) > maximum) throw new RequestBodyError(413);
  if (!request.body) return Buffer.alloc(0);
  const reader = request.body.getReader(), chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const {done, value} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maximum) { void reader.cancel().catch(() => {}); throw new RequestBodyError(413); }
      chunks.push(value);
    }
    return Buffer.concat(chunks, size);
  } finally { reader.releaseLock(); }
}
export async function limitedJsonObject(request: Request, maximum: number) {
  const raw = await limitedRequestBody(request, maximum);
  try {
    const value = JSON.parse(raw.toString("utf8"));
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
    return value as Record<string, unknown>;
  } catch { throw new RequestBodyError(400); }
}
export function requestBodyErrorResponse(error: unknown) {
  return Response.json({error: error instanceof RequestBodyError && error.status === 413 ? "Requête trop volumineuse." : "Requête invalide."},
    {status: error instanceof RequestBodyError ? error.status : 400, headers: {"Cache-Control": "private, no-store"}});
}
