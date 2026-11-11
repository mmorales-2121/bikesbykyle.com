import Link from "next/link";
import AdminNav from "@/components/AdminNav";
import { formatPrice } from "@/config/business";
import { requireAdmin } from "@/lib/admin";
import { getMetrics, STRIPE_FIXED_CENTS, STRIPE_PERCENT } from "@/lib/metrics";

export const dynamic = "force-dynamic";

const RANGES = [
  { key: "30", label: "Last 30 days", days: 30 },
  { key: "90", label: "Last 90 days", days: 90 },
  { key: "365", label: "Last 12 months", days: 365 },
  { key: "all", label: "All time", days: null },
];

export default async function Metrics(props: { searchParams: Promise<{ range?: string }> }) {
  const searchParams = await props.searchParams;
  await requireAdmin();
  const range = RANGES.find((r) => r.key === searchParams.range) ?? RANGES[0];
  const m = await getMetrics(range.days);
  const maxRev = Math.max(1, ...m.months.map((x) => x.revenue));
  const maxSvc = Math.max(1, ...m.services.map((s) => s.bookings));

  return (
    <>
      <h1>Owner dashboard</h1>
      <AdminNav active="/admin/metrics" />
      <div className="row" style={{ marginTop: 16 }}>
        {RANGES.map((r) => <Link key={r.key} href={`/admin/metrics?range=${r.key}`} className={`chip ${r.key === range.key ? "on" : ""}`}>{r.label}</Link>)}
      </div>

      <div className="kpis">
        <div className="kpi"><span>Revenue collected</span><b>{formatPrice(m.revenue)}</b><small>incl. {formatPrice(m.tips)} tips</small></div>
        <div className="kpi"><span>After Stripe fees</span><b>{formatPrice(m.net)}</b><small>{formatPrice(m.fees)} est. fees</small></div>
        <div className="kpi"><span>Bookings</span><b>{m.bookings}</b><small>{m.cancelled} cancelled</small></div>
        <div className="kpi"><span>Average ticket</span><b>{formatPrice(m.avgTicket)}</b><small>{Math.round(m.onlineShare * 100)}% paid online</small></div>
        <div className="kpi"><span>Due at pickup</span><b>{formatPrice(m.unpaid)}</b><small>not collected yet</small></div>
      </div>
      <p className="muted" style={{ fontSize: 13 }}>
        Profit here is revenue minus estimated Stripe fees ({(STRIPE_PERCENT * 100).toFixed(1)}% + {STRIPE_FIXED_CENTS}¢ per online payment). It doesn't subtract parts or other costs.
      </p>

      <h2>Monthly revenue</h2>
      <p className="muted" style={{ marginTop: -4, fontSize: 14 }}>Last 12 months, paid bookings. Hover a bar for the booking count.</p>
      <div className="bars" role="img" aria-label="Monthly revenue, last 12 months">
        {m.months.map((x) => (
          <div className="bar" key={x.key} title={`${x.label}: ${formatPrice(x.revenue)} from ${x.bookings} bookings`}>
            <div className="fill-wrap"><div className="fill" style={{ height: `${(x.revenue / maxRev) * 100}%` }} /></div>
            <small>{x.label}</small>
          </div>
        ))}
      </div>
      <details style={{ marginTop: 8 }}>
        <summary className="muted" style={{ cursor: "pointer" }}>Show as table</summary>
        <table>
          <thead><tr><th>Month</th><th>Bookings</th><th>Revenue</th></tr></thead>
          <tbody>{m.months.map((x) => <tr key={x.key}><td>{x.label}</td><td>{x.bookings}</td><td>{formatPrice(x.revenue)}</td></tr>)}</tbody>
        </table>
      </details>

      <h2>Most booked services</h2>
      {m.services.length === 0 ? <p className="muted">No bookings in this range yet.</p> : (
        <table>
          <thead><tr><th>Service</th><th style={{ width: "40%" }}>Bookings</th><th>Revenue</th></tr></thead>
          <tbody>
            {m.services.map((s) => (
              <tr key={s.id}>
                <td>{s.name}</td>
                <td><div className="hbar"><div style={{ width: `${(s.bookings / maxSvc) * 100}%` }} /><span>{s.bookings}</span></div></td>
                <td>{formatPrice(s.revenue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
