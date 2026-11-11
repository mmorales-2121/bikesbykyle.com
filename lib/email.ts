import nodemailer from "nodemailer";

export type Email = { to: string | string[]; subject: string; html: string; text: string; replyTo?: string };

/**
 * Sends email through Resend (RESEND_API_KEY) or any SMTP server such as Gmail (SMTP_HOST, SMTP_USER, SMTP_PASS).
 * With neither set, emails are written to the server log instead, so nothing breaks before email is set up.
 */
export async function sendEmail(email: Email) {
  const from = process.env.EMAIL_FROM || process.env.SMTP_USER || "Bikes By Kyle <onboarding@resend.dev>";
  const to = Array.isArray(email.to) ? email.to : [email.to];
  if (to.length === 0) return;

  if (process.env.RESEND_API_KEY) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject: email.subject, html: email.html, text: email.text, reply_to: email.replyTo }),
    });
    if (!res.ok) throw new Error(`Resend error ${res.status}: ${await res.text()}`);
    return;
  }

  if (process.env.SMTP_HOST) {
    const port = Number(process.env.SMTP_PORT || 465);
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    await transport.sendMail({ from, to, subject: email.subject, html: email.html, text: email.text, replyTo: email.replyTo });
    return;
  }

  console.log(`[email not set up] Would send to ${to.join(", ")}: ${email.subject}\n${email.text}`);
}
