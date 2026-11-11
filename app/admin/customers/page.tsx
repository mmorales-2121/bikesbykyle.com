import AdminNav from "@/components/AdminNav";
import { business, formatPrice } from "@/config/business";
import { requireAdmin } from "@/lib/admin";
import { getCustomerRows } from "@/lib/metrics";
import { formatInZone } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function Customers(props: { searchParams: Promise<{ q?: string }> }) {
  const searchParams = await props.searchParams;
  await requireAdmin();
  const rows = await getCustomerRows(searchParams.q);
  const accounts = rows.filter((r) => r.hasAccount).length;
  const repeat = rows.filter((r) => r.bookings > 1).length;
  const day = (d: Date | null) => (d ? formatInZone(d, business.timeZone, { month: "short", day: "numeric", year: "numeric" }) : "—");

  return (
    <>
      <h1>Owner dashboard</h1>
      <AdminNav active="/admin/customers" />
      <form className="row" style={{ marginTop: 16 }}>
        <input name="q" defaultValue={searchParams.q} placeholder="Search name, email, phone or bike" style={{ flex: 1, minWidth: 200 }} aria-label="Search customers" />
        <button className="btn secondary">Search</button>
        <a className="btn secondary" href="/api/admin/customers.csv">Download CSV</a>
      </form>
      <p className="muted">{rows.length} customers · {accounts} with accounts · {repeat} repeat customers</p>
      <div style={{ overflowX: "auto" }}>
        <table>
          <thead><tr><th>Customer</th><th>Contact</th><th>Bike</th><th>Bookings</th><th>Spent</th><th>Last visit</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.email}>
                <td><strong>{r.name}</strong><div className="muted" style={{ fontSize: 13 }}>{r.hasAccount ? `Account since ${day(r.joined)}` : "Guest"}</div></td>
                <td><a href={`mailto:${r.email}`}>{r.email}</a><div className="muted">{r.phone}</div></td>
                <td style={{ maxWidth: 220 }}>{r.bikeNotes || <span className="muted">—</span>}</td>
                <td>{r.bookings}</td>
                <td>{formatPrice(r.spent)}</td>
                <td>{day(r.last)}<div className="muted" style={{ fontSize: 13 }}>{r.lastService}</div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
