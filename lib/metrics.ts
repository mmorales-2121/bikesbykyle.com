import { business, getService } from "@/config/business";
import { db } from "./db";

// Stripe's standard US card rate. Change if your Stripe pricing differs.
export const STRIPE_PERCENT = 0.029;
export const STRIPE_FIXED_CENTS = 30;

type B = { priceCents: number; tipCents: number; paymentMethod: string; paidAt: Date | null };
export const totalOf = (b: B) => b.priceCents + b.tipCents;
export const feeOf = (b: B) => (b.paidAt && b.paymentMethod === "ONLINE" ? Math.round(totalOf(b) * STRIPE_PERCENT) + STRIPE_FIXED_CENTS : 0);

const monthKey = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: business.timeZone, year: "numeric", month: "2-digit" }).format(d).slice(0, 7);

export async function getMetrics(sinceDays: number | null) {
  const since = sinceDays ? new Date(Date.now() - sinceDays * 86400000) : new Date(0);
  const all = await db.booking.findMany({ where: { status: { not: "PENDING_PAYMENT" }, start: { gte: since } }, orderBy: { start: "asc" } });
  const live = all.filter((b) => b.status !== "CANCELLED");
  const paid = live.filter((b) => b.paidAt);

  const revenue = paid.reduce((s, b) => s + totalOf(b), 0);
  const tips = paid.reduce((s, b) => s + b.tipCents, 0);
  const fees = paid.reduce((s, b) => s + feeOf(b), 0);
  const unpaid = live.filter((b) => !b.paidAt).reduce((s, b) => s + totalOf(b), 0);

  // Last 12 months, oldest first, including empty months.
  const months: { key: string; label: string; bookings: number; revenue: number }[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 15);
    months.push({ key: monthKey(d), label: d.toLocaleDateString("en-US", { month: "short", year: "2-digit" }), bookings: 0, revenue: 0 });
  }
  const yearAgo = await db.booking.findMany({ where: { status: { notIn: ["PENDING_PAYMENT", "CANCELLED"] }, start: { gte: new Date(now.getFullYear(), now.getMonth() - 11, 1) } } });
  for (const b of yearAgo) {
    const m = months.find((x) => x.key === monthKey(b.start));
    if (!m) continue;
    m.bookings++;
    if (b.paidAt) m.revenue += totalOf(b);
  }

  const bySvc = new Map<string, { id: string; name: string; bookings: number; revenue: number }>();
  for (const b of live) {
    const e = bySvc.get(b.serviceId) ?? { id: b.serviceId, name: getService(b.serviceId)?.name ?? b.serviceId, bookings: 0, revenue: 0 };
    e.bookings++;
    if (b.paidAt) e.revenue += totalOf(b);
    bySvc.set(b.serviceId, e);
  }
  const services = [...bySvc.values()].sort((a, b) => b.bookings - a.bookings || b.revenue - a.revenue);

  const online = live.filter((b) => b.paymentMethod === "ONLINE").length;
  return {
    revenue, tips, fees, net: revenue - fees, unpaid,
    bookings: live.length, cancelled: all.length - live.length,
    avgTicket: paid.length ? Math.round(revenue / paid.length) : 0,
    onlineShare: live.length ? online / live.length : 0,
    months, services,
  };
}

/** One row per customer email: account holders plus guests. */
export async function getCustomerRows(q?: string) {
  const [accounts, bookings] = await Promise.all([
    db.customer.findMany({ where: { emailVerifiedAt: { not: null } } }),
    db.booking.findMany({ where: { status: { not: "PENDING_PAYMENT" } }, orderBy: { start: "desc" } }),
  ]);
  const rows = new Map<string, { email: string; name: string; phone: string; bikeNotes: string; hasAccount: boolean; joined: Date | null; bookings: number; spent: number; last: Date | null; lastService: string }>();
  for (const a of accounts) rows.set(a.email, { email: a.email, name: a.name, phone: a.phone ?? "", bikeNotes: a.bikeNotes ?? "", hasAccount: true, joined: a.createdAt, bookings: 0, spent: 0, last: null, lastService: "" });
  for (const b of bookings) {
    const key = b.customerEmail.toLowerCase();
    const r = rows.get(key) ?? { email: key, name: b.customerName, phone: b.customerPhone ?? "", bikeNotes: "", hasAccount: false, joined: null, bookings: 0, spent: 0, last: null, lastService: "" };
    if (b.status !== "CANCELLED") r.bookings++;
    if (b.paidAt && b.status !== "CANCELLED") r.spent += totalOf(b);
    if (!r.last) { r.last = b.start; r.lastService = getService(b.serviceId)?.name ?? b.serviceId; }
    if (!r.phone && b.customerPhone) r.phone = b.customerPhone;
    rows.set(key, r);
  }
  let list = [...rows.values()].sort((a, b) => (b.last?.getTime() ?? 0) - (a.last?.getTime() ?? 0));
  if (q) { const t = q.toLowerCase(); list = list.filter((r) => [r.name, r.email, r.phone, r.bikeNotes].some((v) => v.toLowerCase().includes(t))); }
  return list;
}
