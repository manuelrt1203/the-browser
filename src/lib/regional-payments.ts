import { liveProviderEnabled, stripeLiveClient } from "./premium-sales.ts";
import { saspayLiveClient, type SasPayRate } from "./saspay.ts";
import { PRICING_COUNTRIES, regionalOffer, paymentDecimal, type RegionalPlan } from "./regional-pricing.ts";

const plans = ["monthly", "quarterly", "annual"] as const;
// Only successful reads are cached for five minutes; provider failures are
// retried after 15 seconds, and never enable an unverified payment method.
let cache: {expires: number; value: ReturnType<typeof load>} | undefined;
export function regionalProviderOptions(currencies: readonly string[], rates: readonly SasPayRate[]) {
  return Object.fromEntries(PRICING_COUNTRIES.map(country => [country.code, Object.fromEntries(plans.map(plan => {
    const offer = regionalOffer(country.code, plan), amount = Number(paymentDecimal(offer.amountMinor, offer.currency));
    return [plan, {
      stripe: currencies.includes(country.currency.toLowerCase()),
      saspay: rates.some(rate => rate.country_code === country.code && rate.currency === country.currency && rate.payin?.available === true &&
        rate.payin.tiers?.some(tier => tier.currency === country.currency && Number.isFinite(Number(tier.min_amount)) && amount >= Number(tier.min_amount) &&
          (tier.max_amount === null || (Number.isFinite(Number(tier.max_amount)) && amount <= Number(tier.max_amount))))),
    }];
  }))])) as Record<string, Record<RegionalPlan, {stripe: boolean; saspay: boolean}>>;
}
async function load() {
  const [stripe, sas] = await Promise.allSettled([
    (async () => {
      if (!liveProviderEnabled("stripe")) return [];
      const client = stripeLiveClient(), account = await client.accounts.retrieve(null);
      if (!account.country || !account.charges_enabled) throw new Error("Compte indisponible");
      return (await client.countrySpecs.retrieve(account.country)).supported_payment_currencies;
    })(),
    (async () => liveProviderEnabled("saspay") ? saspayLiveClient().payinRates() : [])(),
  ]);
  const options = regionalProviderOptions(stripe.status === "fulfilled" ? stripe.value : [], sas.status === "fulfilled" ? sas.value : []);
  const verified = stripe.status === "fulfilled" && sas.status === "fulfilled";
  if (!verified && cache) cache.expires = Date.now() + 15_000;
  return options;
}
export function regionalPaymentOptions() {
  if (!cache || cache.expires < Date.now()) cache = {expires: Date.now() + 300_000, value: load()};
  return cache.value;
}
