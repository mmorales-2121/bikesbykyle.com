import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "./db";
import { hashPassword, normalizeEmail } from "./customer";
import { hmac, safeEqual } from "./secret";

export const ADMIN_COOKIE = "bbk_admin";
const sign = (id: string) => `${id}.${hmac(`admin:${id}`)}`;

export async function startAdminSession(adminId: string) {
  (await cookies()).set(ADMIN_COOKIE, sign(adminId), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 14 });
}

/** The logged-in admin, or null. */
export async function getAdmin() {
  const value = (await cookies()).get(ADMIN_COOKIE)?.value;
  const id = value?.split(".")[0];
  if (!id || !safeEqual(value!, sign(id))) return null;
  return db.admin.findUnique({ where: { id } });
}

export async function isAdmin() {
  return Boolean(await getAdmin());
}

export async function requireAdmin() {
  const admin = await getAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}

/**
 * The first admin comes from ADMIN_EMAIL and ADMIN_PASSWORD, only while no admin exists yet.
 * Changing those values later does nothing; change passwords from the dashboard's Account tab.
 */
export async function ensureFirstAdmin() {
  const email = process.env.ADMIN_EMAIL, password = process.env.ADMIN_PASSWORD;
  if (!email || !password) return;
  if ((await db.admin.count()) > 0) return;
  await db.admin.create({ data: { email: normalizeEmail(email), passwordHash: hashPassword(password) } });
}
