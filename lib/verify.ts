import { db } from "./db";
import { sendEmail } from "./email";
import { layout, siteUrl } from "./notifications";
import { hmac, safeEqual } from "./secret";

/** How long a confirm-your-email link works. */
export const VERIFY_HOURS = 48;

type Pending = { id: string; email: string; name: string; passwordHash: string };

// The link is tied to the account's email and password, so it stops working if either changes.
const sig = (c: Pending, exp: number) => hmac(`verify:${c.id}:${c.email}:${c.passwordHash}:${exp}`);

const safeNext = (n: string) => (n.startsWith("/") && !n.startsWith("//") ? n : "/account");

export function verifyLink(c: Pending, next = "") {
  const exp = Date.now() + VERIFY_HOURS * 60 * 60 * 1000;
  const q = new URLSearchParams({ id: c.id, exp: String(exp), sig: sig(c, exp) });
  if (next) q.set("next", safeNext(next));
  return `${siteUrl()}/account/verify?${q}`;
}

/** The unconfirmed customer a link belongs to, or null if it is wrong, expired or already used. */
export async function checkVerifyLink(id: string, exp: string, s: string) {
  const expMs = Number(exp);
  if (!id || !s || !Number.isFinite(expMs) || expMs < Date.now()) return null;
  const c = await db.customer.findUnique({ where: { id } });
  if (!c || c.emailVerifiedAt || !safeEqual(s, sig(c, expMs))) return null;
  return c;
}

export { safeNext };

export async function sendVerifyEmail(c: Pending, next = "") {
  const link = verifyLink(c, next);
  const { html, text } = layout(
    "Confirm your email",
    `Hi ${c.name.split(" ")[0]}, tap the button below to finish creating your Bikes By Kyle account. Any earlier bookings made with this email will show up in your account once it's confirmed.`,
    [["Email", c.email], ["Link expires", `in ${VERIFY_HOURS} hours`]],
    { href: link, label: "Confirm my email" },
    "Didn't sign up? You can ignore this email and no account will be created.",
  );
  await sendEmail({ to: c.email, subject: "Confirm your email for Bikes By Kyle", html, text });
}

export async function sendAlreadyRegisteredEmail(c: { email: string; name: string }) {
  const { html, text } = layout(
    "You already have an account",
    `Hi ${c.name.split(" ")[0]}, someone (probably you) just tried to sign up with this email, but it already has an account. Log in with your existing password instead.`,
    [["Email", c.email]],
    { href: `${siteUrl()}/account/login`, label: "Log in" },
    "If this wasn't you, you can ignore this email. Your account hasn't changed.",
  );
  await sendEmail({ to: c.email, subject: "You already have a Bikes By Kyle account", html, text });
}
