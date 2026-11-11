// Create (or reset the password of) an admin from the command line:
//   node scripts/create-admin.mjs you@example.com 'a-strong-password' "Your Name"
// On Render, run it from the service's Shell tab.
import { randomBytes, scryptSync } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const [email, password, name] = process.argv.slice(2);
if (!email || !password || password.length < 10) {
  console.error("Usage: node scripts/create-admin.mjs EMAIL PASSWORD [NAME]   (password: 10+ characters)");
  process.exit(1);
}
const salt = randomBytes(16).toString("hex");
const passwordHash = `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
const db = new PrismaClient();
const e = email.trim().toLowerCase();
await db.admin.upsert({ where: { email: e }, update: { passwordHash, ...(name ? { name } : {}) }, create: { email: e, passwordHash, name: name || null } });
console.log(`Admin ready: ${e}`);
await db.$disconnect();
