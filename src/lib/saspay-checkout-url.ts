/** Production currently returns checkout.saspay.me; the reference also lists
 * pay.saspay.me. Sandbox remains strictly isolated from both live hosts. */
export function sasPayCheckoutUrl(value: string, environment: "test" | "live") {
  const url = new URL(value);
  const hosts = environment === "test" ? ["sandbox-checkout.saspay.me"] : ["pay.saspay.me", "checkout.saspay.me"];
  if (url.protocol !== "https:" || !hosts.includes(url.hostname) || url.username || url.password || url.port) throw new Error("Checkout SasPay invalide");
  return url.toString();
}
