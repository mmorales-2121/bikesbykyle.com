import { NextRequest, NextResponse } from "next/server";
import { getService } from "@/config/business";
import { getSlots } from "@/lib/availability";
import { clientIp, MINUTE, take } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!take(`availability:${await clientIp()}`, 120, MINUTE)) return NextResponse.json({ error: "Too many requests. Please wait a minute and try again." }, { status: 429 });
  const service = getService(req.nextUrl.searchParams.get("service") ?? "");
  const day = req.nextUrl.searchParams.get("date") ?? "";
  if (!service) return NextResponse.json({ error: "Unknown service" }, { status: 400 });
  try {
    const slots = await getSlots(service, day);
    return NextResponse.json({ slots: slots.map((s) => s.toISOString()) });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Could not load availability" }, { status: 500 });
  }
}
