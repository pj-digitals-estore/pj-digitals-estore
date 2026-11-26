// Coupon rules, pure (no database) so each case is testable. Money in rupees, rounded to paise.

export type CouponRule = {
  isActive?: boolean;
  type: "percent" | "flat";
  value: number;
  maxDiscount?: number | null;
  minOrder?: number | null;
  startsAt?: Date | string | null;
  expiresAt?: Date | string | null;
  usageLimit?: number | null;
  usedCount?: number;
  perUserLimit?: number | null;
  firstOrderOnly?: boolean;
};

export type CouponCheck = { ok: true; discount: number } | { ok: false; reason: string };

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** "save10 " -> "SAVE10"; null when it isn't a usable code (3-20 letters, digits, - or _). */
export const normalizeCode = (raw: unknown): string | null => {
  const c = String(raw ?? "").trim().toUpperCase();
  return /^[A-Z0-9_-]{3,20}$/.test(c) ? c : null;
};

/** The discount a coupon gives on a goods total (never more than the total itself). */
export const discountFor = (rule: Pick<CouponRule, "type" | "value" | "maxDiscount">, subtotal: number) => {
  const raw = rule.type === "percent" ? (subtotal * Math.min(100, Math.max(0, rule.value))) / 100 : rule.value;
  const capped = rule.type === "percent" && rule.maxDiscount != null && rule.maxDiscount > 0 ? Math.min(raw, rule.maxDiscount) : raw;
  return r2(Math.max(0, Math.min(capped, subtotal)));
};

export const checkCoupon = (
  rule: CouponRule,
  ctx: { subtotal: number; now?: Date; userUses: number; userOrders: number },
): CouponCheck => {
  const now = ctx.now ?? new Date();
  if (rule.isActive === false) return { ok: false, reason: "This coupon is not active." };
  if (rule.startsAt && new Date(rule.startsAt) > now) return { ok: false, reason: "This coupon is not valid yet." };
  if (rule.expiresAt && new Date(rule.expiresAt) < now) return { ok: false, reason: "This coupon has expired." };
  if (rule.usageLimit != null && (rule.usedCount ?? 0) >= rule.usageLimit) return { ok: false, reason: "This coupon has been fully used." };
  if (ctx.userUses >= (rule.perUserLimit ?? 1)) return { ok: false, reason: "You have already used this coupon." };
  if (rule.firstOrderOnly && ctx.userOrders > 0) return { ok: false, reason: "This coupon is only for your first order." };
  const min = Number(rule.minOrder) || 0;
  if (ctx.subtotal < min) return { ok: false, reason: `Add ₹${r2(min - ctx.subtotal)} more to use this coupon (minimum ₹${min}).` };
  const discount = discountFor(rule, ctx.subtotal);
  if (discount <= 0) return { ok: false, reason: "This coupon gives no discount on your cart." };
  return { ok: true, discount };
};
