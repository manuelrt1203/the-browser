import { liveProviderEnabled, stripeLiveClient } from "./premium-sales.ts";
import { saspayLiveClient, type SasPayRate } from "./saspay.ts";
import { PRICING_COUNTRIES, regionalOffer, paymentDecimal, type RegionalPlan } from "./regional-pricing.ts";

const plans = ["monthly", "quarterly", "annual"] as const;
// Only successful reads are cached for five minutes; provider failures are
// retried after 15 seconds, and never enable an unverified payment method.
export type RegionalAvailability = {
  countries: ReturnType<typeof regionalProviderOptions>;
  providers: {stripe: "ready" | "unavailable" | "disabled"; saspay: "ready" | "unavailable" | "disabled"};
};
export function createAvailabilityCache(source: () => Promise<RegionalAvailability>, now = Date.now) {
  let cache: {expires: number; value: Promise<RegionalAvailability>} | undefined;
  return () => {
    if (!cache || cache.expires <= now()) {
      const entry = {expires: Infinity, value: Promise.resolve().then(source).then(value => {
        entry.expires = now() + (Object.values(value.providers).includes("unavailable") ? 15_000 : 300_000);
        return value;
      }, error => { entry.expires = now() + 15_000; throw error; })};
      cache = entry;
    }
    return cache.value;
  };
}
export function regionalProviderOptions(currencies: readonly string[], rates: readonly SasPayRate[]) {
  return Object.fromEntries(PRICING_COUNTRIES.map(country => [country.code, Object.fromEntries(plans.map(plan => {
    const offer = regionalOffer(country.code, plan), amount = Number(paymentDecimal(offer.amountMinor, offer.currency));
    return [plan, {
      stripe: currencies.includes(country.currency.toLowerCase()),
      saspay: rates.some(rate => rate?.country_code === country.code && rate.currency === country.currency && rate.payin?.available === true &&
        Array.isArray(rate.payin.tiers) && rate.payin.tiers.some(tier => tier && tier.currency === country.currency && Number.isFinite(Number(tier.min_amount)) && amount >= Number(tier.min_amount) &&
          (tier.max_amount === null || (Number.isFinite(Number(tier.max_amount)) && amount <= Number(tier.max_amount))))),
    }];
  }))])) as Record<string, Record<RegionalPlan, {stripe: boolean; saspay: boolean}>>;
}
async function load(): Promise<RegionalAvailability> {
  const enabled = {stripe: liveProviderEnabled("stripe"), saspay: liveProviderEnabled("saspay")};
  const [stripe, sas] = await Promise.allSettled([
    (async () => {
      if (!enabled.stripe) return [];
      const client = stripeLiveClient(), account = await client.accounts.retrieve(null);
      if (!account.country || !account.charges_enabled) throw new Error("Compte indisponible");
      const currencies = (await client.countrySpecs.retrieve(account.country)).supported_payment_currencies;
      if (!Array.isArray(currencies) || currencies.some(c => typeof c !== "string" || !/^[a-z]{3}$/.test(c))) throw new Error("Référentiel invalide");
      return currencies;
    })(),
    (async () => enabled.saspay ? saspayLiveClient().payinRates() : [])(),
  ]);
  const options = regionalProviderOptions(stripe.status === "fulfilled" ? stripe.value : [], sas.status === "fulfilled" ? sas.value : []);
  return {countries: options, providers: {
    stripe: !enabled.stripe ? "disabled" : stripe.status === "fulfilled" ? "ready" : "unavailable",
    saspay: !enabled.saspay ? "disabled" : sas.status === "fulfilled" ? "ready" : "unavailable",
  }};
}
export const regionalPaymentAvailability = createAvailabilityCache(load);
export async function regionalPaymentOptions() { return (await regionalPaymentAvailability()).countries; }
