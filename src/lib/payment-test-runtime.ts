/** A production Vercel deployment can never expose the test payment endpoints. */
export function paymentTestRuntime(flag: string) {
  if (process.env[flag] !== "1" || (process.env.PREMIUM_ENVIRONMENT ?? "test") !== "test") return false;
  return (process.env.NODE_ENV === "development" && !process.env.VERCEL) ||
    (process.env.VERCEL === "1" && process.env.VERCEL_ENV === "preview");
}

export function paymentTestOrigin(value: string) {
  if ((process.env.PREMIUM_ENVIRONMENT ?? "test") !== "test") throw new Error("Environnement de test requis");
  const origin = new URL(value);
  if (origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash) throw new Error("Origine de test invalide");
  const local = process.env.NODE_ENV === "development" && !process.env.VERCEL && origin.protocol === "http:" &&
    ["localhost", "127.0.0.1"].includes(origin.hostname);
  const preview = process.env.VERCEL === "1" && process.env.VERCEL_ENV === "preview" &&
    origin.protocol === "https:" && process.env.SITE_URL === origin.origin;
  if (!local && !preview) throw new Error("Paiements de test réservés au serveur local ou à la prévisualisation configurée");
  return origin.origin;
}
