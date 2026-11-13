"use client";
import { useEffect, useRef, useState } from "react";
import TipPicker from "@/components/TipPicker";

type Saved = { name: string; email: string; phone: string; bikeNotes: string } | null;

export default function BookingForm({ saved, serviceId, priceCents, minDate, maxDate, timeZone }: { saved: Saved; serviceId: string; priceCents: number; minDate: string; maxDate: string; timeZone: string }) {
  const [date, setDate] = useState(minDate);
  const [slots, setSlots] = useState<string[] | null>(null);
  const [closed, setClosed] = useState(false);
  const [slot, setSlot] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [payment, setPayment] = useState<"ONLINE" | "AT_PICKUP">("ONLINE");
  const [tip, setTip] = useState(0);
  const [promoInput, setPromoInput] = useState("");
  const [promo, setPromo] = useState<{ code: string; label: string; discountCents: number } | null>(null);
  const [promoMsg, setPromoMsg] = useState("");
  const [checkingPromo, setCheckingPromo] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const money = (c: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(c / 100);
  const subtotal = priceCents - (promo?.discountCents ?? 0);
  const freeNow = payment === "ONLINE" && subtotal === 0;

  async function applyPromo() {
    if (!promoInput.trim()) return;
    setCheckingPromo(true); setPromoMsg("");
    const email = (formRef.current?.elements.namedItem("email") as HTMLInputElement | null)?.value ?? "";
    const res = await fetch("/api/promo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: promoInput, serviceId, email }) }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    setCheckingPromo(false);
    if (res?.ok && data.code) { setPromo(data); setPromoInput(""); }
    else { setPromo(null); setPromoMsg(data.error ?? "Couldn't check that code. Please try again."); }
  }

  useEffect(() => {
    setSlots(null); setSlot(null); setError(""); setClosed(false);
    // Ignore answers for a date the customer has already moved away from.
    let current = true;
    fetch(`/api/availability?service=${serviceId}&date=${date}`)
      .then((r) => r.json())
      .then((d) => { if (current) { if (d.error) setError(d.error); else { setSlots(d.slots); setClosed(Boolean(d.closed)); } } })
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
      body: JSON.stringify({ serviceId, start: slot, name: f.get("name"), email: f.get("email"), phone: f.get("phone"), notes: f.get("notes"), payment, tipCents: payment === "AT_PICKUP" ? tip : 0, promoCode: promo?.code ?? "" }),
    });
    const data = await res.json().catch(() => ({}));
    if (data.url) return (window.location.href = data.url);
    setBusy(false);
    if (data.promoError) { setPromo(null); setPromoMsg(data.error); }
    setError(data.error ?? "Something went wrong. Please try again.");
  }

  return (
    <form ref={formRef} onSubmit={submit} className="card" style={{ marginTop: 20 }}>
      <label htmlFor="date">Date</label>
      <input id="date" type="date" value={date} min={minDate} max={maxDate} onChange={(e) => setDate(e.target.value)} />
      <label>Time</label>
      {slots === null && !error && <p className="muted">Loading times…</p>}
      {slots?.length === 0 && <p className="muted">{closed ? "The shop is closed this day. Please pick another date." : "No open times this day. Try another date."}</p>}
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
      <label htmlFor="promo">Promo code (optional)</label>
      {promo ? (
        <p className="row" style={{ margin: 0 }}>
          <span className="badge" style={{ background: "var(--accent)", color: "var(--accent-text)" }}>{promo.code}</span>
          <span className="ok">{promo.label} applied: −{money(promo.discountCents)}</span>
          <button type="button" className="linkish" onClick={() => { setPromo(null); setPromoMsg(""); }}>Remove</button>
        </p>
      ) : (
        <div className="row">
          <input id="promo" value={promoInput} onChange={(e) => setPromoInput(e.target.value.toUpperCase())} placeholder="Enter code" autoComplete="off" autoCapitalize="characters" maxLength={24}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyPromo(); } }} style={{ flex: 1, minWidth: 160, textTransform: "uppercase" }} />
          <button type="button" className="btn secondary" onClick={applyPromo} disabled={checkingPromo || !promoInput.trim()}>{checkingPromo ? "Checking…" : "Apply"}</button>
        </div>
      )}
      {promoMsg && <p className="error" style={{ margin: "6px 0 0" }}>{promoMsg}</p>}
      {payment === "AT_PICKUP" && (<>
        <label>Add a tip? (paid at pickup)</label>
        <TipPicker priceCents={priceCents} value={tip} onChange={setTip} />
      </>)}
      <div className="summary">
        <p><span>Service</span><span>{money(priceCents)}</span></p>
        {promo && <p className="ok"><span>Promo {promo.code}</span><span>−{money(promo.discountCents)}</span></p>}
        {payment === "AT_PICKUP" && tip > 0 && <p><span>Tip</span><span>{money(tip)}</span></p>}
        <p className="total"><strong>{payment === "AT_PICKUP" ? "Due at pickup" : "Due now"}</strong><strong>{money(subtotal + (payment === "AT_PICKUP" ? tip : 0))}</strong></p>
      </div>
      {payment === "ONLINE" && <p className="muted">{freeNow ? "Nothing to pay now. Your booking is confirmed right away, and you can tip at pickup." : "You can add a tip on the payment page."}</p>}
      {error && <p className="error">{error}</p>}
      <p><button className="btn" disabled={busy || !slot}>{busy ? "One moment…" : payment === "ONLINE" && !freeNow ? "Continue to payment" : "Confirm booking"}</button></p>
    </form>
  );
}
