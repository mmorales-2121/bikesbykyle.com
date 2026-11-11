import nodemailer from "nodemailer";
import { db } from "./db";

export type Email = { to: string | string[]; subject: string; html: string; text: string; replyTo?: string };

// Values pasted into Render sometimes carry spaces or quotes; clean them up.
const env = (k: string) => (process.env[k] ?? "").trim().replace(/^["']|["']$/g, "").trim();

/** Which email service the site will use, read from the environment. Never includes passwords or keys. */
export function emailSetup() {
  const host = env("SMTP_HOST"), user = env("SMTP_USER");
  const isGmail = /gmail|googlemail/i.test(host);
  // Google shows app passwords as "abcd efgh ijkl mnop"; the spaces must go.
  const pass = isGmail ? env("SMTP_PASS").replace(/\s+/g, "") : env("SMTP_PASS");
  const port = Number(env("SMTP_PORT") || 465);
  const provider: "resend" | "smtp" | "none" = env("RESEND_API_KEY") ? "resend" : host ? "smtp" : "none";
  const from = env("EMAIL_FROM") || (user ? `Bikes By Kyle <${user}>` : "Bikes By Kyle <onboarding@resend.dev>");
  const problems: string[] = [];
  if (provider === "none") problems.push("No email service is set up. Add SMTP_HOST, SMTP_USER and SMTP_PASS (Gmail app password) or RESEND_API_KEY in Render > Environment.");
  if (provider === "smtp") {
    if (!user) problems.push("SMTP_USER is empty. Set it to the full Gmail address that sends the emails.");
    if (!pass) problems.push("SMTP_PASS is empty. Set it to the 16-letter Gmail app password.");
    if (isGmail && pass && pass.length !== 16) problems.push(`SMTP_PASS is ${pass.length} characters. A Gmail app password is 16 letters; your normal Gmail password won't work.`);
    if (![465, 587, 25, 2525].includes(port)) problems.push(`SMTP_PORT is ${port}. Gmail uses 465.`);
  }
  if (provider === "resend" && /resend\.dev/.test(from)) problems.push("EMAIL_FROM uses Resend's test address, which only delivers to the Resend account owner. Verify your domain in Resend and set EMAIL_FROM to an address at it.");
  return { provider, host, port, user, pass, from, problems };
}

/** Turns common mail errors into a plain next step. */
export function explainEmailError(message: string) {
  const m = message.toLowerCase();
  if (/535|username and password not accepted|invalid login|badcredentials|eauth/.test(m)) return "The mail server rejected the login. For Gmail, SMTP_USER must be the full Gmail address and SMTP_PASS a 16-letter app password (myaccount.google.com/apppasswords), not the normal password.";
  if (/etimedout|timeout|econnrefused|enetunreach|ehostunreach|greeting never received|connection closed/.test(m)) return "Couldn't connect to the mail server. Render's free plan blocks email ports, so the service must be on a paid plan (Starter), or use Resend (RESEND_API_KEY), which sends over HTTPS.";
  if (/enotfound|getaddrinfo/.test(m)) return "The mail server address in SMTP_HOST doesn't exist. For Gmail use smtp.gmail.com.";
  if (/only send testing emails|verify a domain|domain is not verified|not verified/.test(m)) return "Resend will only send to other people once your domain is verified. Verify it in Resend and set EMAIL_FROM to an address at that domain.";
  if (/resend error 401|resend error 403|api key/.test(m)) return "Resend didn't accept the API key. Create a new key in Resend and paste it into RESEND_API_KEY.";
  if (/self.signed|certificate|wrong version number|ssl/.test(m)) return "The secure connection failed. Use SMTP_PORT 465 for Gmail.";
  return "";
}

async function logEmail(to: string[], subject: string, provider: string, ok: boolean, error?: string) {
  try {
    await db.emailLog.create({ data: { to: to.join(", "), subject: subject.slice(0, 200), provider, ok, error: error?.slice(0, 500) ?? null } });
    // Keep the log small.
    const old = await db.emailLog.findMany({ orderBy: { createdAt: "desc" }, skip: 200, select: { id: true } });
    if (old.length) await db.emailLog.deleteMany({ where: { id: { in: old.map((o) => o.id) } } });
  } catch (e) {
    console.error("[email] couldn't write email log", e);
  }
}

/**
 * Sends email through Resend (RESEND_API_KEY) or any SMTP server such as Gmail (SMTP_HOST, SMTP_USER, SMTP_PASS).
 * Every attempt is written to the email log the owner sees under Account. Throws if sending fails.
 */
export async function sendEmail(email: Email) {
  const setup = emailSetup();
  const to = (Array.isArray(email.to) ? email.to : [email.to]).map((t) => t.trim()).filter(Boolean);
  if (to.length === 0) return;

  try {
    if (setup.provider === "resend") {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${env("RESEND_API_KEY")}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: setup.from, to, subject: email.subject, html: email.html, text: email.text, reply_to: email.replyTo }),
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) throw new Error(`Resend error ${res.status}: ${await res.text()}`);
    } else if (setup.provider === "smtp") {
      const transport = nodemailer.createTransport({
        host: setup.host,
        port: setup.port,
        secure: setup.port === 465,
        auth: setup.user ? { user: setup.user, pass: setup.pass } : undefined,
        // Fail in seconds instead of hanging for minutes when the server can't be reached.
        connectionTimeout: 15000,
        greetingTimeout: 15000,
        socketTimeout: 30000,
      });
      await transport.sendMail({ from: setup.from, to, subject: email.subject, html: email.html, text: email.text, replyTo: email.replyTo });
    } else {
      throw new Error("Email isn't set up (no SMTP_HOST or RESEND_API_KEY).");
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[email] FAILED "${email.subject}" to ${to.join(", ")} via ${setup.provider}: ${message}`);
    await logEmail(to, email.subject, setup.provider, false, message);
    if (setup.provider === "none") {
      console.log(`[email not set up] Would send to ${to.join(", ")}: ${email.subject}\n${email.text}`);
      return;
    }
    throw err;
  }
  console.log(`[email] sent "${email.subject}" to ${to.join(", ")} via ${setup.provider}`);
  await logEmail(to, email.subject, setup.provider, true);
}
