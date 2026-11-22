/** Legacy offer retained for orders created before plan pricing was introduced.
 * New purchases MUST select a plan through premiumOffer/createPremiumOrder. */
export const PREMIUM_OFFERS = {
  saspay: { provider: "saspay", currency: "XAF", amountMinor: 3000, label: "3 000 FCFA" },
  stripe: { provider: "stripe", currency: "EUR", amountMinor: 457, label: "4,57 €" },
} as const;

export type PaymentProvider = keyof typeof PREMIUM_OFFERS;
export const PREMIUM_PLANS = {
  monthly: {label: "Mensuel", duration: "1 mois", months: 1},
  quarterly: {label: "Trimestriel", duration: "3 mois", months: 3},
  annual: {label: "Annuel", duration: "12 mois", months: 12},
} as const;
export type PremiumPlan = keyof typeof PREMIUM_PLANS;
export const PREMIUM_PRICE_VERSION = "2026-11-22" as const;
export const premiumTermsVersion = (base: string) => `${base}|${PREMIUM_PRICE_VERSION}`;
export function formatPremiumAmount(amountMinor: number, currency: string) {
  return new Intl.NumberFormat("fr-FR", {style: "currency", currency}).format(currency === "EUR" ? amountMinor / 100 : amountMinor);
}
export function validPremiumPlan(value: unknown): value is PremiumPlan { return typeof value === "string" && Object.hasOwn(PREMIUM_PLANS, value); }
export function premiumOffer(provider: PaymentProvider, plan: PremiumPlan) {
  if (!["stripe", "saspay"].includes(provider) || !validPremiumPlan(plan)) throw new Error("Formule invalide");
  const months = PREMIUM_PLANS[plan].months;
  const prices = {saspay: {monthly: 1500, quarterly: 4000, annual: 15000}, stripe: {monthly: 457, quarterly: 1300, annual: 5000}};
  const amountMinor = prices[provider][plan];
  const savingMinor = prices[provider].monthly * months - amountMinor;
  return {provider, plan, months, amountMinor, currency: provider === "saspay" ? "XAF" : "EUR",
    savingMinor, savingLabel: formatPremiumAmount(savingMinor, provider === "saspay" ? "XAF" : "EUR"),
    label: provider === "saspay" ? `${new Intl.NumberFormat("fr-FR").format(amountMinor)} FCFA` : new Intl.NumberFormat("fr-FR", {style: "currency", currency: "EUR"}).format(amountMinor / 100)};
}
export type PaymentStatus = "pending" | "confirmed" | "failed" | "cancelled";
export type PremiumOrder = {
  id: string;
  provider: PaymentProvider;
  amountMinor: number;
  currency: string;
  status: PaymentStatus;
  plan?: PremiumPlan;
  priceVersion?: typeof PREMIUM_PRICE_VERSION;
  confirmedPaymentId?: string;
  startsAt?: string;
  expiresAt?: string;
};

/** Validate against the immutable price/version of this order, including legacy
 * orders. Updating the public price must never reprice a pending payment. */
export function orderOffer(order: PremiumOrder) {
  const legacy = order.plan === undefined && order.priceVersion === undefined;
  if (!legacy && (order.priceVersion !== PREMIUM_PRICE_VERSION || !validPremiumPlan(order.plan))) throw new Error("Version de tarif invalide");
  const offer = legacy ? {...PREMIUM_OFFERS[order.provider], months: 1, plan: "monthly" as const} : premiumOffer(order.provider, order.plan!);
  if (!offer || offer.amountMinor !== order.amountMinor || offer.currency !== order.currency) throw new Error("Tarif de commande invalide");
  return offer;
}

/** Calendar periods use UTC; the account page displays the device timezone. */
export function monthlyExpiry(start: Date): Date {
  return calendarExpiry(start, 1);
}
export function calendarExpiry(start: Date, months: number): Date {
  if (![1, 3, 12].includes(months)) throw new Error("Durée invalide");
  if (!Number.isFinite(start.getTime())) throw new Error("Date invalide");
  const result = new Date(start);
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result;
}

/** Omitting plan reconstructs a historical monthly offer. New stored purchases
 * always pass an explicit plan, including monthly. */
export function createPremiumOrder(id: string, provider: PaymentProvider, plan?: PremiumPlan): PremiumOrder {
  const offer = plan === undefined ? PREMIUM_OFFERS[provider] : premiumOffer(provider, plan);
  return { id, provider, amountMinor: offer.amountMinor, currency: offer.currency, status: "pending",
    ...(plan === undefined ? {} : {plan, priceVersion: PREMIUM_PRICE_VERSION}) };
}

/** Call only with server-verified payment data, never with a browser success redirect. */
export function confirmPremiumPayment(order: PremiumOrder, payment: {
  orderId: string;
  provider: PaymentProvider;
  paymentId: string;
  amountMinor: number;
  currency: string;
  paidAt: string;
}): PremiumOrder {
  const offer = orderOffer(order);
  if (payment.orderId !== order.id || payment.provider !== order.provider ||
      payment.amountMinor !== order.amountMinor || payment.currency !== order.currency ||
      !payment.paymentId.trim()) throw new Error("Paiement incompatible avec la commande");
  if (order.status === "confirmed") {
    if (order.confirmedPaymentId !== payment.paymentId) throw new Error("Commande déjà payée");
    return order; // A duplicate event must never extend the period.
  }
  const start = new Date(payment.paidAt);
  const expiresAt = calendarExpiry(start, offer.months).toISOString();
  return { ...order, status: "confirmed", confirmedPaymentId: payment.paymentId,
    startsAt: start.toISOString(), expiresAt };
}

export function hasPremiumAccess(order: PremiumOrder, now: Date): boolean {
  return order.status === "confirmed" && Boolean(order.startsAt && order.expiresAt) &&
    now.getTime() >= Date.parse(order.startsAt!) && now.getTime() < Date.parse(order.expiresAt!);
}
