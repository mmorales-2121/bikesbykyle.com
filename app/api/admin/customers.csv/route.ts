import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { getCustomerRows } from "@/lib/metrics";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Not allowed" }, { status: 401 });
  const rows = await getCustomerRows();
  // Quote every cell, and stop spreadsheet apps from running anything a customer typed as a formula.
  const cell = (v: unknown) => {
    let s = String(v ?? "");
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
  };
  const csv = [
    ["Name", "Email", "Phone", "Bike", "Account", "Bookings", "Spent (USD)", "Last visit", "Last service"].map(cell).join(","),
    ...rows.map((r) => [r.name, r.email, r.phone, r.bikeNotes, r.hasAccount ? "yes" : "no", r.bookings, (r.spent / 100).toFixed(2), r.last?.toISOString().slice(0, 10) ?? "", r.lastService].map(cell).join(",")),
  ].join("\n");
  return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Cache-Control": "no-store", "Content-Disposition": 'attachment; filename="customers.csv"' } });
}
