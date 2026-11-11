import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import AdminNav from "@/components/AdminNav";
import { business, getService } from "@/config/business";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { formatInZone, todayIn, weekday, zonedToUtc } from "@/lib/time";
import { addDays, awayDays, dayOf, isDay } from "@/lib/timeoff";

export const dynamic = "force-dynamic";

const ACTIVE = ["CONFIRMED", "IN_PROGRESS", "READY_FOR_PICKUP"];
const MAX_RANGE_DAYS = 120;

async function toggleDay(form: FormData) {
  "use server";
  await requireAdmin();
  const date = String(form.get("date") ?? "");
  if (!isDay(date) || date < todayIn(business.timeZone)) return;
  const existing = await db.timeOff.findUnique({ where: { date } });
  if (existing) await db.timeOff.delete({ where: { date } });
  else await db.timeOff.create({ data: { date } });
  revalidatePath("/admin/schedule");
}

async function addRange(form: FormData) {
  "use server";
  await requireAdmin();
  const from = String(form.get("from") ?? ""), to = String(form.get("to") ?? "") || from;
  const note = String(form.get("note") ?? "").trim().slice(0, 200) || null;
  const today = todayIn(business.timeZone);
  if (!isDay(from) || !isDay(to) || to < from) redirect("/admin/schedule?range=bad");
  if (from < today) redirect("/admin/schedule?range=past");
  let days = 0;
  for (let d = from; d <= to; d = addDays(d, 1)) {
    if (++days > MAX_RANGE_DAYS) redirect("/admin/schedule?range=long");
    await db.timeOff.upsert({ where: { date: d }, create: { date: d, note }, update: note ? { note } : {} });
  }
  redirect(`/admin/schedule?m=${from.slice(0, 7)}&range=ok&n=${days}`);
}

async function removeDay(form: FormData) {
  "use server";
  await requireAdmin();
  await db.timeOff.delete({ where: { date: String(form.get("date") ?? "") } }).catch(() => {});
  revalidatePath("/admin/schedule");
}

const RANGE: Record<string, [string, string]> = {
  bad: ["error", "Pick a start date, and an end date on or after it."],
  past: ["error", "Pick dates from today onward."],
  long: ["error", `That's more than ${MAX_RANGE_DAYS} days. Pick a shorter range.`],
};

