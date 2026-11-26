import { round2 } from "./http.js";
import { splitFee } from "./deliveryPricing.js";
import type { PlatformSettings } from "./settings.js";

/**
 * All pricing rules live here so the order total is always computed on the
 * server (never trusted from the client). The values come from the platform
 * settings (editable by admins, with env variables as the defaults):
 * shippingCost, freeShippingThreshold (0 = off) and taxRate (0.18 = 18%).
 */
export const computeTotals = (
  subtotal: number,
  settings: Pick<PlatformSettings, "shippingCost" | "freeShippingThreshold" | "taxRate"> & Partial<Pick<PlatformSettings, "gstRegistered">>,
  /** When given, this is the delivery amount for the order (its share of the checkout's single fee) instead of the flat settings rule. */
  shippingOverride?: number,
  /** Coupon discount on the goods (platform-paid). Tax is worked out on what the customer actually pays for the goods. */
  discount = 0,
) => {
  const flat = Number(settings.shippingCost);
  const threshold = Number(settings.freeShippingThreshold);
  const taxRate = Number(settings.taxRate);

  const shippingCost =
    shippingOverride !== undefined
      ? shippingOverride
      : threshold > 0 && subtotal >= threshold ? 0 : Number.isFinite(flat) ? flat : 0;
  // An unregistered seller must not charge GST, so a leftover tax rate does nothing until GST is switched on.
  const off = Math.min(Math.max(0, round2(discount)), subtotal);
  const tax = settings.gstRegistered ? round2((subtotal - off) * (Number.isFinite(taxRate) ? taxRate : 0)) : 0;
  const totalAmount = round2(subtotal - off + shippingCost + tax);

  return { subtotal: round2(subtotal), discount: off, shippingCost, tax, totalAmount };
};

/**
 * Totals for every shop order of ONE checkout. The checkout has a single delivery fee (from the delivery
 * location's rule); each shop order carries its share so slips, payouts and refunds still add up.
 */
export const checkoutTotals = (subtotals: number[], fee: number, settings: Parameters<typeof computeTotals>[1], discount = 0) => {
  const shares = splitFee(fee, subtotals);
  const off = splitFee(discount, subtotals); // the coupon is shared across the shop orders the same way
  return subtotals.map((s, i) => computeTotals(s, settings, shares[i], off[i]));
};

/** Razorpay expects amounts in the smallest currency unit (paise). */
export const toPaise = (amount: number) => Math.round(amount * 100);

/** Cash-on-delivery rules. Returns a customer-facing reason when COD can't be used, else null. */
export const codBlockReason = (
  settings: Pick<PlatformSettings, "allowCod" | "codMaxAmount">,
  checkoutTotal: number,
): string | null => {
  if (!settings.allowCod) return "Cash on delivery is not available";
  const max = Number(settings.codMaxAmount);
  if (max > 0 && checkoutTotal > max) {
    return `Cash on delivery is available for orders up to ₹${max}. Please reduce your cart or contact the shop.`;
  }
  return null;
};
