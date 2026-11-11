import { redirect } from "next/navigation";
import { confirmBooking } from "@/lib/booking";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";

// Stripe returns customers here after the payment page. We double-check payment, then show their booking page.
export default async function Success(props: { searchParams: Promise<{ payment_intent?: string }> }) {
  const searchParams = await props.searchParams;
  const id = searchParams.payment_intent;
  if (!id) redirect("/");
  const intent = await stripe().paymentIntents.retrieve(id);
  const booking = await db.booking.findUnique({ where: { stripePaymentId: intent.id } });
  if (!booking) redirect("/");
  if (intent.status === "succeeded") await confirmBooking(booking.id);
  redirect(`/booking/${booking.id}?t=${booking.accessToken}`);
}
