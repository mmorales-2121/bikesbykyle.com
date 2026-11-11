import { NextRequest, NextResponse } from "next/server";
import { getService } from "@/config/business";
import { getSlots } from "@/lib/availability";
import { isAway } from "@/lib/timeoff";
import { clientIp, MINUTE, take } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!take(`availability:${await clientIp()}`, 120, MINUTE)) return NextResponse.json({ error: "Too many requests. Please wait a minute and try again." }, { status: 429 });
  const service = getService(req.nextUrl.searchParams.get("service") ?? "");
  const day = req.nextUrl.searchParams.get("date") ?? "";
  if (!service) return NextResponse.json({ error: "Unknown service" }, { status: 400 });
  try {
    // Days off are closed to everyone; the reason stays private.
    if (/^\d{4}-\d{2}-\d{2}$/.test(day) && (await isAway(day))) return NextResponse.json({ slots: [], closed: true });
    const slots = await getSlots(service, day);
    return NextResponse.json({ slots: slots.map((s) => s.toISOString()) });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Could not load availability" }, { status: 500 });
  }
}
