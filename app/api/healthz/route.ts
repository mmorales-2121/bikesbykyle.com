import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Render checks this to know the site is up.
export async function GET() {
  await db.$queryRaw`SELECT 1`;
  return NextResponse.json({ ok: true });
}
