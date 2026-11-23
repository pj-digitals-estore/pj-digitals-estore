import { round2 } from "./http.js";
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
) => {
  const flat = Number(settings.shippingCost);
  const threshold = Number(settings.freeShippingThreshold);
  const taxRate = Number(settings.taxRate);

  const shippingCost =
    threshold > 0 && subtotal >= threshold ? 0 : Number.isFinite(flat) ? flat : 0;
  // An unregistered seller must not charge GST, so a leftover tax rate does nothing until GST is switched on.
  const tax = settings.gstRegistered ? round2(subtotal * (Number.isFinite(taxRate) ? taxRate : 0)) : 0;
  const totalAmount = round2(subtotal + shippingCost + tax);

  return { subtotal: round2(subtotal), shippingCost, tax, totalAmount };
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
