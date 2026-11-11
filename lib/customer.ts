import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { db } from "./db";
import { hmac, safeEqual } from "./secret";

export const CUSTOMER_COOKIE = "bbk_customer";

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

export function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const a = scryptSync(password, salt, 64), b = Buffer.from(hash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

const sign = (id: string) => `${id}.${hmac(`customer:${id}`)}`;

export async function startSession(customerId: string) {
  (await cookies()).set(CUSTOMER_COOKIE, sign(customerId), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 90 });
}

export async function endSession() {
  (await cookies()).delete(CUSTOMER_COOKIE);
}

/** The logged-in customer, or null. */
export async function getCustomer() {
  const value = (await cookies()).get(CUSTOMER_COOKIE)?.value;
  const id = value?.split(".")[0];
  if (!id || !safeEqual(value!, sign(id))) return null;
  const customer = await db.customer.findUnique({ where: { id } });
  // Accounts only work once the email address is confirmed.
  return customer?.emailVerifiedAt ? customer : null;
}

export const normalizeEmail = (e: string) => e.trim().toLowerCase();
