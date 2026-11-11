import { business, formatPrice, getService } from "@/config/business";
import { db } from "./db";
import { sendEmail } from "./email";
import { formatWhen } from "./time";

type Booking = {
  id: string; accessToken: string; serviceId: string; customerName: string; customerEmail: string; customerPhone: string | null;
  notes: string | null; start: Date; end: Date; priceCents: number; tipCents: number; paymentMethod: string; paidAt: Date | null;
};

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const siteUrl = () => (process.env.SITE_URL || process.env.RENDER_EXTERNAL_URL || "http://localhost:3000").replace(/\/$/, "");
const dur = (m: number) => (m < 120 ? `${m} min` : `${Math.round(m / 30) / 2} hours`);
const gcalDate = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

function paymentLine(b: Booking) {
  const total = formatPrice(b.priceCents + b.tipCents);
  const tip = b.tipCents ? ` (includes ${formatPrice(b.tipCents)} tip)` : "";
  return b.paidAt ? `Paid online: ${total}${tip}` : `Due at pickup: ${total}${tip}`;
}

/** Shared email frame in the site's colors. Rows are [label, value] pairs. */
function layout(heading: string, intro: string, rows: [string, string][], button?: { href: string; label: string }, footer = "") {
  const rowHtml = rows.map(([k, v]) =>
    `<tr><td style="padding:8px 0;color:#6b7280;font-size:14px;width:120px;vertical-align:top">${esc(k)}</td><td style="padding:8px 0;font-size:15px;color:#111827">${esc(v).replace(/\n/g, "<br>")}</td></tr>`).join("");
  const html = `<!doctype html><html><body style="margin:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:10px;overflow:hidden">
<tr><td style="background:#0d0f12;padding:18px 24px"><span style="color:#ffffff;font-size:20px;font-weight:bold;font-style:italic;letter-spacing:1px;text-transform:uppercase">Bikes <span style="color:#e0312b">By Kyle</span></span></td></tr>
<tr><td style="padding:24px">
<h1 style="margin:0 0 8px;font-size:22px;color:#111827">${esc(heading)}</h1>
<p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.5">${esc(intro)}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb">${rowHtml}</table>
${button ? `<p style="margin:20px 0 0"><a href="${esc(button.href)}" style="display:inline-block;background:#e0312b;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:6px">${esc(button.label)}</a></p>` : ""}
${footer ? `<p style="margin:20px 0 0;font-size:13px;color:#6b7280;line-height:1.5">${footer}</p>` : ""}
</td></tr></table>
<p style="font-size:12px;color:#9ca3af;margin:16px 0 0">${esc(business.name)} · Austin, TX</p>
</td></tr></table></body></html>`;
  const text = [heading, "", intro, "", ...rows.map(([k, v]) => `${k}: ${v}`), ...(button ? ["", `${button.label}: ${button.href}`] : [])].join("\n");
  return { html, text };
}

export function customerConfirmationEmail(b: Booking) {
  const service = getService(b.serviceId);
  const when = formatWhen(b.start, business.timeZone);
  const statusUrl = `${siteUrl()}/booking/${b.id}?t=${b.accessToken}`;
  const gcal = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`${service?.name ?? "Bike service"} at ${business.name}`)}&dates=${gcalDate(b.start)}/${gcalDate(b.end)}&details=${encodeURIComponent(`Booking details: ${statusUrl}`)}`;
  const { html, text } = layout(
    "Your appointment is confirmed",
    `Thanks, ${b.customerName.split(" ")[0]}! Here are your booking details. Use the button below to check your bike's status anytime.`,
    [["Service", service?.name ?? b.serviceId], ["When", when], ["Payment", paymentLine(b)], ...(b.notes ? [["Your notes", b.notes] as [string, string]] : [])],
    { href: statusUrl, label: "View your booking" },
    `<a href="${esc(gcal)}" style="color:#e0312b">Add to Google Calendar</a><br>Need to change something? Just reply to this email.`,
  );
  return { to: b.customerEmail, subject: `Confirmed: ${service?.name ?? "your appointment"}, ${when}`, html, text: `${text}\n\nAdd to Google Calendar: ${gcal}`, replyTo: process.env.ADMIN_EMAIL || undefined };
}

export function adminNewBookingEmail(b: Booking, to: string[]) {
  const service = getService(b.serviceId);
  const when = formatWhen(b.start, business.timeZone);
  const { html, text } = layout(
    `New booking: ${service?.name ?? b.serviceId}`,
    `${b.customerName} just booked ${service?.name ?? b.serviceId}.`,
    [
      ["Service", `${service?.name ?? b.serviceId}${service ? ` (about ${dur(service.durationMinutes)})` : ""}`],
      ["When", when],
      ["Customer", b.customerName],
      ["Email", b.customerEmail],
      ...(b.customerPhone ? [["Phone", b.customerPhone] as [string, string]] : []),
      ["Payment", paymentLine(b)],
      ...(b.notes ? [["Notes", b.notes] as [string, string]] : []),
    ],
    { href: `${siteUrl()}/admin`, label: "Open the dashboard" },
  );
  return { to, subject: `New booking: ${service?.name ?? b.serviceId}, ${when} (${b.customerName})`, html, text, replyTo: b.customerEmail };
}

/** Who gets "new booking" emails: NOTIFY_EMAILS if set, otherwise every admin account. */
async function adminRecipients() {
  const list = (process.env.NOTIFY_EMAILS || "").split(",").map((e) => e.trim()).filter(Boolean);
  if (list.length) return list;
  const admins = (await db.admin.findMany({ select: { email: true } })).map((a) => a.email);
  if (admins.length) return admins;
  return process.env.ADMIN_EMAIL ? [process.env.ADMIN_EMAIL.trim()] : [];
}

/** Sends both emails. Failures are logged and never block the booking. */
export async function sendBookingEmails(bookingId: string) {
  const b = await db.booking.findUnique({ where: { id: bookingId } });
  if (!b) return;
  const jobs = [
    sendEmail(customerConfirmationEmail(b)).catch((e) => console.error("Customer confirmation email failed", bookingId, e)),
    adminRecipients().then((to) => sendEmail(adminNewBookingEmail(b, to))).catch((e) => console.error("Admin booking email failed", bookingId, e)),
  ];
  await Promise.all(jobs);
}
