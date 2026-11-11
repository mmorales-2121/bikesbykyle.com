import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCustomer, normalizeEmail, startSession, verifyPassword } from "@/lib/customer";
import { clear, clientIp, HOUR, isLimited, MINUTE, record, take } from "@/lib/ratelimit";
import { safeNext, sendVerifyEmail } from "@/lib/verify";

const WINDOW = 15 * MINUTE;

async function login(form: FormData) {
  "use server";
  const email = normalizeEmail(String(form.get("email") ?? ""));
  const next = String(form.get("next") ?? "");
  const back: (e: string) => never = (e) => redirect(`/account/login?error=${e}${next ? `&next=${encodeURIComponent(next)}` : ""}`);
  const ipKey = `login:ip:${await clientIp()}`, emailKey = `login:email:${email}`;
  if (isLimited(ipKey, 10, WINDOW) || isLimited(emailKey, 5, WINDOW)) back("slow");

  const customer = await db.customer.findUnique({ where: { email } });
  if (!customer || !verifyPassword(String(form.get("password") ?? ""), customer.passwordHash)) {
    record(ipKey, WINDOW);
    record(emailKey, WINDOW);
    back("1");
  }
  if (!customer.emailVerifiedAt) {
    // Right password but the email isn't confirmed yet: send a fresh link (a few per hour at most).
    if (take(`verify:resend:${email}`, 3, HOUR)) await sendVerifyEmail(customer, next).catch((e) => console.error("Verification email failed", e));
    back("unverified");
  }
  clear(emailKey);
  await startSession(customer.id);
  redirect(safeNext(next));
}

const ERRORS: Record<string, string> = {
  "1": "That email and password don't match. Check them and try again.",
  slow: "Too many tries. Please wait 15 minutes and try again.",
  unverified: "Please confirm your email first. We've sent a new link to your inbox.",
};

export default async function Login(props: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const searchParams = await props.searchParams;
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
      {searchParams.error && <p className="error">{ERRORS[searchParams.error] ?? ERRORS["1"]}</p>}
      <p><button className="btn">Log in</button></p>
      <p className="muted">New here? <Link href={`/account/signup${searchParams.next ? `?next=${encodeURIComponent(searchParams.next)}` : ""}`}>Create an account</Link></p>
    </form>
  );
}
