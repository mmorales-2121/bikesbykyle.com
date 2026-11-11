import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { confirmBooking } from "@/lib/booking";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";

// Stripe calls this when a payment finishes. Subscribe it to payment_intent.succeeded and payment_intent.canceled.
export async function POST(req: NextRequest) {
  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(await req.text(), req.headers.get("stripe-signature") ?? "", process.env.STRIPE_WEBHOOK_SECRET ?? "");
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "payment_intent.succeeded" || event.type === "payment_intent.canceled") {
    const intent = event.data.object as Stripe.PaymentIntent;
    const bookingId = intent.metadata?.bookingId;
    if (bookingId) {
      if (event.type === "payment_intent.succeeded") {
        if (intent.metadata.tipCents) await db.booking.updateMany({ where: { id: bookingId }, data: { tipCents: Number(intent.metadata.tipCents) || 0 } });
        await confirmBooking(bookingId);
      }
      else await db.booking.updateMany({ where: { id: bookingId, status: "PENDING_PAYMENT" }, data: { status: "CANCELLED" } });
    }
  }
  return NextResponse.json({ received: true });
}
