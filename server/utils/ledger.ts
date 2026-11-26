import mongoose, { ClientSession } from "mongoose";
import LedgerEntry from "../models/LedgerEntry.js";
import { paiseOf } from "./money.js";
import { isNoTransactionSupport } from "./refunds.js";
import { reportError } from "./errorReport.js";

/**
 * Runs `fn` in a database transaction when MongoDB supports it (a replica set), so several writes
 * succeed or fail together. On a plain MongoDB it runs `fn` without one. `fn` may run more than once
 * (MongoDB retries a transaction on a transient error), so it must only touch the database.
 */
export const withTxn = async <T>(fn: (session: ClientSession | undefined) => Promise<T>): Promise<T> => {
  let session: ClientSession | undefined;
  try {
    session = await mongoose.startSession();
    let out!: T;
    await session.withTransaction(async () => {
      out = await fn(session);
    });
    return out;
  } catch (err) {
    if (isNoTransactionSupport(err)) return fn(undefined);
    throw err;
  } finally {
    await session?.endSession();
  }
};

const isDuplicate = (err: any) => err?.code === 11000;

/** Writes the "money in" entry for a paid order. Safe to call any number of times; never throws. */
export const recordPayment = async (order: any, by?: any) => {
  try {
    const paise = paiseOf(order?.totalAmount);
    if (!order?._id || paise < 1) return;
    await LedgerEntry.create({
      kind: "payment",
      order: order._id,
      shop: order.shop,
      amountPaise: paise,
      method: order.paymentMethod === "razorpay" ? "razorpay" : order.paymentMethod === "cod" ? "cod" : "manual",
      reference: order.razorpayPaymentId,
      by,
      uniqueKey: `payment:${order._id}`,
    });
  } catch (err) {
    if (isDuplicate(err)) return;
    console.error("recordPayment failed:", err);
    reportError(err, { tags: { where: "ledger.recordPayment" } });
  }
};
