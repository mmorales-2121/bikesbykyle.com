import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCustomer, normalizeEmail, startSession, verifyPassword } from "@/lib/customer";

async function login(form: FormData) {
  "use server";
  const email = normalizeEmail(String(form.get("email") ?? ""));
  const customer = await db.customer.findUnique({ where: { email } });
  if (!customer || !verifyPassword(String(form.get("password") ?? ""), customer.passwordHash)) redirect("/account/login?error=1");
  startSession(customer.id);
  redirect(safeNext(String(form.get("next") ?? "")));
}

const safeNext = (n: string) => (n.startsWith("/") && !n.startsWith("//") ? n : "/account");

export default async function Login({ searchParams }: { searchParams: { error?: string; next?: string } }) {
  if (await getCustomer()) redirect("/account");
  return (
    <form action={login} className="card" style={{ maxWidth: 400 }}>
      <h1>Log in</h1>
      <p className="muted">Log in to book faster with your saved details.</p>
      <input type="hidden" name="next" value={searchParams.next ?? ""} />
      <label htmlFor="email">Email</label>
      <input id="email" name="email" type="email" required autoComplete="email" />
      <label htmlFor="password">Password</label>
      <input id="password" name="password" type="password" required autoComplete="current-password" />
      {searchParams.error && <p className="error">That email and password don't match. Check them and try again.</p>}
      <p><button className="btn">Log in</button></p>
      <p className="muted">New here? <Link href={`/account/signup${searchParams.next ? `?next=${encodeURIComponent(searchParams.next)}` : ""}`}>Create an account</Link></p>
    </form>
  );
}
