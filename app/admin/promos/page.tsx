import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import AdminNav from "@/components/AdminNav";
import { business, formatPrice } from "@/config/business";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { CODE_PATTERN, countedUse, normalizeCode, promoLabel } from "@/lib/promo";
import { formatInZone, todayIn } from "@/lib/time";

export const dynamic = "force-dynamic";

async function createPromo(form: FormData) {
  "use server";
  const admin = await requireAdmin();
  const code = normalizeCode(String(form.get("code") ?? ""));
  const kind = form.get("kind") === "AMOUNT" ? "AMOUNT" : "PERCENT";
  const raw = Number(form.get("value"));
  const value = kind === "PERCENT" ? Math.round(raw) : Math.round(raw * 100);
  const expiresOn = String(form.get("expiresOn") ?? "").trim() || null;
  const maxUsesRaw = String(form.get("maxUses") ?? "").trim();
  const maxUses = maxUsesRaw ? Math.round(Number(maxUsesRaw)) : null;
  const back = (e: string): never => redirect(`/admin/promos?error=${e}`);
  if (!CODE_PATTERN.test(code)) back("code");
  if (!Number.isFinite(raw) || value < 1 || (kind === "PERCENT" && value > 100) || (kind === "AMOUNT" && value > 100000)) back("value");
  if (expiresOn && (!/^\d{4}-\d{2}-\d{2}$/.test(expiresOn) || expiresOn < todayIn(business.timeZone))) back("expires");
  if (maxUses != null && (!Number.isFinite(maxUses) || maxUses < 1)) back("uses");
  if (await db.promoCode.findUnique({ where: { code } })) back("taken");
  await db.promoCode.create({
    data: { code, kind, value, expiresOn, maxUses, onePerCustomer: form.get("onePerCustomer") === "on", note: String(form.get("note") ?? "").trim().slice(0, 200) || null, createdBy: admin.email },
  });
  redirect(`/admin/promos?created=${code}`);
}

async function toggleActive(form: FormData) {
  "use server";
  await requireAdmin();
  const promo = await db.promoCode.findUnique({ where: { id: String(form.get("id")) } });
  if (promo) await db.promoCode.update({ where: { id: promo.id }, data: { active: !promo.active } });
  revalidatePath("/admin/promos");
}

async function deletePromo(form: FormData) {
  "use server";
  await requireAdmin();
  const id = String(form.get("id"));
  // Codes that were used stay for the record; pause them instead.
  if ((await db.booking.count({ where: { promoCodeId: id } })) === 0) await db.promoCode.delete({ where: { id } }).catch(() => {});
  revalidatePath("/admin/promos");
}

const ERRORS: Record<string, string> = {
  code: "Codes are 3 to 24 letters, numbers, dashes or underscores, like SPRING20.",
  value: "Enter a percent from 1 to 100, or a dollar amount from $0.01 to $1,000.",
  expires: "Pick a last day that's today or later, or leave it empty.",
  uses: "Total uses must be 1 or more, or leave it empty for unlimited.",
  taken: "That code already exists. Pick another.",
};

