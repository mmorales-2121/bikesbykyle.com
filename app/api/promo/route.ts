import { NextRequest, NextResponse } from "next/server";
import { getService } from "@/config/business";
import { getCustomer } from "@/lib/customer";
import { checkPromo } from "@/lib/promo";
import { clientIp, MINUTE, take } from "@/lib/ratelimit";

// Lets the booking form check a promo code and show the discount before booking.
// The checkout checks the code again, so this is only for display.
export async function POST(req: NextRequest) {
  if (!take(`promo:${await clientIp()}`, 20, 10 * MINUTE)) {
    return NextResponse.json({ error: "Too many tries. Please wait a few minutes." }, { status: 429 });
  }
  const body = await req.json().catch(() => ({}));
  const service = getService(String(body.serviceId ?? ""));
  if (!service) return NextResponse.json({ error: "Unknown service." }, { status: 400 });
  const email = (await getCustomer())?.email ?? String(body.email ?? "");
  const r = await checkPromo(String(body.code ?? ""), { priceCents: service.priceCents, email });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json({ code: r.promo.code, label: r.label, discountCents: r.discountCents });
}
