/** Amounts are integers in the currency's smallest unit: XAF francs, EUR cents. */
export const PREMIUM_OFFERS = {
  saspay: { provider: "saspay", currency: "XAF", amountMinor: 3000, label: "3 000 FCFA" },
  stripe: { provider: "stripe", currency: "EUR", amountMinor: 457, label: "4,57 €" },
} as const;

export type PaymentProvider = keyof typeof PREMIUM_OFFERS;
export type PaymentStatus = "pending" | "confirmed" | "failed" | "cancelled";
export type PremiumOrder = {
  id: string;
  provider: PaymentProvider;
  amountMinor: number;
  currency: string;
  status: PaymentStatus;
  confirmedPaymentId?: string;
  startsAt?: string;
  expiresAt?: string;
};

/** UTC is a technical default for the prototype; the commercial timezone is still open. */
export function monthlyExpiry(start: Date): Date {
  if (!Number.isFinite(start.getTime())) throw new Error("Date invalide");
  const result = new Date(start);
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + 1);
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result;
}

export function createPremiumOrder(id: string, provider: PaymentProvider): PremiumOrder {
  const offer = PREMIUM_OFFERS[provider];
  return { id, provider, amountMinor: offer.amountMinor, currency: offer.currency, status: "pending" };
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
  if (payment.orderId !== order.id || payment.provider !== order.provider ||
      payment.amountMinor !== order.amountMinor || payment.currency !== order.currency ||
      !payment.paymentId.trim()) throw new Error("Paiement incompatible avec la commande");
  if (order.status === "confirmed") {
    if (order.confirmedPaymentId !== payment.paymentId) throw new Error("Commande déjà payée");
    return order; // A duplicate event must never extend the period.
  }
  const start = new Date(payment.paidAt);
  const expiresAt = monthlyExpiry(start).toISOString();
  return { ...order, status: "confirmed", confirmedPaymentId: payment.paymentId,
    startsAt: start.toISOString(), expiresAt };
}

export function hasPremiumAccess(order: PremiumOrder, now: Date): boolean {
  return order.status === "confirmed" && Boolean(order.startsAt && order.expiresAt) &&
    now.getTime() >= Date.parse(order.startsAt!) && now.getTime() < Date.parse(order.expiresAt!);
}
