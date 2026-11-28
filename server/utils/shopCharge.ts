// How much of a refund the shop gives back, and how much of that fits in one settlement (pure, tested).

type ChargeOrder = {
  shop?: unknown; orderStatus?: string; settlement?: unknown;
  subtotal?: number;
  money?: { subtotalPaise?: number; sellerPaise?: number } | null;
};

/**
 * The shop's share of a refund, in paise. Only goods are the shop's: delivery and tax are not. The shop was
 * paid goods minus commission, so it gives back the same share of what is refunded.
 * 0 when: no shop, the order was never delivered (never in a payout), or the order is fully refunded and was never
 * settled (it then drops out of the settlement by itself, nothing to take back).
 */
export const shopChargePaise = (a: { refundPaise: number; order: ChargeOrder; fullyRefunded: boolean }): number => {
  const o = a.order;
  if (!o.shop || o.orderStatus !== "delivered") return 0;
  if (a.fullyRefunded && !o.settlement) return 0;
  const goodsPaise = o.money?.subtotalPaise ?? Math.round((o.subtotal ?? 0) * 100);
  if (goodsPaise <= 0 || a.refundPaise <= 0) return 0;
  const ratio = o.money?.subtotalPaise && o.money?.sellerPaise != null ? o.money.sellerPaise / o.money.subtotalPaise : 1;
  return Math.max(0, Math.round(Math.min(a.refundPaise, goodsPaise) * ratio));
};

/**
 * Takes charges oldest first while they fit in what the settlement can pay. A charge that does not fit stays
 * pending for the next settlement (the shop is never left with a negative payout).
 */
export const fitCharges = <T extends { amountPaise: number }>(charges: T[], availablePaise: number) => {
  let left = Math.max(0, Math.floor(availablePaise));
  const applied: T[] = [], waiting: T[] = [];
  for (const c of charges) {
    if (c.amountPaise <= left) { applied.push(c); left -= c.amountPaise; } else waiting.push(c);
  }
  return { applied, waiting, totalPaise: applied.reduce((s, c) => s + c.amountPaise, 0) };
};
