"use client";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe, Stripe } from "@stripe/stripe-js";
import { useMemo, useState } from "react";
import TipPicker from "@/components/TipPicker";

const fmt = (c: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(c / 100);
// subtotalCents is the service price after any promo; tip suggestions use the full price (tipBaseCents).
type TipProps = { bookingId: string; token: string; subtotalCents: number; tipBaseCents: number; initialTipCents: number };

// Card fields are Stripe's own secure fields: card numbers go straight to Stripe and never touch our server.
function Inner({ returnUrl, bookingId, token, subtotalCents, tipBaseCents, initialTipCents }: { returnUrl: string } & TipProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [tip, setTip] = useState(initialTipCents);
  const [updating, setUpdating] = useState(false);

  async function changeTip(tipCents: number) {
    setTip(tipCents); setUpdating(true); setError("");
    const res = await fetch("/api/checkout/tip", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bookingId, token, tipCents }) });
    if (!res.ok) setError("Couldn't update the tip. Please try again.");
    await elements?.fetchUpdates();
    setUpdating(false);
  }

  async function pay(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setBusy(true); setError("");
    const { error } = await stripe.confirmPayment({ elements, confirmParams: { return_url: returnUrl || `${location.origin}/booking/success` } });
    // Only reached if payment failed; on success Stripe redirects to returnUrl.
    setError(error.message ?? "Payment failed. Please check your card details.");
    setBusy(false);
  }

  return (
    <form onSubmit={pay} className="card" style={{ marginTop: 16 }}>
      <label style={{ marginTop: 0 }}>Add a tip?</label>
      <TipPicker priceCents={tipBaseCents} value={tip} onChange={changeTip} disabled={busy} />
      <p style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid var(--line)", paddingTop: 10 }}>
        <strong>Total</strong><strong className="price">{fmt(subtotalCents + tip)}</strong>
      </p>
      <PaymentElement />
      {error && <p className="error">{error}</p>}
      <p><button className="btn" disabled={!stripe || busy || updating}>{busy ? "Processing…" : updating ? "Updating total…" : `Pay ${fmt(subtotalCents + tip)}`}</button></p>
      <p className="muted" style={{ fontSize: 13 }}>Payments are processed securely by Stripe.</p>
    </form>
  );
}

export default function PaymentForm({ clientSecret, publishableKey, returnUrl, ...tipProps }: { clientSecret: string; publishableKey: string; returnUrl: string } & TipProps) {
  const stripePromise = useMemo<Promise<Stripe | null>>(() => loadStripe(publishableKey), [publishableKey]);
  if (!publishableKey) return <p className="error">Payments aren't set up yet (missing NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY).</p>;
  return (
    <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: "night", variables: { colorPrimary: "#e0312b", colorBackground: "#171a1f", borderRadius: "6px" } } }}>
      <Inner returnUrl={returnUrl} {...tipProps} />
    </Elements>
  );
}
