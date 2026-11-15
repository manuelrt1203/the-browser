import { cookies } from "next/headers";
import { premiumAuthEnabled, premiumAuthStore, premiumCookieName, premiumEnvironment } from "./premium-auth";

export async function premiumIdentity() {
  if (!premiumAuthEnabled()) return null;
  const token = (await cookies()).get(premiumCookieName())?.value ?? "";
  const session = await premiumAuthStore(premiumEnvironment()).status(token);
  return session.status === "connected" ? { telegramUserId: session.telegramUserId } : null;
}
