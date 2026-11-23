import { premiumSalesEnabled } from "@/lib/premium-sales";
import { regionalPaymentOptions } from "@/lib/regional-payments";
import { pricingCountry } from "@/lib/regional-pricing";

export async function GET(request: Request) {
  const headers = {"Cache-Control": "private, no-store"};
  if (!premiumSalesEnabled()) return new Response(null, {status: 404, headers});
  const suggested = process.env.VERCEL === "1" ? pricingCountry(request.headers.get("x-vercel-ip-country"))?.code : undefined;
  return Response.json({countries: await regionalPaymentOptions(), suggestedCountry: suggested ?? null}, {headers});
}
