import Link from "next/link";
import AdminNav from "@/components/AdminNav";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { business, formatPrice, getService } from "@/config/business";
import { ADMIN_COOKIE, requireAdmin } from "@/lib/admin";
import { STATUS_LABELS } from "@/lib/booking";
import { db } from "@/lib/db";
import { deleteEvent } from "@/lib/google";
import { formatWhen } from "@/lib/time";

export const dynamic = "force-dynamic";
const OWNER_STATUSES = ["CONFIRMED", "IN_PROGRESS", "READY_FOR_PICKUP", "COMPLETED", "CANCELLED"];

async function postStatus(form: FormData) {
  "use server";
  await requireAdmin();
  const bookingId = String(form.get("bookingId"));
  const status = String(form.get("status"));
  const message = String(form.get("message") ?? "").trim() || null;
  if (!OWNER_STATUSES.includes(status)) return;
  const booking = await db.booking.update({ where: { id: bookingId }, data: { status } });
  await db.statusUpdate.create({ data: { bookingId, status, message } });
  if (status === "CANCELLED" && booking.googleEventId) {
    await deleteEvent(booking.googleEventId);
    await db.booking.update({ where: { id: bookingId }, data: { googleEventId: null } });
  }
  revalidatePath("/admin");
}

async function markPaid(form: FormData) {
  "use server";
  await requireAdmin();
  const bookingId = String(form.get("bookingId"));
  const tipCents = Math.min(50000, Math.max(0, Math.round(Number(form.get("tip") || 0) * 100)));
  await db.booking.update({ where: { id: bookingId }, data: { paidAt: new Date(), tipCents } });
  await db.statusUpdate.create({ data: { bookingId, status: (await db.booking.findUniqueOrThrow({ where: { id: bookingId } })).status, message: "Payment received. Thank you!" } });
  revalidatePath("/admin");
}

async function logout() {
  "use server";
  cookies().delete(ADMIN_COOKIE);
  redirect("/admin/login");
}

export default async function Admin({ searchParams }: { searchParams: { show?: string } }) {
  await requireAdmin();
  const showPast = searchParams.show === "all";
  const bookings = await db.booking.findMany({
    where: { status: { not: "PENDING_PAYMENT" }, ...(showPast ? {} : { end: { gte: new Date(Date.now() - 86400000) } }) },
    orderBy: { start: showPast ? "desc" : "asc" },
    take: 200,
  });
  const site = (process.env.SITE_URL || process.env.RENDER_EXTERNAL_URL) ?? "";

  return (
    <>
      <div className="row"><h1 style={{ marginRight: "auto" }}>Owner dashboard</h1><form action={logout}><button className="btn secondary">Log out</button></form></div>
      <AdminNav active="/admin" />

      <p className="muted">
        {showPast ? <Link href="/admin">Show upcoming only</Link> : <Link href="/admin?show=all">Show past bookings too</Link>}
        {" · "}Cancelling here removes the calendar event. Refunds are issued from your Stripe dashboard.
      </p>
      {bookings.length === 0 && <p className="muted">No bookings yet.</p>}
      <div style={{ display: "grid", gap: 12 }}>
        {bookings.map((b) => (
          <div className="card" key={b.id}>
            <div className="row">
              <strong style={{ marginRight: "auto", minWidth: 0 }}>{getService(b.serviceId)?.name ?? b.serviceId} · {formatWhen(b.start, business.timeZone)}</strong>
              <span className="badge">{b.paidAt ? "Paid" : b.paymentMethod === "AT_PICKUP" ? `Due at pickup: ${formatPrice(b.priceCents + b.tipCents)}` : "Unpaid"}</span>
              <span className="badge">{STATUS_LABELS[b.status] ?? b.status}</span>
            </div>
            <p className="muted" style={{ margin: "4px 0" }}>
              {b.customerName} · <a href={`mailto:${b.customerEmail}`}>{b.customerEmail}</a>{b.customerPhone && ` · ${b.customerPhone}`}
            </p>
            <p style={{ margin: "4px 0" }}>{formatPrice(b.priceCents)} service{b.tipCents > 0 && ` + ${formatPrice(b.tipCents)} tip${b.paidAt ? "" : " (planned)"}`}</p>
            {b.notes && <p style={{ margin: "4px 0", whiteSpace: "pre-wrap" }}>“{b.notes}”</p>}
            <p style={{ margin: "4px 0", fontSize: 14 }}>Customer status page: <a href={`${site}/booking/${b.id}?t=${b.accessToken}`}>{`/booking/${b.id}`}</a></p>
            {!b.paidAt && b.status !== "CANCELLED" && (
              <form action={markPaid} className="row paybox">
                <input type="hidden" name="bookingId" value={b.id} />
                <span>Collecting at pickup? Tip received $</span>
                <input name="tip" type="number" min="0" step="0.01" defaultValue={(b.tipCents / 100).toFixed(2)} aria-label="Tip received in dollars" style={{ width: 90 }} />
                <button className="btn secondary">Mark paid</button>
              </form>
            )}
            <form action={postStatus} className="row" style={{ marginTop: 8 }}>
              <input type="hidden" name="bookingId" value={b.id} />
              <select name="status" defaultValue={b.status} style={{ width: "auto" }}>
                {OWNER_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
              </select>
              <input name="message" placeholder="Message to the customer (optional)" style={{ flex: 1, minWidth: 200 }} />
              <button className="btn">Post update</button>
            </form>
          </div>
        ))}
      </div>

    </>
  );
}