export default async function Promos(props: { searchParams: Promise<{ error?: string; created?: string }> }) {
  const sp = await props.searchParams;
  await requireAdmin();
  const today = todayIn(business.timeZone);
  const [promos, stats, anyUse] = await Promise.all([
    db.promoCode.findMany({ orderBy: [{ active: "desc" }, { createdAt: "desc" }] }),
    db.booking.groupBy({ by: ["promoCodeId"], where: { promoCodeId: { not: null }, ...countedUse() }, _count: { _all: true }, _sum: { discountCents: true } }),
    db.booking.groupBy({ by: ["promoCodeId"], where: { promoCodeId: { not: null } }, _count: { _all: true } }),
  ]);
  const statOf = (id: string) => stats.find((s) => s.promoCodeId === id);
  const everUsed = (id: string) => anyUse.some((s) => s.promoCodeId === id);
  const nice = (day: string) => formatInZone(new Date(`${day}T12:00:00Z`), "UTC", { month: "short", day: "numeric", year: "numeric" });

  return (
    <>
      <h1>Owner dashboard</h1>
      <AdminNav active="/admin/promos" />
      <p className="muted">Customers type a code when booking, for card payments or pay at pickup. The discount comes off the service price (not the tip).</p>

      <h2>Create a promo code</h2>
      <form action={createPromo} className="card" style={{ maxWidth: 640 }}>
        <div className="row">
          <div style={{ flex: 2, minWidth: 180 }}>
            <label htmlFor="code">Code</label>
            <input id="code" name="code" required placeholder="e.g. SPRING20" maxLength={24} autoComplete="off" style={{ textTransform: "uppercase" }} />
          </div>
          <div style={{ flex: 1, minWidth: 140 }}>
            <label htmlFor="kind">Type</label>
            <select id="kind" name="kind" defaultValue="PERCENT">
              <option value="PERCENT">Percent (%)</option>
              <option value="AMOUNT">Dollars off ($)</option>
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 110 }}>
            <label htmlFor="value">Amount</label>
            <input id="value" name="value" type="number" required min="0.01" step="0.01" inputMode="decimal" placeholder="20" />
          </div>
        </div>
        <div className="row">
          <div style={{ flex: 1, minWidth: 160 }}>
            <label htmlFor="expiresOn">Last day it works (optional)</label>
            <input id="expiresOn" name="expiresOn" type="date" min={today} />
          </div>
          <div style={{ flex: 1, minWidth: 160 }}>
            <label htmlFor="maxUses">Total uses (optional)</label>
            <input id="maxUses" name="maxUses" type="number" min="1" step="1" placeholder="Unlimited" />
          </div>
        </div>
        <label className="notify" style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="checkbox" name="onePerCustomer" style={{ width: "auto" }} /> One use per customer email
        </label>
        <label htmlFor="note">Note (optional, only admins see it)</label>
        <input id="note" name="note" maxLength={200} placeholder="e.g. Instagram giveaway" />
        {sp.error && <p className="error">{ERRORS[sp.error] ?? "Something went wrong."}</p>}
        {sp.created && <p className="ok">Created {sp.created}. Customers can use it now.</p>}
        <p style={{ marginBottom: 0 }}><button className="btn">Create code</button></p>
      </form>

      <h2>Your codes</h2>
      {promos.length === 0 ? (
        <p className="muted">No promo codes yet.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead><tr><th>Code</th><th>Discount</th><th>Used</th><th>Saved customers</th><th>Rules</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {promos.map((p) => {
                const s = statOf(p.id);
                const uses = s?._count._all ?? 0;
                const expired = Boolean(p.expiresOn && today > p.expiresOn);
                const usedUp = p.maxUses != null && uses >= p.maxUses;
                const status = !p.active ? "Paused" : expired ? "Expired" : usedUp ? "Used up" : "Active";
                return (
                  <tr key={p.id}>
                    <td><strong>{p.code}</strong>{p.note && <div className="muted" style={{ fontSize: 13 }}>{p.note}</div>}</td>
                    <td>{promoLabel(p)}</td>
                    <td>{uses}{p.maxUses != null ? ` / ${p.maxUses}` : ""}</td>
                    <td>{formatPrice(s?._sum.discountCents ?? 0)}</td>
                    <td className="muted" style={{ fontSize: 13 }}>
                      {p.expiresOn ? `Through ${nice(p.expiresOn)}` : "No end date"}
                      {p.onePerCustomer && <><br />One per customer</>}
                      <br />Added {formatInZone(p.createdAt, business.timeZone, { month: "short", day: "numeric" })}{p.createdBy ? ` by ${p.createdBy}` : ""}
                    </td>
                    <td><span className={`chip-status ${status === "Active" ? "on" : "off"}`}>{status}</span></td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <form action={toggleActive} style={{ display: "inline" }}><input type="hidden" name="id" value={p.id} /><button className="btn secondary">{p.active ? "Pause" : "Turn on"}</button></form>{" "}
                      {!everUsed(p.id) && <form action={deletePromo} style={{ display: "inline" }}><input type="hidden" name="id" value={p.id} /><button className="btn secondary">Delete</button></form>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="muted" style={{ fontSize: 13 }}>Codes that have been used can be paused but not deleted, so past bookings keep their record. Cancelled bookings and unpaid holds that expired don't count as uses.</p>
    </>
  );
}
