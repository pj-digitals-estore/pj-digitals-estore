// Loyalty rules (pure, so they are tested). 1 point is worth Rs 1 when spent.

/** Points earned on an order: a percentage of what the customer paid for the goods, rounded down. */
export const earnPoints = (goodsPaid: number, percent: number) =>
  goodsPaid > 0 && percent > 0 ? Math.floor((goodsPaid * percent) / 100 + 1e-9) : 0;

/**
 * How many points can be spent on this cart. Never more than the balance, never more than maxPercent of the
 * goods (after any coupon), and nothing at all below the minimum.
 */
export const redeemablePoints = (o: { balance: number; goodsAfterCoupon: number; maxPercent: number; minPoints: number }) => {
  const cap = Math.floor((Math.max(0, o.goodsAfterCoupon) * Math.max(0, o.maxPercent)) / 100 + 1e-9);
  const n = Math.max(0, Math.min(Math.floor(o.balance), cap));
  return n >= Math.max(1, o.minPoints) ? n : 0;
};
