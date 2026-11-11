import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { startSession } from "@/lib/customer";
import { checkVerifyLink, safeNext } from "@/lib/verify";

export const dynamic = "force-dynamic";

// The email link opens this page and the customer presses a button to confirm.
// Using a button (not the link itself) means email scanners that open links can't confirm on someone's behalf.
async function confirm(form: FormData) {
  "use server";
  const get = (k: string) => String(form.get(k) ?? "");
  const customer = await checkVerifyLink(get("id"), get("exp"), get("sig"));
  if (!customer) redirect("/account/verify?bad=1");
  const done = await db.customer.updateMany({ where: { id: customer.id, emailVerifiedAt: null }, data: { emailVerifiedAt: new Date() } });
  if (done.count === 0) redirect("/account/verify?bad=1");
  // Now that we know this person owns the email, show their earlier guest bookings in the account.
  await db.booking.updateMany({ where: { customerEmail: customer.email, customerId: null }, data: { customerId: customer.id } });
  await startSession(customer.id);
  redirect(safeNext(get("next")));
}

export default async function Verify(props: { searchParams: Promise<{ id?: string; exp?: string; sig?: string; next?: string; bad?: string }> }) {
  const sp = await props.searchParams;
  const customer = sp.bad ? null : await checkVerifyLink(sp.id ?? "", sp.exp ?? "", sp.sig ?? "");
  if (!customer) {
    return (
      <div className="card" style={{ maxWidth: 480 }}>
        <h1>This link doesn't work anymore</h1>
        <p>It may have expired, been replaced by a newer one, or already been used.</p>
        <p className="muted">Log in with your email and password. If your email still needs confirming, we'll send you a fresh link.</p>
        <p><Link className="btn" href="/account/login">Go to log in</Link></p>
      </div>
    );
  }
  return (
    <form action={confirm} className="card" style={{ maxWidth: 480 }}>
      <h1>Confirm your email</h1>
      <p>Finish creating your account for <strong>{customer.email}</strong>.</p>
      <input type="hidden" name="id" value={sp.id} />
      <input type="hidden" name="exp" value={sp.exp} />
      <input type="hidden" name="sig" value={sp.sig} />
      <input type="hidden" name="next" value={sp.next ?? ""} />
      <p><button className="btn">Confirm my email</button></p>
    </form>
  );
}
