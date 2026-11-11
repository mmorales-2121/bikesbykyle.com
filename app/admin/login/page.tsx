import { redirect } from "next/navigation";
import { ensureFirstAdmin, getAdmin, startAdminSession } from "@/lib/admin";
import { normalizeEmail, verifyPassword } from "@/lib/customer";
import { db } from "@/lib/db";
import { clear, clientIp, isLimited, MINUTE, record } from "@/lib/ratelimit";

const WINDOW = 15 * MINUTE;

export const dynamic = "force-dynamic";

async function login(form: FormData) {
  "use server";
  const email = normalizeEmail(String(form.get("email") ?? ""));
  const ipKey = `admin:ip:${await clientIp()}`, emailKey = `admin:email:${email}`;
  if (isLimited(ipKey, 5, WINDOW) || isLimited(emailKey, 10, WINDOW)) redirect("/admin/login?error=slow");
  await ensureFirstAdmin();
  const admin = await db.admin.findUnique({ where: { email } });
  if (!admin || !verifyPassword(String(form.get("password") ?? ""), admin.passwordHash)) {
    record(ipKey, WINDOW);
    record(emailKey, WINDOW);
    redirect("/admin/login?error=1");
  }
  clear(emailKey);
  await startAdminSession(admin.id);
  redirect("/admin");
}

export default async function Login(props: { searchParams: Promise<{ error?: string }> }) {
  const searchParams = await props.searchParams;
  if (await getAdmin()) redirect("/admin");
  return (
    <form action={login} className="card" style={{ maxWidth: 400 }}>
      <h1>Owner login</h1>
      <label htmlFor="email">Email</label>
      <input id="email" name="email" type="email" required autoFocus autoComplete="email" />
      <label htmlFor="password">Password</label>
      <input id="password" name="password" type="password" required autoComplete="current-password" />
      {searchParams.error && (
        <p className="error">
          {searchParams.error === "slow" ? "Too many tries. Please wait 15 minutes and try again." : "That email and password don't match. Check them and try again."}
        </p>
      )}
      <p><button className="btn">Log in</button></p>
    </form>
  );
}
