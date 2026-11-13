import Link from "next/link";
import { notFound } from "next/navigation";
import { business, formatPrice, getService } from "@/config/business";
import { HOLD_MINUTES } from "@/lib/availability";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { subtotalOf } from "@/lib/total";
import { formatWhen } from "@/lib/time";
import PaymentForm from "./PaymentForm";

export const dynamic = "force-dynamic";

export default async function Checkout(props: { params: Promise<{ id: string }>; searchParams: Promise<{ t?: string }> }) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const booking = await db.booking.findUnique({ where: { id: params.id } });
  if (!booking || booking.accessToken !== searchParams.t || !booking.stripePaymentId) notFound();
  const service = getService(booking.serviceId);
  const statusUrl = `/booking/${booking.id}?t=${booking.accessToken}`;

  if (booking.status !== "PENDING_PAYMENT") {
    return <><h1>Already paid</h1><p>This booking is already {booking.status === "CANCELLED" ? "cancelled" : "paid"}. <Link href={statusUrl}>See your booking</Link>.</p></>;
  }
  const minutesLeft = HOLD_MINUTES - (Date.now() - booking.createdAt.getTime()) / 60000;
  if (minutesLeft <= 0) {
    await stripe().paymentIntents.cancel(booking.stripePaymentId).catch(() => {});
    await db.booking.update({ where: { id: booking.id }, data: { status: "CANCELLED" } });
    return <><h1>Time's up</h1><p>We held this slot for {HOLD_MINUTES} minutes. Please <Link href={`/book/${booking.serviceId}`}>pick a time again</Link>.</p></>;
  }

  const intent = await stripe().paymentIntents.retrieve(booking.stripePaymentId);
  return (
    <>
      <h1>Payment</h1>
      <div className="card" style={{ marginTop: 16 }}>
        <strong>{service?.name ?? booking.serviceId}</strong>
        <p className="muted" style={{ margin: "4px 0" }}>{formatWhen(booking.start, business.timeZone)}</p>
        <p style={{ margin: 0 }}>Service: {formatPrice(booking.priceCents)}</p>
        {booking.discountCents > 0 && <p style={{ margin: 0 }} className="ok">Promo {booking.promoCode}: −{formatPrice(booking.discountCents)}</p>}
        <p className="muted" style={{ fontSize: 14 }}>Your time is held for {Math.ceil(minutesLeft)} more minutes.</p>
      </div>
      <PaymentForm
        clientSecret={intent.client_secret!}
        publishableKey={process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ""}
        returnUrl={`${(process.env.SITE_URL || process.env.RENDER_EXTERNAL_URL) ?? ""}/booking/success`}
        bookingId={booking.id}
        token={booking.accessToken}
        subtotalCents={subtotalOf(booking)}
        tipBaseCents={booking.priceCents}
        initialTipCents={booking.tipCents}
      />
    </>
  );
}
