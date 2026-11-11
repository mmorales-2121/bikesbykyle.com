import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { business, getService } from "@/config/business";
import { isSlotOpen } from "@/lib/availability";
import { confirmBooking } from "@/lib/booking";
import { MAX_TIP_CENTS } from "@/lib/tip";
import { clientIp, HOUR, take } from "@/lib/ratelimit";
import { getCustomer } from "@/lib/customer";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { formatWhen } from "@/lib/time";

// Creates a held booking and a Stripe PaymentIntent, then sends the customer to our own payment page.
export async function POST(req: NextRequest) {
  const tooMany = () => NextResponse.json({ error: "Too many booking attempts. Please try again in an hour, or call us." }, { status: 429 });
  if (!take(`checkout:ip:${await clientIp()}`, 10, HOUR)) return tooMany();
  const body = await req.json().catch(() => ({}));
  const service = getService(String(body.serviceId ?? ""));
  const start = new Date(String(body.start ?? ""));
  const name = String(body.name ?? "").trim().slice(0, 120);
  const customer = await getCustomer();
  const email = customer?.email ?? String(body.email ?? "").trim().toLowerCase();
  const payAtPickup = body.payment === "AT_PICKUP";
  if (!service || isNaN(start.getTime()) || !name || !/^\S+@\S+\.\S+$/.test(email)) {
    return NextResponse.json({ error: "Please fill in your name, a valid email and pick a time." }, { status: 400 });
  }
  if (!take(`checkout:email:${email}`, 5, HOUR)) return tooMany();
  if (!(await isSlotOpen(service, start))) {
    return NextResponse.json({ error: "Sorry, that time was just taken. Please pick another." }, { status: 409 });
  }

  const booking = await db.booking.create({
    data: {
      accessToken: randomBytes(16).toString("hex"),
      serviceId: service.id,
      priceCents: service.priceCents,
      customerId: customer?.id ?? null,
      customerName: name,
      customerEmail: email,
      customerPhone: String(body.phone ?? "").trim().slice(0, 40) || null,
      notes: String(body.notes ?? "").trim().slice(0, 1000) || null,
      start,
      end: new Date(start.getTime() + service.durationMinutes * 60000),
      paymentMethod: payAtPickup ? "AT_PICKUP" : "ONLINE",
      tipCents: payAtPickup ? Math.min(MAX_TIP_CENTS, Math.max(0, Math.round(Number(body.tipCents) || 0))) : 0,
    },
  });

  if (payAtPickup) {
    await confirmBooking(booking.id, { paid: false });
    return NextResponse.json({ url: `/booking/${booking.id}?t=${booking.accessToken}` });
  }

  const intent = await stripe().paymentIntents.create({
    amount: service.priceCents,
    currency: business.currency,
    receipt_email: email,
    description: `${service.name}, ${formatWhen(start, business.timeZone)}`,
    automatic_payment_methods: { enabled: true },
    metadata: { bookingId: booking.id },
  });
  await db.booking.update({ where: { id: booking.id }, data: { stripePaymentId: intent.id } });
  return NextResponse.json({ url: `/checkout/${booking.id}?t=${booking.accessToken}` });
}
