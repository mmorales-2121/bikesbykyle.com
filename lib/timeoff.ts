import { business } from "@/config/business";
import { db } from "./db";

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** "YYYY-MM-DD" plus n days. */
export function addDays(day: string, n: number) {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** The shop-time-zone date ("YYYY-MM-DD") of a moment. */
export const dayOf = (date: Date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: business.timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);

export const isDay = (s: string) => DAY.test(s) && !isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().startsWith(s);

/** True when the owner marked this day as away, so nobody can book it. */
export async function isAway(day: string) {
  return Boolean(await db.timeOff.findUnique({ where: { date: day } }));
}

/** Away days between two dates, inclusive. */
export async function awayDays(from: string, to: string) {
  return db.timeOff.findMany({ where: { date: { gte: from, lte: to } }, orderBy: { date: "asc" } });
}
