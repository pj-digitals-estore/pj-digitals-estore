import Order from "../models/Order.js";
import Counter from "../models/Counter.js";
import { withTxn } from "./ledger.js";
import { financialYear, formatInvoiceNumber } from "./invoiceNumber.js";

/**
 * Gives a delivered order its invoice number (once). The counter and the order are updated in ONE
 * transaction, so a lost race can never leave a gap in the series. On a plain MongoDB (no transactions)
 * a gap is possible in the rare case two requests race for the same order.
 * Returns the order, or null when it can't be invoiced (not found / not delivered).
 */
export const ensureInvoice = async (orderId: any) => {
  const existing: any = await Order.findById(orderId);
  if (!existing || existing.orderStatus !== "delivered") return null;
  if (existing.invoiceNumber) return existing;

  const when = existing.deliveredAt ?? new Date();
  const fy = financialYear(when);
  const prefix = process.env.INVOICE_PREFIX || "INV";
  await withTxn(async (session) => {
    const opts = session ? { session } : {};
    const fresh: any = await Order.findById(orderId, "invoiceNumber", opts);
    if (!fresh || fresh.invoiceNumber) return; // someone else just did it: take no number
    const counter: any = await Counter.findOneAndUpdate({ key: `invoice:${fy}` }, { $inc: { seq: 1 } }, { upsert: true, new: true, ...opts });
    await Order.updateOne({ _id: orderId, invoiceNumber: { $exists: false } }, { invoiceNumber: formatInvoiceNumber(prefix, fy, counter.seq), invoiceDate: when }, opts);
  });
  return Order.findById(orderId);
};
