import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCustomer, hashPassword, normalizeEmail } from "@/lib/customer";
import { clientIp, HOUR, take } from "@/lib/ratelimit";
import { sendAlreadyRegisteredEmail, sendVerifyEmail, VERIFY_HOURS } from "@/lib/verify";

async function signup(form: FormData) {
  "use server";
  const email = normalizeEmail(String(form.get("email") ?? ""));
  const name = String(form.get("name") ?? "").trim().slice(0, 120);
  const password = String(form.get("password") ?? "");
  const next = String(form.get("next") ?? "");
  const back: (e: string) => never = (e) => redirect(`/account/signup?error=${e}${next ? `&next=${encodeURIComponent(next)}` : ""}`);
  if (!name || !/^\S+@\S+\.\S+$/.test(email)) back("missing");
  if (password.length < 8) back("short");
  if (!take(`signup:ip:${await clientIp()}`, 5, HOUR)) back("slow");

  // Nothing is linked and nobody is logged in until the owner of the email clicks the link we send.
  // The page looks the same whether or not the email already has an account.
  const existing = await db.customer.findUnique({ where: { email } });
  if (existing?.emailVerifiedAt) {
    if (take(`signup:exists:${email}`, 2, HOUR)) await sendAlreadyRegisteredEmail(existing).catch((e) => console.error("Signup email failed", e));
  } else if (take(`signup:email:${email}`, 3, HOUR)) {
    const details = {
      name,
      phone: String(form.get("phone") ?? "").trim().slice(0, 40) || null,
      bikeNotes: String(form.get("bikeNotes") ?? "").trim().slice(0, 500) || null,
      passwordHash: hashPassword(password),
    };
    // An unconfirmed sign-up for this email is replaced by the newest one, which also cancels older links.
    const customer = existing
      ? await db.customer.update({ where: { id: existing.id }, data: details })
      : await db.customer.create({ data: { email, ...details } });
    await sendVerifyEmail(customer, next).catch((e) => console.error("Verification email failed", e));
  }
  redirect("/account/signup?sent=1");
}

const ERRORS: Record<string, string> = {
  missing: "Please enter your name and a valid email.",
  short: "Use a password of at least 8 characters.",
  slow: "Too many sign-ups from this connection. Please try again in an hour.",
};

export default async function Signup(props: { searchParams: Promise<{ error?: string; next?: string; sent?: string }> }) {
  const searchParams = await props.searchParams;
  if (await getCustomer()) redirect("/account");
  if (searchParams.sent) {
    return (
      <div className="card" style={{ maxWidth: 480 }}>
        <h1>Check your email</h1>
        <p>We sent you a link to finish creating your account. It works for {VERIFY_HOURS} hours.</p>
        <p className="muted">Don't see it? Check your spam folder. If you already have an account, the email will say so and you can just log in.</p>
        <p><Link className="btn" href="/account/login">Go to log in</Link></p>
      </div>
    );
  }
  return (
    <form action={signup} className="card" style={{ maxWidth: 480 }}>
      <h1>Create an account</h1>
      <p className="muted">Save your details and bike info so booking next time takes seconds.</p>
      <input type="hidden" name="next" value={searchParams.next ?? ""} />
      <label htmlFor="name">Name</label>
      <input id="name" name="name" required autoComplete="name" maxLength={120} />
      <label htmlFor="email">Email</label>
      <input id="email" name="email" type="email" required autoComplete="email" />
      <label htmlFor="phone">Phone (optional)</label>
      <input id="phone" name="phone" type="tel" autoComplete="tel" maxLength={40} />
      <label htmlFor="bikeNotes">Your bike(s) (optional)</label>
      <textarea id="bikeNotes" name="bikeNotes" rows={2} maxLength={500} placeholder="e.g. 2021 Specialized Tarmac, 56cm, Shimano 105" />
      <label htmlFor="password">Password (8+ characters)</label>
      <input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" />
      {searchParams.error && <p className="error">{ERRORS[searchParams.error] ?? "Something went wrong."}</p>}
      <p className="muted">We'll email you a link to confirm your address before the account is ready.</p>
      <p><button className="btn">Create account</button></p>
      <p className="muted">Already have one? <Link href="/account/login">Log in</Link></p>
    </form>
  );
}
