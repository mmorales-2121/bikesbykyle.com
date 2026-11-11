// Small time-zone helpers built on Intl, so no extra date library is needed.

function offsetMinutes(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return (asUtc - date.getTime()) / 60000;
}

/** "2026-11-12" + "09:30" in the business time zone -> UTC Date */
export function zonedToUtc(day: string, time: string, timeZone: string) {
  const [y, m, d] = day.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const guess = new Date(Date.UTC(y, m - 1, d, hh, mm));
  const first = new Date(guess.getTime() - offsetMinutes(guess, timeZone) * 60000);
  // Second pass handles days where daylight saving changes.
  return new Date(guess.getTime() - offsetMinutes(first, timeZone) * 60000);
}

/** Weekday (0-6) of a "YYYY-MM-DD" calendar date. */
export function weekday(day: string) {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Today's date as "YYYY-MM-DD" in the given zone. */
export function todayIn(timeZone: string, plusDays = 0) {
  const d = new Date(Date.now() + plusDays * 86400000);
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

export function formatInZone(date: Date, timeZone: string, opts: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-US", { timeZone, ...opts }).format(date);
}

export const formatWhen = (date: Date, timeZone: string) =>
  formatInZone(date, timeZone, { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" });
