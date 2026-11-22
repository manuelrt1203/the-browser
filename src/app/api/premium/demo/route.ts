import { randomUUID } from "node:crypto";
import { confirmPremiumPayment, createPremiumOrder, hasPremiumAccess } from "@/lib/subscription";

export async function POST(request: Request) {
  // This route never calls a provider, stores an entitlement, or grants Telegram access.
  if (process.env.NODE_ENV !== "development" || process.env.PREMIUM_DEMO_ENABLED !== "1") {
    return new Response(null, { status: 404 });
  }
  // Next may normalize request.url to localhost even when the browser uses 127.0.0.1.
  const expectedOrigin = `${new URL(request.url).protocol}//${request.headers.get("host")}`;
  if (request.headers.get("origin") !== expectedOrigin) {
    return Response.json({ error: "Origine refusée" }, { status: 403 });
  }
  let body;
  try { body = await request.json(); }
  catch { return Response.json({ error: "Requête invalide" }, { status: 400 }); }
  if (!body || (body.provider !== "saspay" && body.provider !== "stripe") ||
      !["pending", "confirmed", "failed", "cancelled"].includes(body.outcome)) {
    return Response.json({ error: "Scénario invalide" }, { status: 400 });
  }
  let order = createPremiumOrder(randomUUID(), body.provider, "monthly");
  const now = new Date();
  if (body.outcome === "confirmed") {
    order = confirmPremiumPayment(order, {
      orderId: order.id, provider: order.provider, paymentId: `demo-${randomUUID()}`,
      amountMinor: order.amountMinor, currency: order.currency, paidAt: now.toISOString(),
    });
  } else order = { ...order, status: body.outcome };
  return Response.json({ demo: true, order, simulatedAccess: hasPremiumAccess(order, now),
    telegramAccessGranted: false }, { headers: { "Cache-Control": "no-store" } });
}
