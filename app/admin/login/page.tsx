import { redirect } from "next/navigation";
import { ensureFirstAdmin, getAdmin, startAdminSession } from "@/lib/admin";
import { normalizeEmail, verifyPassword } from "@/lib/customer";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

async function login(form: FormData) {
  "use server";
  await ensureFirstAdmin();
  const admin = await db.admin.findUnique({ where: { email: normalizeEmail(String(form.get("email") ?? "")) } });
  if (!admin || !verifyPassword(String(form.get("password") ?? ""), admin.passwordHash)) redirect("/admin/login?error=1");
  startAdminSession(admin.id);
  redirect("/admin");
}

export default async function Login({ searchParams }: { searchParams: { error?: string } }) {
  if (await getAdmin()) redirect("/admin");
  return (
    <form action={login} className="card" style={{ maxWidth: 400 }}>
      <h1>Owner login</h1>
      <label htmlFor="email">Email</label>
      <input id="email" name="email" type="email" required autoFocus autoComplete="email" />
      <label htmlFor="password">Password</label>
      <input id="password" name="password" type="password" required autoComplete="current-password" />
      {searchParams.error && <p className="error">That email and password don't match. Check them and try again.</p>}
      <p><button className="btn">Log in</button></p>
    </form>
  );
}
