import { createHmac, randomBytes, timingSafeEqual } from "crypto";

const g = globalThis as unknown as { __bbkFallbackSecret?: string; __bbkSecretWarned?: boolean };

/**
 * The key that signs login cookies and email links. Comes from SESSION_SECRET.
 * In production without one, we never fall back to a guessable value: we use a random key
 * for this run of the server (everyone gets logged out on restart) and log a loud warning.
 */
export function sessionSecret() {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 16) return s;
  if (process.env.NODE_ENV !== "production") return "dev-secret";
  if (!g.__bbkSecretWarned) {
    g.__bbkSecretWarned = true;
    console.error("[security] SESSION_SECRET is missing or shorter than 16 characters. Using a random key for now, so logins reset on every restart. Set SESSION_SECRET in Render > Environment.");
  }
  return (g.__bbkFallbackSecret ??= randomBytes(32).toString("hex"));
}

export const hmac = (data: string) => createHmac("sha256", sessionSecret()).update(data).digest("hex");

/** Compare two strings without leaking where they differ through timing. */
export function safeEqual(a: string, b: string) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
