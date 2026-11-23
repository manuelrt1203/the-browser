// Commercial prices approved on 23 November 2026. All stored amounts use the
// currency's minor unit, independently of the selected payment provider.
export const REGIONAL_PRICE_VERSION = "2026-11-23-regional" as const;
const GRID = {
  EUR: {digits: 2, amounts: [457, 1300, 5000]},
  XAF: {digits: 0, amounts: [1500, 4000, 15000]},
  XOF: {digits: 0, amounts: [1500, 4000, 15000]},
  CDF: {digits: 2, amounts: [600000, 1600000, 6000000]},
  GNF: {digits: 0, amounts: [25000, 65000, 250000]},
  MGA: {digits: 0, amounts: [12000, 32000, 120000]},
  RWF: {digits: 0, amounts: [3500, 9500, 35000]},
  BIF: {digits: 0, amounts: [8000, 21000, 80000]},
  DJF: {digits: 0, amounts: [500, 1300, 5000]},
  KMF: {digits: 0, amounts: [1250, 3300, 12500]},
  MAD: {digits: 2, amounts: [2500, 6500, 25000]},
  DZD: {digits: 2, amounts: [35000, 95000, 350000]},
  TND: {digits: 3, amounts: [8000, 21000, 80000]},
  MRU: {digits: 2, amounts: [10000, 27000, 100000]},
  MUR: {digits: 2, amounts: [12500, 33000, 125000]},
  SCR: {digits: 2, amounts: [5000, 13000, 50000]},
} as const;
export type RegionalCurrency = keyof typeof GRID;
export type RegionalPlan = "monthly" | "quarterly" | "annual";
export function currencyDigits(currency: string) {
  if (!Object.hasOwn(GRID, currency)) throw new Error("Devise inconnue");
  return GRID[currency as RegionalCurrency].digits;
}
export function formatRegionalAmount(amountMinor: number, currency: string) {
  return new Intl.NumberFormat("fr-FR", {style: "currency", currency}).format(amountMinor / 10 ** currencyDigits(currency));
}
/** Decimal strings for SasPay, without floating-point arithmetic. */
export function paymentDecimal(amountMinor: number, currency: string) {
  if (!Number.isSafeInteger(amountMinor) || amountMinor < 0) throw new Error("Montant invalide");
  const digits = currencyDigits(currency);
  if (!digits) return `${amountMinor}.00`;
  const padded = String(amountMinor).padStart(digits + 1, "0");
  const fraction = padded.slice(-digits).padEnd(2, "0");
  return `${padded.slice(0, -digits)}.${digits === 3 && fraction.endsWith("0") ? fraction.slice(0, -1) : fraction}`;
}
export function decimalMatches(value: unknown, amountMinor: number, currency: string) {
  if (typeof value !== "string" || !/^\d{1,12}(?:\.\d{1,3})?$/.test(value)) return false;
  const [whole, fraction = ""] = value.split(".");
  const digits = currencyDigits(currency);
  return BigInt(whole + fraction) * BigInt(10 ** digits) === BigInt(amountMinor) * BigInt(10 ** fraction.length);
}

export const PRICING_COUNTRIES: readonly {code: string; name: string; zone: string; currency: RegionalCurrency}[] = [
  ...[["FR", "France"], ["BE", "Belgique"], ["LU", "Luxembourg"], ["MC", "Monaco"], ["CH", "Suisse"]].map(([code, name]) => ({code, name, zone: "Europe francophone", currency: "EUR" as const})),
  ...[["CG", "Congo-Brazzaville"], ["CM", "Cameroun"], ["GA", "Gabon"], ["CF", "République centrafricaine"], ["TD", "Tchad"], ["GQ", "Guinée équatoriale"]].map(([code, name]) => ({code, name, zone: "Afrique CFA centrale", currency: "XAF" as const})),
  ...[["BJ", "Bénin"], ["BF", "Burkina Faso"], ["CI", "Côte d’Ivoire"], ["ML", "Mali"], ["NE", "Niger"], ["SN", "Sénégal"], ["TG", "Togo"]].map(([code, name]) => ({code, name, zone: "Afrique CFA occidentale", currency: "XOF" as const})),
  ...([
    ["CD", "République démocratique du Congo", "CDF"], ["GN", "Guinée", "GNF"], ["MG", "Madagascar", "MGA"],
    ["RW", "Rwanda", "RWF"], ["BI", "Burundi", "BIF"], ["DJ", "Djibouti", "DJF"], ["KM", "Comores", "KMF"],
    ["MA", "Maroc", "MAD"], ["DZ", "Algérie", "DZD"], ["TN", "Tunisie", "TND"], ["MR", "Mauritanie", "MRU"],
    ["MU", "Maurice", "MUR"], ["SC", "Seychelles", "SCR"],
  ] as const).map(([code, name, currency]) => ({code, name, currency, zone: "Afrique francophone hors CFA"})),
];
export function pricingCountry(code: unknown) {
  return typeof code === "string" ? PRICING_COUNTRIES.find(c => c.code === code) : undefined;
}
export function regionalOffer(countryCode: string, plan: RegionalPlan) {
  const country = pricingCountry(countryCode), index = ["monthly", "quarterly", "annual"].indexOf(plan);
  if (!country || index < 0) throw new Error("Pays ou formule invalide");
  const grid = GRID[country.currency], months = [1, 3, 12][index], amountMinor = grid.amounts[index];
  const savingMinor = grid.amounts[0] * months - amountMinor;
  return {countryCode: country.code, zone: country.zone, currency: country.currency, plan, months, amountMinor, savingMinor,
    label: formatRegionalAmount(amountMinor, country.currency), savingLabel: formatRegionalAmount(savingMinor, country.currency)};
}
