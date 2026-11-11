"use client";
import { useState } from "react";

import { MAX_TIP_CENTS } from "@/lib/tip";
const fmt = (c: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(c / 100);

/** Tip buttons: none, 10/15/20% of the service price, or a custom dollar amount. */
export default function TipPicker({ priceCents, value, onChange, disabled }: { priceCents: number; value: number; onChange: (tipCents: number) => void; disabled?: boolean }) {
  const options = [0, 10, 15, 20].map((pct) => ({ pct, cents: Math.round((priceCents * pct) / 100) }));
  const isPreset = options.some((o) => o.cents === value);
  const [custom, setCustom] = useState(!isPreset);
  return (
    <div>
      <div className="slots" style={{ marginTop: 0 }}>
        {options.map((o) => (
          <button type="button" key={o.pct} disabled={disabled} className={`slot ${!custom && value === o.cents ? "on" : ""}`}
            onClick={() => { setCustom(false); onChange(o.cents); }}>
            {o.pct === 0 ? "No tip" : `${o.pct}% · ${fmt(o.cents)}`}
          </button>
        ))}
        <button type="button" disabled={disabled} className={`slot ${custom ? "on" : ""}`} onClick={() => setCustom(true)}>Custom</button>
      </div>
      {custom && (
        <input type="number" min={0} max={MAX_TIP_CENTS / 100} step="0.01" inputMode="decimal" placeholder="Tip amount in dollars" disabled={disabled}
          defaultValue={value ? value / 100 : ""} style={{ maxWidth: 220 }}
          onChange={(e) => onChange(Math.min(MAX_TIP_CENTS, Math.max(0, Math.round(Number(e.target.value || 0) * 100))))} />
      )}
    </div>
  );
}
