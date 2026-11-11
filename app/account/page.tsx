import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { business, formatPrice, getService } from "@/config/business";
import { STATUS_LABELS } from "@/lib/booking";
import { db } from "@/lib/db";
import { endSession, getCustomer } from "@/lib/customer";
import { formatWhen } from "@/lib/time";

export const dynamic = "force-dynamic";

async function saveProfile(form: FormData) {
  "use server";
  const customer = await getCustomer();
  if (!customer) redirect("/account/login");
  const name = String(form.get("name") ?? "").trim();
  await db.customer.update({
    where: { id: customer.id },
    data: { name: name || customer.name, phone: String(form.get("phone") ?? "").trim() || null, bikeNotes: String(form.get("bikeNotes") ?? "").trim() || null },
  });
  revalidatePath("/account");
  redirect("/account?saved=1");
}

async function logout() {
  "use server";
  await endSession();
  redirect("/");
}

export default async function Account(props: { searchParams: Promise<{ saved?: string }> }) {
  const searchParams = await props.searchParams;
  const customer = await getCustomer();
  if (!customer) redirect("/account/login?next=/account");
  const bookings = await db.booking.findMany({ where: { customerId: customer.id, status: { not: "PENDING_PAYMENT" } }, orderBy: { start: "desc" }, take: 50 });
  const lastService = bookings[0] && getService(bookings[0].serviceId);

  return (
    <>
      <div className="row"><h1 style={{ marginRight: "auto" }}>Hi, {customer.name.split(" ")[0]}</h1><form action={logout}><button className="btn secondary">Log out</button></form></div>
      {lastService && <p><Link className="btn" href={`/book/${lastService.id}`}>Book {lastService.name} again</Link> <Link href="/#services" style={{ marginLeft: 12 }}>or pick another service</Link></p>}

      <h2>Your bookings</h2>
      {bookings.length === 0 ? <p className="muted">No bookings yet. <Link href="/#services">Book your first service</Link>.</p> : (
        <table>
          <thead><tr><th>When</th><th>Service</th><th>Total</th><th>Status</th></tr></thead>
          <tbody>
            {bookings.map((b) => (
              <tr key={b.id}>
                <td>{formatWhen(b.start, business.timeZone)}</td>
                <td>{getService(b.serviceId)?.name ?? b.serviceId}</td>
                <td>{formatPrice(b.priceCents + b.tipCents)}</td>
                <td><Link href={`/booking/${b.id}?t=${b.accessToken}`}>{STATUS_LABELS[b.status] ?? b.status}</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2>Saved details</h2>
      <form action={saveProfile} className="card">
        <p className="muted" style={{ marginTop: 0 }}>These fill in automatically when you book. Email: {customer.email}</p>
        <label htmlFor="name">Name</label>
        <input id="name" name="name" defaultValue={customer.name} required />
        <label htmlFor="phone">Phone</label>
        <input id="phone" name="phone" type="tel" defaultValue={customer.phone ?? ""} />
        <label htmlFor="bikeNotes">Your bike(s)</label>
        <textarea id="bikeNotes" name="bikeNotes" rows={2} defaultValue={customer.bikeNotes ?? ""} />
        {searchParams.saved && <p className="ok">Saved.</p>}
        <p><button className="btn">Save details</button></p>
      </form>
    </>
  );
}
