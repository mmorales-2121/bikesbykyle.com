"use client";
import { useEffect, useState } from "react";
import TipPicker from "@/components/TipPicker";

type Saved = { name: string; email: string; phone: string; bikeNotes: string } | null;

export default function BookingForm({ saved, serviceId, priceCents, minDate, maxDate, timeZone }: { saved: Saved; serviceId: string; priceCents: number; minDate: string; maxDate: string; timeZone: string }) {
  const [date, setDate] = useState(minDate);
  const [slots, setSlots] = useState<string[] | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [payment, setPayment] = useState<"ONLINE" | "AT_PICKUP">("ONLINE");
  const [tip, setTip] = useState(0);

  useEffect(() => {
    setSlots(null); setSlot(null); setError("");
    // Ignore answers for a date the customer has already moved away from.
    let current = true;
    fetch(`/api/availability?service=${serviceId}&date=${date}`)
      .then((r) => r.json())
      .then((d) => { if (current) (d.error ? setError(d.error) : setSlots(d.slots)); })
      .catch(() => { if (current) setError("Could not load times."); });
    return () => { current = false; };
  }, [serviceId, date]);

  const fmt = (iso: string) => new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit" }).format(new Date(iso));

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!slot) return setError("Please pick a time.");
    const f = new FormData(e.currentTarget);
    setBusy(true); setError("");
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ serviceId, start: slot, name: f.get("name"), email: f.get("email"), phone: f.get("phone"), notes: f.get("notes"), payment, tipCents: payment === "AT_PICKUP" ? tip : 0 }),
    });
    const data = await res.json().catch(() => ({}));
    if (data.url) return (window.location.href = data.url);
    setBusy(false);
    setError(data.error ?? "Something went wrong. Please try again.");
  }

  return (
    <form onSubmit={submit} className="card" style={{ marginTop: 20 }}>
      <label htmlFor="date">Date</label>
      <input id="date" type="date" value={date} min={minDate} max={maxDate} onChange={(e) => setDate(e.target.value)} />
      <label>Time</label>
      {slots === null && !error && <p className="muted">Loading times…</p>}
      {slots?.length === 0 && <p className="muted">No open times this day. Try another date.</p>}
      <div className="slots">
        {slots?.map((s) => (
          <button type="button" key={s} className={`slot ${slot === s ? "on" : ""}`} onClick={() => setSlot(s)}>{fmt(s)}</button>
        ))}
      </div>
      <label htmlFor="name">Your name</label>
      <input id="name" name="name" required defaultValue={saved?.name} autoComplete="name" />
      <label htmlFor="email">Email</label>
      <input id="email" name="email" type="email" required defaultValue={saved?.email} readOnly={Boolean(saved)} autoComplete="email" />
      <label htmlFor="phone">Phone (optional)</label>
      <input id="phone" name="phone" type="tel" defaultValue={saved?.phone} autoComplete="tel" />
      <label htmlFor="notes">Anything we should know? (optional)</label>
      <textarea id="notes" name="notes" rows={3} defaultValue={saved?.bikeNotes} />
      <label>How would you like to pay?</label>
      <div className="row">
        <label className={`slot ${payment === "ONLINE" ? "on" : ""}`} style={{ margin: 0 }}>
          <input type="radio" name="payment" value="ONLINE" checked={payment === "ONLINE"} onChange={() => setPayment("ONLINE")} style={{ width: "auto", marginRight: 6 }} />Pay online now
        </label>
        <label className={`slot ${payment === "AT_PICKUP" ? "on" : ""}`} style={{ margin: 0 }}>
          <input type="radio" name="payment" value="AT_PICKUP" checked={payment === "AT_PICKUP"} onChange={() => setPayment("AT_PICKUP")} style={{ width: "auto", marginRight: 6 }} />Pay at pickup
        </label>
      </div>
      {payment === "AT_PICKUP" && (<>
        <label>Add a tip? (paid at pickup)</label>
        <TipPicker priceCents={priceCents} value={tip} onChange={setTip} />
        <p className="muted">Due at pickup: {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format((priceCents + tip) / 100)}</p>
      </>)}
      {payment === "ONLINE" && <p className="muted">You can add a tip on the payment page.</p>}
      {error && <p className="error">{error}</p>}
      <p><button className="btn" disabled={busy || !slot}>{busy ? "One moment…" : payment === "ONLINE" ? "Continue to payment" : "Confirm booking"}</button></p>
    </form>
  );
}
