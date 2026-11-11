import { notFound } from "next/navigation";
import { business, formatPrice, getService } from "@/config/business";
import { todayIn } from "@/lib/time";
import { getCustomer } from "@/lib/customer";
import Link from "next/link";

export const dynamic = "force-dynamic";
import BookingForm from "./BookingForm";

export default async function BookPage({ params }: { params: { serviceId: string } }) {
  const service = getService(params.serviceId);
  if (!service) notFound();
  const customer = await getCustomer();
  return (
    <>
      <p className="eyebrow" style={{ letterSpacing: ".08em" }}>{service.category}</p>
      <h1>{service.name}</h1>
      <p className="muted">{formatPrice(service.priceCents)} · {service.durationMinutes} min · times shown in {business.timeZone.replace("_", " ")}</p>
      {customer ? <p className="muted">Booking as {customer.name}. Your saved details are filled in below.</p>
        : <p className="muted"><Link href={`/account/login?next=/book/${service.id}`}>Log in</Link> or <Link href={`/account/signup?next=/book/${service.id}`}>create an account</Link> to save your details for next time.</p>}
      <BookingForm saved={customer ? { name: customer.name, email: customer.email, phone: customer.phone ?? "", bikeNotes: customer.bikeNotes ?? "" } : null} serviceId={service.id} priceCents={service.priceCents} minDate={todayIn(business.timeZone)} maxDate={todayIn(business.timeZone, business.maxDaysAhead)} timeZone={business.timeZone} />
    </>
  );
}
