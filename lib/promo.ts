import { business, formatPrice } from "@/config/business";
import { HOLD_MINUTES } from "./availability";
import { db } from "./db";
import { todayIn } from "./time";

export const normalizeCode = (s: string) => s.trim().toUpperCase().replace(/\s+/g, "");
export const CODE_PATTERN = /^[A-Z0-9_-]{3,24}$/;

type PromoLike = { kind: string; value: number };

/** How much the code takes off this price, never more than the price itself. */
export function discountFor(p: PromoLike, priceCents: number) {
  const off = p.kind === "PERCENT" ? Math.round((priceCents * p.value) / 100) : p.value;
  return Math.max(0, Math.min(priceCents, off));
}

export const promoLabel = (p: PromoLike) => (p.kind === "PERCENT" ? `${p.value}% off` : `${formatPrice(p.value)} off`);

/** Bookings that count as a use: everything except cancelled ones and unpaid online holds that ran out. */
export const countedUse = () => ({
  OR: [
    { status: { notIn: ["PENDING_PAYMENT", "CANCELLED"] } },
    { status: "PENDING_PAYMENT", createdAt: { gt: new Date(Date.now() - HOLD_MINUTES * 60000) } },
  ],
});

export async function usesOf(promoCodeId: string) {
  return db.booking.count({ where: { promoCodeId, ...countedUse() } });
}

export type PromoCheck =
  | { ok: true; promo: { id: string; code: string; kind: string; value: number }; discountCents: number; label: string }
  | { ok: false; error: string };

/** Checks a code typed by a customer against everything the owner set on it. */
export async function checkPromo(raw: string, opts: { priceCents: number; email?: string }): Promise<PromoCheck> {
  const code = normalizeCode(raw);
  if (!code) return { ok: false, error: "Enter a promo code." };
  const promo = CODE_PATTERN.test(code) ? await db.promoCode.findUnique({ where: { code } }) : null;
  if (!promo || !promo.active) return { ok: false, error: "That promo code isn't valid." };
  if (promo.expiresOn && todayIn(business.timeZone) > promo.expiresOn) return { ok: false, error: "That promo code has expired." };
  if (promo.maxUses != null && (await usesOf(promo.id)) >= promo.maxUses) return { ok: false, error: "That promo code has been used up." };
  const email = opts.email?.trim().toLowerCase();
  if (promo.onePerCustomer && email && (await db.booking.count({ where: { promoCodeId: promo.id, customerEmail: email, ...countedUse() } })) > 0) {
    return { ok: false, error: "You've already used this promo code." };
  }
  const discountCents = discountFor(promo, opts.priceCents);
  return { ok: true, promo, discountCents, label: promoLabel(promo) };
}
