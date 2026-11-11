import { NextRequest, NextResponse } from "next/server";
import { getService } from "@/config/business";
import { MAX_TIP_CENTS } from "@/lib/tip";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { clientIp, MINUTE, take } from "@/lib/ratelimit";
import { safeEqual } from "@/lib/secret";

// Changes the tip on an unpaid online booking by updating the PaymentIntent amount.
export async function POST(req: NextRequest) {
  if (!take(`tip:${await clientIp()}`, 30, 10 * MINUTE)) return NextResponse.json({ error: "Too many changes. Please wait a few minutes." }, { status: 429 });
  const body = await req.json().catch(() => ({}));
  const booking = await db.booking.findUnique({ where: { id: String(body.bookingId ?? "") } });
  if (!booking || !safeEqual(booking.accessToken, String(body.token ?? "")) || booking.status !== "PENDING_PAYMENT" || !booking.stripePaymentId) {
    return NextResponse.json({ error: "This booking can't be changed." }, { status: 400 });
  }
  const tipCents = Math.min(MAX_TIP_CENTS, Math.max(0, Math.round(Number(body.tipCents) || 0)));
  const price = booking.priceCents || getService(booking.serviceId)?.priceCents || 0;
  await stripe().paymentIntents.update(booking.stripePaymentId, { amount: price + tipCents, metadata: { bookingId: booking.id, tipCents: String(tipCents) } });
  await db.booking.update({ where: { id: booking.id }, data: { tipCents } });
  return NextResponse.json({ totalCents: price + tipCents });
}
