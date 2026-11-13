import { totalOf } from "@/lib/total";
import { notFound } from "next/navigation";
import { business, formatPrice, getService } from "@/config/business";
import { STATUS_LABELS } from "@/lib/booking";
import { db } from "@/lib/db";
import { formatWhen } from "@/lib/time";

export const dynamic = "force-dynamic";

// Private page per booking. The link (with its secret token) is the customer's access.
export default async function BookingStatus(props: { params: Promise<{ id: string }>; searchParams: Promise<{ t?: string }> }) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const booking = await db.booking.findUnique({ where: { id: params.id }, include: { updates: { orderBy: { createdAt: "desc" } } } });
  if (!booking || !searchParams.t || booking.accessToken !== searchParams.t) notFound();
  const service = getService(booking.serviceId);
  return (
    <>
      <h1>Your appointment</h1>
      <p className="muted">Bookmark this page. It shows the latest status from {business.name}.</p>
      <div className="card">
        <p style={{ margin: 0 }}><span className="badge">{STATUS_LABELS[booking.status] ?? booking.status}</span></p>
        <h3 style={{ marginTop: 12 }}>{service?.name ?? booking.serviceId}</h3>
        <p style={{ margin: 0 }}>{formatWhen(booking.start, business.timeZone)}</p>
        {service && <p className="muted" style={{ margin: 0 }}>{formatPrice(totalOf(booking))}{booking.tipCents > 0 && ` (incl. ${formatPrice(booking.tipCents)} tip)`}{booking.discountCents > 0 && ` · ${booking.promoCode ?? "Promo"} saved ${formatPrice(booking.discountCents)}`} · {booking.paidAt ? "Paid" : booking.paymentMethod === "AT_PICKUP" ? "Pay at pickup" : "Not paid yet"}</p>}
      </div>
      <h2>Updates</h2>
      {booking.updates.length === 0 ? <p className="muted">No updates yet.</p> : (
        <ul className="timeline">
          {booking.updates.map((u) => (
            <li key={u.id}>
              <strong>{STATUS_LABELS[u.status] ?? u.status}</strong>{" "}
              <span className="muted">· {formatWhen(u.createdAt, business.timeZone)}</span>
              {u.message && <div style={{ whiteSpace: "pre-wrap" }}>{u.message}</div>}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