export default async function Schedule(props: { searchParams: Promise<{ m?: string; range?: string; n?: string }> }) {
  const sp = await props.searchParams;
  await requireAdmin();
  const tz = business.timeZone;
  const today = todayIn(tz);
  const thisMonth = today.slice(0, 7);
  const month = sp.m && /^\d{4}-\d{2}$/.test(sp.m) && sp.m >= thisMonth ? sp.m : thisMonth;
  const [y, mo] = month.split("-").map(Number);
  const first = `${month}-01`;
  const daysInMonth = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  const last = `${month}-${String(daysInMonth).padStart(2, "0")}`;
  const prev = mo === 1 ? `${y - 1}-12` : `${y}-${String(mo - 1).padStart(2, "0")}`;
  const next = mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, "0")}`;

  const [monthAway, upcoming, monthBookings, futureBookings] = await Promise.all([
    awayDays(first, last),
    awayDays(today, "9999-12-31"),
    db.booking.findMany({ where: { status: { in: ACTIVE }, start: { gte: zonedToUtc(first, "00:00", tz), lt: zonedToUtc(addDays(last, 1), "00:00", tz) } }, select: { start: true } }),
    db.booking.findMany({ where: { status: { in: ACTIVE }, start: { gte: zonedToUtc(today, "00:00", tz) } }, select: { id: true, start: true, customerName: true, serviceId: true }, orderBy: { start: "asc" } }),
  ]);
  const awaySet = new Set(monthAway.map((a) => a.date));
  const booked = new Map<string, number>();
  for (const b of monthBookings) booked.set(dayOf(b.start), (booked.get(dayOf(b.start)) ?? 0) + 1);
  const upcomingSet = new Set(upcoming.map((a) => a.date));
  const conflicts = futureBookings.filter((b) => upcomingSet.has(dayOf(b.start)));
  const bookingsOn = (day: string) => futureBookings.filter((b) => dayOf(b.start) === day).length;

  const cells: (string | null)[] = [...Array(weekday(first)).fill(null)];
  for (let d = 1; d <= daysInMonth; d++) cells.push(`${month}-${String(d).padStart(2, "0")}`);
  const monthName = formatInZone(new Date(Date.UTC(y, mo - 1, 15)), "UTC", { month: "long", year: "numeric" });
  const nice = (day: string) => formatInZone(new Date(`${day}T12:00:00Z`), "UTC", { weekday: "short", month: "short", day: "numeric" });
  const range = sp.range === "ok" ? (["ok", `Marked ${sp.n ?? ""} day${sp.n === "1" ? "" : "s"} as away.`] as [string, string]) : sp.range ? RANGE[sp.range] : undefined;

  return (
    <>
      <h1>Owner dashboard</h1>
      <AdminNav active="/admin/schedule" />

      <p className="muted">Tap a day to mark yourself away. Customers can't book days you're away. Tap it again to reopen it.</p>

      {conflicts.length > 0 && (
        <div className="card" style={{ borderColor: "#dc2626", marginBottom: 16 }}>
          <strong className="error">You have {conflicts.length} booking{conflicts.length === 1 ? "" : "s"} on days you're away.</strong>
          <p className="muted" style={{ margin: "4px 0 8px" }}>These stay booked. Contact the customer, or cancel them from the Bookings tab.</p>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {conflicts.map((b) => (
              <li key={b.id}>{formatInZone(b.start, tz, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}: {b.customerName}, {getService(b.serviceId)?.name ?? b.serviceId}</li>
            ))}
          </ul>
          <p style={{ marginBottom: 0 }}><Link href="/admin">Go to Bookings</Link></p>
        </div>
      )}

      <div className="row" style={{ justifyContent: "space-between", margin: "8px 0 12px" }}>
        {month > thisMonth ? <Link className="btn secondary" href={`/admin/schedule?m=${prev}`} aria-label="Previous month">‹ Prev</Link> : <span className="btn secondary" aria-disabled="true" style={{ opacity: 0.35 }}>‹ Prev</span>}
        <h2 style={{ margin: 0, border: 0, padding: 0 }}>{monthName}</h2>
        <Link className="btn secondary" href={`/admin/schedule?m=${next}`} aria-label="Next month">Next ›</Link>
      </div>

      <div className="cal" role="grid" aria-label={`Days off in ${monthName}`}>
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <div key={d} className="wd">{d}</div>)}
        {cells.map((day, i) => {
          if (!day) return <div key={`blank-${i}`} />;
          const away = awaySet.has(day), past = day < today, closed = !business.hours[weekday(day) as keyof typeof business.hours];
          const n = booked.get(day) ?? 0;
          return (
            <form key={day} action={toggleDay}>
              <input type="hidden" name="date" value={day} />
              <button className={`calday${away ? " away" : ""}${day === today ? " today" : ""}`} disabled={past} aria-pressed={away} title={away ? "Away. Tap to reopen." : "Open. Tap to mark away."}>
                <span className="num">{Number(day.slice(8))}</span>
                {away ? <span className="tag">Away</span> : closed ? <span className="tag muted">Closed</span> : null}
                {n > 0 && <span className="cnt">{n} booked</span>}
              </button>
            </form>
          );
        })}
      </div>

      <h2>Block several days</h2>
      <form action={addRange} className="card" style={{ maxWidth: 560 }}>
        <div className="row">
          <div style={{ flex: 1, minWidth: 140 }}><label htmlFor="from">First day away</label><input id="from" name="from" type="date" min={today} required /></div>
          <div style={{ flex: 1, minWidth: 140 }}><label htmlFor="to">Last day away</label><input id="to" name="to" type="date" min={today} /></div>
        </div>
        <label htmlFor="note">Note (optional, only admins see it)</label>
        <input id="note" name="note" maxLength={200} placeholder="e.g. Vacation" />
        {range && <p className={range[0]}>{range[1]}</p>}
        <p style={{ marginBottom: 0 }}><button className="btn">Mark away</button></p>
      </form>

      <h2>Upcoming time off</h2>
      {upcoming.length === 0 ? (
        <p className="muted">No days off scheduled.</p>
      ) : (
        <table>
          <tbody>
            {upcoming.map((a) => (
              <tr key={a.id}>
                <td style={{ whiteSpace: "nowrap" }}><strong>{nice(a.date)}</strong></td>
                <td className="muted">{a.note ?? ""}{bookingsOn(a.date) > 0 && <span className="error">{a.note ? " · " : ""}{bookingsOn(a.date)} booked</span>}</td>
                <td style={{ width: 100 }}><form action={removeDay}><input type="hidden" name="date" value={a.date} /><button className="btn secondary">Remove</button></form></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
