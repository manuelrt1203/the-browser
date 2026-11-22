import type { StoredPremiumOrder } from "./premium-redis.ts";
import { hasPremiumAccess, orderOffer } from "./subscription.ts";

export function subscriptionAccount(orders: StoredPremiumOrder[], environment: "test" | "live", user: string, now = new Date()) {
  if (!Number.isFinite(now.getTime()) || orders.some(o => o.environment !== environment || o.telegramUserId !== user)) {
    throw new Error("Historique incompatible avec le compte");
  }
  const active = orders.filter(o => hasPremiumAccess(o, now)).sort((a, b) => Date.parse(b.expiresAt!) - Date.parse(a.expiresAt!));
  const expired = orders.some(o => o.status === "confirmed" && o.expiresAt && Date.parse(o.expiresAt) <= now.getTime());
  const status = active.length ? "active" : orders.some(o => o.status === "pending") ? "pending" : expired ? "expired" : "inactive";
  // Explicit public fields: no provider IDs, Telegram identity, invite link or session token.
  return {
    environment, status, renewal: "manual" as const,
    startsAt: active[0]?.startsAt ?? null, expiresAt: active[0]?.expiresAt ?? null,
    orders: orders.map(o => ({
      id: o.id, provider: o.provider, amountMinor: o.amountMinor, currency: o.currency,
      plan: orderOffer(o).plan, months: orderOffer(o).months,
      status: o.status === "confirmed" ? hasPremiumAccess(o, now) ? "active" : o.startsAt && Date.parse(o.startsAt) > now.getTime() ? "upcoming" : "expired" : o.status,
      startsAt: o.startsAt ?? null, expiresAt: o.expiresAt ?? null,
    })).sort((a, b) => (b.startsAt ?? "").localeCompare(a.startsAt ?? "") || a.id.localeCompare(b.id)),
  };
}
export type SubscriptionAccount = ReturnType<typeof subscriptionAccount> & { channelAccessAvailable: boolean };
