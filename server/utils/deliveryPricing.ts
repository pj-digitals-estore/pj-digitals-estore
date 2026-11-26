// Delivery pricing: ONE fee per checkout, worked out on the server from the delivery location's rules.
// Pure functions (no database) so every rule can be tested. Money here is rupees; splitting works in paise.

export type DeliveryRule = {
  enabled: boolean; // false = we don't deliver to this location right now
  fee: number; // delivery fee for the whole checkout
  freeAbove: number; // checkout subtotal at or above this is free to deliver (0 = no free-delivery offer)
  minOrder: number; // smallest checkout subtotal accepted (0 = none)
  location: string | null; // the rule's location name, null = the platform default
};

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

/** A location's own values win; anything it leaves empty falls back to the platform settings. */
export const ruleFor = (
  loc: { name?: string; deliveryEnabled?: boolean; deliveryFee?: number | null; freeAbove?: number | null; minOrder?: number | null } | null | undefined,
  settings: { shippingCost: number; freeShippingThreshold: number },
): DeliveryRule => ({
  enabled: loc ? loc.deliveryEnabled !== false : true,
  fee: num(loc?.deliveryFee) ?? (num(settings.shippingCost) ?? 0),
  freeAbove: num(loc?.freeAbove) ?? (num(settings.freeShippingThreshold) ?? 0),
  minOrder: num(loc?.minOrder) ?? 0,
  location: loc?.name ?? null,
});

export type DeliveryQuote = {
  ok: boolean;
  reason: string | null; // customer-facing, set when ok is false
  fee: number;
  freeAbove: number;
  addForFree: number | null; // how much more makes delivery free (null when already free or no offer)
  minOrder: number;
};

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export const quoteDelivery = (subtotal: number, rule: DeliveryRule): DeliveryQuote => {
  const where = rule.location ?? "your area";
  const base = { freeAbove: rule.freeAbove, minOrder: rule.minOrder };
  if (!rule.enabled) return { ...base, ok: false, reason: `We are not delivering to ${where} right now.`, fee: 0, addForFree: null };
  if (rule.minOrder > 0 && subtotal < rule.minOrder) {
    return { ...base, ok: false, reason: `The minimum order for ${where} is ₹${rule.minOrder}. Add ₹${r2(rule.minOrder - subtotal)} more.`, fee: 0, addForFree: null };
  }
  const free = rule.freeAbove > 0 && subtotal >= rule.freeAbove;
  const fee = free ? 0 : rule.fee;
  const addForFree = rule.freeAbove > 0 && !free && fee > 0 ? r2(rule.freeAbove - subtotal) : null;
  return { ...base, ok: true, reason: null, fee, addForFree };
};

/**
 * Shares one checkout fee across the shop orders (each order still needs a delivery amount for its own
 * slip, payout and refund). Proportional to each subtotal, in whole paise, so the parts always add up to
 * exactly the fee.
 */
export const splitFee = (fee: number, subtotals: number[]): number[] => {
  const total = Math.round(fee * 100);
  if (subtotals.length === 0) return [];
  const weights = subtotals.map((s) => Math.max(0, Math.round(s * 100)));
  const sum = weights.reduce((a, b) => a + b, 0);
  if (total === 0) return weights.map(() => 0);
  const raw = weights.map((w) => (sum > 0 ? (total * w) / sum : total / weights.length));
  const parts = raw.map(Math.floor);
  let left = total - parts.reduce((a, b) => a + b, 0);
  const byRemainder = raw.map((x, i) => [x - Math.floor(x), i] as const).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (let k = 0; left > 0; k = (k + 1) % byRemainder.length, left--) parts[byRemainder[k][1]]++;
  return parts.map((p) => p / 100);
};

/** Latitude/longitude from a client; null unless both are real coordinates (a "0,0" pin is treated as not set). */
export const cleanCoords = (lat: unknown, lng: unknown): { latitude: number; longitude: number } | null => {
  if (lat === null || lat === undefined || lat === "" || lng === null || lng === undefined || lng === "") return null;
  const a = Number(lat);
  const b = Number(lng);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  if (a < -90 || a > 90 || b < -180 || b > 180) return null;
  if (a === 0 && b === 0) return null;
  return { latitude: Math.round(a * 1e6) / 1e6, longitude: Math.round(b * 1e6) / 1e6 };
};
