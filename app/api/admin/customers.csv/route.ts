import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { getCustomerRows } from "@/lib/metrics";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Not allowed" }, { status: 401 });
  const rows = await getCustomerRows();
  const cell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [
    ["Name", "Email", "Phone", "Bike", "Account", "Bookings", "Spent (USD)", "Last visit", "Last service"].map(cell).join(","),
    ...rows.map((r) => [r.name, r.email, r.phone, r.bikeNotes, r.hasAccount ? "yes" : "no", r.bookings, (r.spent / 100).toFixed(2), r.last?.toISOString().slice(0, 10) ?? "", r.lastService].map(cell).join(",")),
  ].join("\n");
  return new NextResponse(csv, { headers: { "Content-Type": "text/csv", "Content-Disposition": 'attachment; filename="customers.csv"' } });
}
