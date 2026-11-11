import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const ADMIN_COOKIE = "bbk_admin";

export function adminToken() {
  const secret = process.env.SESSION_SECRET || "dev-secret";
  return createHmac("sha256", secret).update(process.env.ADMIN_PASSWORD || "").digest("hex");
}

export function checkPassword(input: string) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  const a = Buffer.from(input), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function isAdmin() {
  return Boolean(process.env.ADMIN_PASSWORD) && cookies().get(ADMIN_COOKIE)?.value === adminToken();
}

export function requireAdmin() {
  if (!isAdmin()) redirect("/admin/login");
}
