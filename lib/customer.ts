import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { db } from "./db";

export const CUSTOMER_COOKIE = "bbk_customer";
const secret = () => process.env.SESSION_SECRET || "dev-secret";

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

const sign = (id: string) => `${id}.${createHmac("sha256", secret()).update(`customer:${id}`).digest("hex")}`;

export function startSession(customerId: string) {
  cookies().set(CUSTOMER_COOKIE, sign(customerId), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 90 });
}

export function endSession() {
  cookies().delete(CUSTOMER_COOKIE);
}

/** The logged-in customer, or null. */
export async function getCustomer() {
  const value = cookies().get(CUSTOMER_COOKIE)?.value;
  const id = value?.split(".")[0];
  if (!id || value !== sign(id)) return null;
  return db.customer.findUnique({ where: { id } });
}

export const normalizeEmail = (e: string) => e.trim().toLowerCase();
