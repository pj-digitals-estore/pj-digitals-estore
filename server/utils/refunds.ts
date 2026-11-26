// Refund rules, kept pure (no database) so every case can be tested. Money is integer paise.
import { paiseOf } from "./money.js";

export const REFUND_REASONS: [string, string][] = [
  ["cancelled", "Order cancelled after payment"],
  ["item_issue", "Item missing, damaged or wrong"],
  ["delivery_failed", "Delivery failed"],
  ["price_adjustment", "Price adjustment"],
  ["other", "Other"],
];
export const refundReasonLabel = (code?: string) => REFUND_REASONS.find(([c]) => c === code)?.[1] ?? code ?? "";

export type RefundableOrder = { paymentStatus?: string; totalAmount?: number; refundedPaise?: number };

/** What the customer paid, in paise (0 if the order isn't paid). */
export const paidPaise = (order: RefundableOrder) => (order.paymentStatus === "paid" || order.paymentStatus === "refunded" ? paiseOf(order.totalAmount) : 0);

/** How much can still be refunded: paid, minus what was already refunded, minus refunds waiting to be paid out. */
export const refundablePaise = (order: RefundableOrder, pendingPaise = 0) =>
  Math.max(0, paidPaise(order) - Math.max(0, order.refundedPaise ?? 0) - Math.max(0, pendingPaise));

export type AmountCheck = { ok: true; paise: number } | { ok: false; error: string };

/** Admin types rupees (or nothing = the whole remaining amount). */
export const checkRefundAmount = (input: unknown, order: RefundableOrder, pendingPaise = 0): AmountCheck => {
  const left = refundablePaise(order, pendingPaise);
  if (paidPaise(order) === 0) return { ok: false, error: "This order has no online payment to refund." };
  if (left <= 0) return { ok: false, error: "Nothing left to refund on this order." };
  if (input === undefined || input === null || input === "") return { ok: true, paise: left };
  const n = Number(input);
  if (!Number.isFinite(n) || n <= 0) return { ok: false, error: "Enter a refund amount above zero." };
  const paise = paiseOf(n);
  if (paise < 1) return { ok: false, error: "Enter a refund amount above zero." };
  if (paise > left) return { ok: false, error: `The most that can still be refunded is ₹${(left / 100).toFixed(2)}.` };
  return { ok: true, paise };
};

/** The order's payment status after a refund of `refundedPaise` in total: fully refunded orders become "refunded". */
export const paymentStatusAfter = (order: RefundableOrder, refundedPaise: number) =>
  paidPaise(order) > 0 && refundedPaise >= paidPaise(order) ? "refunded" : "paid";

/** A transaction is not available on a plain (non replica set) MongoDB; the caller then runs without one. */
export const isNoTransactionSupport = (err: any) => {
  const msg = String(err?.message ?? "");
  return err?.code === 20 || /Transaction numbers are only allowed|replica set member or mongos|does not support transactions/i.test(msg);
};
