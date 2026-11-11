import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import AdminNav from "@/components/AdminNav";
import { business } from "@/config/business";
import { requireAdmin } from "@/lib/admin";
import { hashPassword, normalizeEmail, verifyPassword } from "@/lib/customer";
import { db } from "@/lib/db";
import { formatInZone } from "@/lib/time";

export const dynamic = "force-dynamic";

async function changePassword(form: FormData) {
  "use server";
  const admin = await requireAdmin();
  const current = String(form.get("current") ?? ""), next = String(form.get("next") ?? "");
  if (!verifyPassword(current, admin.passwordHash)) redirect("/admin/account?pw=wrong");
  if (next.length < 10) redirect("/admin/account?pw=short");
  await db.admin.update({ where: { id: admin.id }, data: { passwordHash: hashPassword(next) } });
  redirect("/admin/account?pw=ok");
}

async function addAdmin(form: FormData) {
  "use server";
  await requireAdmin();
  const email = normalizeEmail(String(form.get("email") ?? "")), password = String(form.get("password") ?? "");
  if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 10) redirect("/admin/account?add=invalid");
  if (await db.admin.findUnique({ where: { email } })) redirect("/admin/account?add=taken");
  await db.admin.create({ data: { email, name: String(form.get("name") ?? "").trim() || null, passwordHash: hashPassword(password) } });
  redirect("/admin/account?add=ok");
}

async function removeAdmin(form: FormData) {
  "use server";
  const me = await requireAdmin();
  const id = String(form.get("id"));
  if (id === me.id) return; // you can't remove yourself, so there's always one admin
  await db.admin.delete({ where: { id } }).catch(() => {});
  revalidatePath("/admin/account");
}

const PW: Record<string, [string, string]> = { ok: ["ok", "Password changed."], wrong: ["error", "Your current password isn't right."], short: ["error", "Use a new password of at least 10 characters."] };
const ADD: Record<string, [string, string]> = { ok: ["ok", "Admin added. Send them their password privately."], invalid: ["error", "Enter a valid email and a password of at least 10 characters."], taken: ["error", "That email is already an admin."] };

export default async function AdminAccount(props: { searchParams: Promise<{ pw?: string; add?: string }> }) {
  const searchParams = await props.searchParams;
  const me = await requireAdmin();
  const admins = await db.admin.findMany({ orderBy: { createdAt: "asc" } });
  const pw = searchParams.pw && PW[searchParams.pw], add = searchParams.add && ADD[searchParams.add];
  return (
    <>
      <h1>Owner dashboard</h1>
      <AdminNav active="/admin/account" />

      <h2>Change your password</h2>
      <form action={changePassword} className="card" style={{ maxWidth: 480 }}>
        <p className="muted" style={{ marginTop: 0 }}>Logged in as {me.email}</p>
        <label htmlFor="current">Current password</label>
        <input id="current" name="current" type="password" required autoComplete="current-password" />
        <label htmlFor="next">New password (10+ characters)</label>
        <input id="next" name="next" type="password" required minLength={10} autoComplete="new-password" />
        {pw && <p className={pw[0]}>{pw[1]}</p>}
        <p><button className="btn">Change password</button></p>
      </form>

      <h2>Admins</h2>
      <table>
        <tbody>
          {admins.map((a) => (
            <tr key={a.id}>
              <td><strong>{a.name ?? a.email}</strong>{a.name && <div className="muted">{a.email}</div>}</td>
              <td className="muted">Added {formatInZone(a.createdAt, business.timeZone, { month: "short", day: "numeric", year: "numeric" })}</td>
              <td style={{ width: 100 }}>{a.id === me.id ? <span className="muted">You</span> : <form action={removeAdmin}><input type="hidden" name="id" value={a.id} /><button className="btn secondary">Remove</button></form>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <form action={addAdmin} className="card" style={{ maxWidth: 480, marginTop: 16 }}>
        <strong>Add an admin</strong>
        <label htmlFor="aname">Name (optional)</label>
        <input id="aname" name="name" />
        <label htmlFor="aemail">Email</label>
        <input id="aemail" name="email" type="email" required />
        <label htmlFor="apw">Temporary password (10+ characters)</label>
        <input id="apw" name="password" type="password" required minLength={10} autoComplete="new-password" />
        {add && <p className={add[0]}>{add[1]}</p>}
        <p><button className="btn">Add admin</button></p>
      </form>
    </>
  );
}
