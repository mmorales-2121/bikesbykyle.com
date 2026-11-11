import { getService } from "@/config/business";
import { db } from "./db";
import { createEvent } from "./google";

export const STATUS_LABELS: Record<string, string> = {
  PENDING_PAYMENT: "Awaiting payment",
  CONFIRMED: "Confirmed",
  IN_PROGRESS: "In progress",
  READY_FOR_PICKUP: "Ready for pickup",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

/** Called once an online payment is done (webhook or success page), or right away for pay-at-pickup bookings. */
export async function confirmBooking(bookingId: string, opts: { paid: boolean } = { paid: true }) {
  // Only one caller wins the PENDING -> CONFIRMED switch, so the calendar event is made once.
  const { count } = await db.booking.updateMany({ where: { id: bookingId, status: "PENDING_PAYMENT" }, data: { status: "CONFIRMED", ...(opts.paid ? { paidAt: new Date() } : {}) } });
  if (count === 0) return;
  const booking = await db.booking.findUniqueOrThrow({ where: { id: bookingId } });
  await db.statusUpdate.create({ data: { bookingId, status: "CONFIRMED", message: opts.paid ? "Payment received. Your appointment is confirmed." : "Your appointment is confirmed. You'll pay when you pick up your bike." } });
  const service = getService(booking.serviceId);
  try {
    const eventId = await createEvent({
      summary: `${service?.name ?? booking.serviceId} with ${booking.customerName}`,
      description: [`Email: ${booking.customerEmail}`, booking.customerPhone && `Phone: ${booking.customerPhone}`, booking.notes && `Notes: ${booking.notes}`, opts.paid ? "Paid online" : "Pay at pickup"]
        .filter(Boolean).join("\n"),
      start: booking.start,
      end: booking.end,
      attendeeEmail: booking.customerEmail,
    });
    if (eventId) await db.booking.update({ where: { id: bookingId }, data: { googleEventId: eventId } });
  } catch (err) {
    console.error("Google Calendar event failed for booking", bookingId, err);
  }
}
