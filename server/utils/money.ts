/**
 * Money snapshot stored on every order at checkout (integer paise, so rounding can never drift).
 * Why: commission used to be worked out when a settlement was made, using the shop's rate THAT day, so
 * changing a rate silently changed what older orders had earned. The snapshot fixes the numbers at
 * the moment the customer ordered. Older orders have no snapshot and fall back to the old way.
 */
export const MONEY_VERSION = 1;

export type MoneySnapshot = {
  version: number;
  seller: "shop" | "platform";
  rateSource: "shop" | "platform_default" | "none";
  commissionRate: number; // 0.05 = 5%
  subtotalPaise: number;
  shippingPaise: number;
  taxPaise: number;
  totalPaise: number;
  discountPaise?: number; // coupon discount (paid by the platform; the shop is still owed sellerPaise)
  commissionPaise: number; // taken from the goods subtotal only (not delivery, not tax)
  sellerPaise: number; // subtotal - commission: what the shop is owed for the goods
};

export const paiseOf = (rupees: unknown) => {
  const n = Math.round(Number(rupees) * 100);
  return Number.isFinite(n) ? n + 0 : 0; // + 0 turns -0 into 0
};

/** Commission in paise for a goods subtotal. Never negative, never more than the subtotal. */
export const commissionPaiseOf = (subtotalPaise: number, rate: unknown) => {
  const r = Number(rate);
  if (!Number.isFinite(r) || r <= 0) return 0;
  return Math.min(subtotalPaise, Math.max(0, Math.round(subtotalPaise * r)));
};

export const buildMoney = (
  totals: { subtotal: number; shippingCost: number; tax: number; totalAmount: number; discount?: number },
  who: { seller: "shop" | "platform"; rate: unknown; source: MoneySnapshot["rateSource"] },
): MoneySnapshot => {
  const subtotalPaise = paiseOf(totals.subtotal);
  const platformOwned = who.seller === "platform";
  const rate = platformOwned ? 0 : Math.max(0, Number(who.rate) || 0);
  const commissionPaise = platformOwned ? 0 : commissionPaiseOf(subtotalPaise, rate);
  return {
    version: MONEY_VERSION,
    seller: who.seller,
    rateSource: platformOwned ? "none" : who.source,
    commissionRate: rate,
    subtotalPaise,
    shippingPaise: paiseOf(totals.shippingCost),
    taxPaise: paiseOf(totals.tax),
    totalPaise: paiseOf(totals.totalAmount),
    ...(totals.discount ? { discountPaise: paiseOf(totals.discount) } : {}),
    commissionPaise,
    sellerPaise: subtotalPaise - commissionPaise,
  };
};

/**
 * Commission for one order, in rupees. Uses the snapshot when the order has one; otherwise
 * (older orders) works it out from the rate given. `override` is an explicit admin rate that wins over both.
 */
export const orderCommission = (
  order: { subtotal: number; money?: Partial<MoneySnapshot> | null },
  fallbackRate: number,
  override?: number | null,
) => {
  const subtotalPaise = paiseOf(order.subtotal);
  if (override !== undefined && override !== null && Number.isFinite(Number(override))) {
    return { paise: commissionPaiseOf(subtotalPaise, override), snapshotted: false };
  }
  const m = order.money;
  if (m && typeof m.commissionPaise === "number") return { paise: m.commissionPaise, snapshotted: true };
  return { paise: commissionPaiseOf(subtotalPaise, fallbackRate), snapshotted: false };
};
