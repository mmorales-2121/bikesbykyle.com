import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCustomer, hashPassword, normalizeEmail, startSession } from "@/lib/customer";

async function signup(form: FormData) {
  "use server";
  const email = normalizeEmail(String(form.get("email") ?? ""));
  const name = String(form.get("name") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const next = String(form.get("next") ?? "");
  const back = (e: string) => redirect(`/account/signup?error=${e}${next ? `&next=${encodeURIComponent(next)}` : ""}`);
  if (!name || !/^\S+@\S+\.\S+$/.test(email)) back("missing");
  if (password.length < 8) back("short");
  if (await db.customer.findUnique({ where: { email } })) back("taken");
  const customer = await db.customer.create({
    data: { email, name, phone: String(form.get("phone") ?? "").trim() || null, bikeNotes: String(form.get("bikeNotes") ?? "").trim() || null, passwordHash: hashPassword(password) },
  });
  // Link earlier guest bookings made with the same email.
  await db.booking.updateMany({ where: { customerEmail: email, customerId: null }, data: { customerId: customer.id } });
  startSession(customer.id);
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/account");
}

const ERRORS: Record<string, string> = {
  missing: "Please enter your name and a valid email.",
  short: "Use a password of at least 8 characters.",
  taken: "An account with that email already exists. Try logging in.",
};

export default async function Signup({ searchParams }: { searchParams: { error?: string; next?: string } }) {
  if (await getCustomer()) redirect("/account");
  return (
    <form action={signup} className="card" style={{ maxWidth: 480 }}>
      <h1>Create an account</h1>
      <p className="muted">Save your details and bike info so booking next time takes seconds.</p>
      <input type="hidden" name="next" value={searchParams.next ?? ""} />
      <label htmlFor="name">Name</label>
      <input id="name" name="name" required autoComplete="name" />
      <label htmlFor="email">Email</label>
      <input id="email" name="email" type="email" required autoComplete="email" />
      <label htmlFor="phone">Phone (optional)</label>
      <input id="phone" name="phone" type="tel" autoComplete="tel" />
      <label htmlFor="bikeNotes">Your bike(s) (optional)</label>
      <textarea id="bikeNotes" name="bikeNotes" rows={2} placeholder="e.g. 2021 Specialized Tarmac, 56cm, Shimano 105" />
      <label htmlFor="password">Password (8+ characters)</label>
      <input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" />
      {searchParams.error && <p className="error">{ERRORS[searchParams.error] ?? "Something went wrong."}</p>}
      <p><button className="btn">Create account</button></p>
      <p className="muted">Already have one? <Link href="/account/login">Log in</Link></p>
    </form>
  );
}
