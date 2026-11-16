import { createPublicKey, timingSafeEqual, verify, type JsonWebKey } from "node:crypto";

type PublicKeys = { keys: JsonWebKey[] };
const audience = "https://the-browser-one.vercel.app/api/premium/access/expire";
async function githubKeys(): Promise<PublicKeys> {
  const response = await fetch("https://token.actions.githubusercontent.com/.well-known/jwks", {
    redirect: "error", cache: "no-store", signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error("Identité indisponible");
  return response.json();
}
/** Trust a signed identity of this exact workflow on main, never a caller-provided identity. */
export async function validGithubMaintenanceToken(token: string, keys = githubKeys, now = Date.now()) {
  try {
    if (token.length > 16_000) return false;
    const parts = token.split(".");
    if (parts.length !== 3 || parts.some(p => !/^[A-Za-z0-9_-]+$/.test(p))) return false;
    const header = JSON.parse(Buffer.from(parts[0], "base64url").toString());
    if (header.alg !== "RS256" || typeof header.kid !== "string" || header.kid.length > 200) return false;
    const jwks = await keys();
    const key = jwks.keys.find(k => (k as JsonWebKey & { kid?: string }).kid === header.kid && k.kty === "RSA");
    if (!key || !verify("RSA-SHA256", Buffer.from(`${parts[0]}.${parts[1]}`), createPublicKey({ key, format: "jwk" }), Buffer.from(parts[2], "base64url"))) return false;
    const claims = JSON.parse(Buffer.from(parts[1], "base64url").toString());
    const seconds = now / 1000;
    return Number.isFinite(seconds) && Number.isFinite(claims.iat) && Number.isFinite(claims.exp) &&
      claims.exp > seconds && claims.iat <= seconds + 60 && claims.exp > claims.iat && claims.exp - claims.iat <= 600 &&
      (claims.nbf === undefined || (Number.isFinite(claims.nbf) && claims.nbf <= seconds + 60)) &&
      claims.iss === "https://token.actions.githubusercontent.com" && claims.aud === audience &&
      claims.repository === "manuelrt1203/the-browser" && claims.repository_owner === "manuelrt1203" &&
      claims.ref === "refs/heads/main" && claims.sub === "repo:manuelrt1203/the-browser:ref:refs/heads/main" &&
      claims.workflow_ref === "manuelrt1203/the-browser/.github/workflows/premium-expiration.yml@refs/heads/main" &&
      ["schedule", "workflow_dispatch"].includes(claims.event_name);
  } catch { return false; }
}
export async function premiumMaintenanceAuthorized(header: string) {
  const secret = process.env.PREMIUM_ACCESS_CRON_SECRET;
  if (secret) {
    const actual = Buffer.from(header), expected = Buffer.from(`Bearer ${secret}`);
    if (actual.length === expected.length && timingSafeEqual(actual, expected)) return true;
  }
  if (process.env.PREMIUM_ACCESS_GITHUB_OIDC_ENABLED !== "1" || !header.startsWith("Bearer ")) return false;
  return validGithubMaintenanceToken(header.slice(7));
}
