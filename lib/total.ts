type Amounts = { priceCents: number; discountCents?: number | null; tipCents: number };

/** Service price after any promo discount, before tip. */
export const subtotalOf = (b: Amounts) => Math.max(0, b.priceCents - (b.discountCents ?? 0));

/** What the customer pays in total: service price, minus promo discount, plus tip. */
export const totalOf = (b: Amounts) => subtotalOf(b) + b.tipCents;
