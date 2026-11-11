import { business, Service } from "@/config/business";
import { db } from "./db";
import { getBusy } from "./google";
import { isAway } from "./timeoff";
import { todayIn, weekday, zonedToUtc } from "./time";

// Unpaid bookings hold their slot for this long (the payment page shows a countdown).
export const HOLD_MINUTES = 30;

const overlaps = (a: { start: Date; end: Date }, b: { start: Date; end: Date }) => a.start < b.end && b.start < a.end;

export function isBookableDay(day: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  return day >= todayIn(business.timeZone) && day <= todayIn(business.timeZone, business.maxDaysAhead) && Boolean(business.hours[weekday(day)]);
}

async function blockedRanges(from: Date, to: Date) {
  const holdCutoff = new Date(Date.now() - HOLD_MINUTES * 60000);
  const bookings = await db.booking.findMany({
    where: {
      start: { lt: to },
      end: { gt: from },
      OR: [
        { status: { in: ["CONFIRMED", "IN_PROGRESS", "READY_FOR_PICKUP", "COMPLETED"] } },
        { status: "PENDING_PAYMENT", createdAt: { gt: holdCutoff } },
      ],
    },
    select: { start: true, end: true },
  });
  // Confirmed bookings are also in Google Calendar; checking both keeps things right if sync is off.
  return [...bookings, ...(await getBusy(from, to))];
}

/** Open start times (UTC) for a service on a given day in the business time zone. */
export async function getSlots(service: Service, day: string) {
  if (!isBookableDay(day) || (await isAway(day))) return [];
  const hours = business.hours[weekday(day)];
  const open = zonedToUtc(day, hours.open, business.timeZone);
  const close = zonedToUtc(day, hours.close, business.timeZone);
  const blocked = await blockedRanges(open, close);
  const earliest = Date.now() + business.minNoticeHours * 3600000;

  const slots: Date[] = [];
  for (let t = open.getTime(); t + service.durationMinutes * 60000 <= close.getTime(); t += business.slotStepMinutes * 60000) {
    const slot = { start: new Date(t), end: new Date(t + service.durationMinutes * 60000) };
    if (t < earliest) continue;
    if (blocked.some((b) => overlaps(slot, b))) continue;
    slots.push(slot.start);
  }
  return slots;
}

export async function isSlotOpen(service: Service, start: Date) {
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: business.timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(start);
  return (await getSlots(service, day)).some((s) => s.getTime() === start.getTime());
}
