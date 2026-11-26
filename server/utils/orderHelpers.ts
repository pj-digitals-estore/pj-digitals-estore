import Product from "../models/Products.js";
import Order from "../models/Order.js";
import Delivery from "../models/Delivery.js";
import { CANCEL_REASONS, IOrder, OrderStatus } from "../types/index.js";
import { HttpError } from "./http.js";
import { logMovements } from "./stockLog.js";
import { recordPayment } from "./ledger.js";

export const generateOrderNumber = () =>
  "ORD-" +
  Date.now().toString(36).toUpperCase() +
  "-" +
  Math.random().toString(36).slice(2, 6).toUpperCase();

export const generateCheckoutId = () =>
  "CHK-" + Date.now().toString(36).toUpperCase() + "-" + Math.random().toString(36).slice(2, 8).toUpperCase();

type StockLine = { product: any; quantity: number };

export const restoreStockLines = async (lines: StockLine[], opts: { log?: boolean } = {}) => {
  await Promise.all(
    lines.map((l) =>
      Product.updateOne({ _id: l.product }, { $inc: { stock: l.quantity } }),
    ),
  );
  if (opts.log !== false) {
    await logMovements(lines.map((l) => ({ product: l.product, delta: l.quantity, reason: "cancel" as const })));
  }
};

/**
 * Atomically decrements stock for every line. If any line can't be satisfied,
 * everything already reserved is rolled back.
 */
export const reserveStock = async (
  lines: StockLine[],
): Promise<{ ok: true } | { ok: false; productId: any }> => {
  const reserved: StockLine[] = [];
  for (const line of lines) {
    const result = await Product.updateOne(
      { _id: line.product, isActive: true, stock: { $gte: line.quantity } },
      { $inc: { stock: -line.quantity } },
    );
    if (result.modifiedCount !== 1) {
      await restoreStockLines(reserved, { log: false }); // nothing was logged yet, so nothing to un-log
      return { ok: false, productId: line.product };
    }
    reserved.push(line);
  }
  await logMovements(reserved.map((l) => ({ product: l.product, delta: -l.quantity, reason: "sale" as const })));
  return { ok: true };
};

/** Idempotent: restores stock for an order at most once. */
export const restoreOrderStock = async (orderId: any) => {
  const order = await Order.findOneAndUpdate(
    { _id: orderId, stockRestored: { $ne: true } },
    { stockRestored: true },
    { new: true },
  );
  if (!order) return false;
  await restoreStockLines(order.items.map((i) => ({ product: i.product, quantity: i.quantity })));
  return true;
};

/**
 * Idempotent "payment succeeded" transition for ONE order.
 */
export const markOrderPaid = async (
  orderId: any,
  payment: { razorpayPaymentId?: string; razorpaySignature?: string } = {},
): Promise<IOrder | null> => {
  const order = await Order.findOneAndUpdate(
    { _id: orderId, paymentStatus: { $ne: "paid" }, orderStatus: { $ne: "cancelled" } },
    {
      paymentStatus: "paid",
      paidAt: new Date(),
      ...(payment.razorpayPaymentId && { razorpayPaymentId: payment.razorpayPaymentId }),
      ...(payment.razorpaySignature && { razorpaySignature: payment.razorpaySignature }),
    },
    { new: true },
  );
  if (order) await recordPayment(order); // the money book (never throws)
  return order;
};

/**
 * Razorpay pays for a whole checkout (which can contain one order per shop)
 * with ONE Razorpay order. Call this from the verify endpoint and the webhook.
 */
export const markCheckoutPaid = async (
  razorpayOrderId: string,
  payment: { razorpayPaymentId?: string; razorpaySignature?: string } = {},
) => {
  await Order.updateMany(
    { razorpayOrderId, paymentStatus: { $ne: "paid" }, orderStatus: { $ne: "cancelled" } },
    {
      paymentStatus: "paid",
      paidAt: new Date(),
      ...(payment.razorpayPaymentId && { razorpayPaymentId: payment.razorpayPaymentId }),
      ...(payment.razorpaySignature && { razorpaySignature: payment.razorpaySignature }),
    },
  );
  const orders = await Order.find({ razorpayOrderId });
  // write the money-in entry for every paid order of the checkout (a repeat is ignored)
  for (const o of orders) if (o.paymentStatus === "paid") await recordPayment(o);
  return orders;
};

// Which status changes each kind of actor may make
const TRANSITIONS: Record<string, Record<string, OrderStatus[]>> = {
  shop: {
    placed: ["processing", "cancelled"],
    processing: ["cancelled"],
  },
  admin: {
    placed: ["processing", "shipping", "delivered", "cancelled"],
    processing: ["shipping", "delivered", "cancelled"],
    shipping: ["delivered", "cancelled"],
  },
  system: {
    // driver actions (set by the delivery workflow)
    placed: ["shipping", "delivered"],
    processing: ["shipping", "delivered"],
    shipping: ["delivered"],
  },
};

/**
 * Single place that moves an order to a new status and applies side effects
 * (timestamps, COD collection, stock restore on cancel). Does not notify.
 */
export const transitionOrder = async (
  order: any,
  next: OrderStatus,
  actor: "shop" | "admin" | "system",
  cancel?: { reason?: string; note?: string; by?: "customer" | "shop" | "admin" | "system" },
) => {
  if (next === order.orderStatus) return order;
  const allowed = TRANSITIONS[actor][order.orderStatus] || [];
  if (!allowed.includes(next)) {
    throw new HttpError(
      400,
      `Order can't move from "${order.orderStatus}" to "${next}"`,
    );
  }

  order.orderStatus = next;

  if (next === "delivered") {
    order.deliveredAt = new Date();
    // cash is collected on delivery
    if (order.paymentMethod === "cod" && order.paymentStatus === "pending") {
      order.paymentStatus = "paid";
      order.paidAt = new Date();
    }
  }
  if (next === "cancelled") {
    order.cancelledAt = new Date();
    order.cancelledBy = cancel?.by ?? (actor === "shop" ? "shop" : actor === "admin" ? "admin" : "system");
    if (cancel?.reason) order.cancelReason = cancel.reason;
    if (cancel?.note) order.cancelNote = cancel.note;
    // an active delivery for a cancelled order is cancelled too
    await Delivery.updateOne(
      { order: order._id, status: { $in: ["assigned", "accepted", "picked_up", "on_the_way"] } },
      { status: "cancelled", $push: { timeline: { status: "cancelled", at: new Date(), note: "Order cancelled" } } },
    );
  }

  await order.save();
  if (next === "delivered" && order.paymentMethod === "cod" && order.paymentStatus === "paid") await recordPayment(order);
  if (next === "cancelled") await restoreOrderStock(order._id);
  return order;
};

/** Adds `delivery` (status, driver name/phone/location) to plain order objects. */
export const attachDeliveries = async (orders: any[]) => {
  if (!orders.length) return [];
  const deliveries: any[] = await Delivery.find({
    order: { $in: orders.map((o) => o._id) },
  }).populate("driver", "fullName phone vehicleType vehicleNumber currentLocation");
  const byOrder = new Map(deliveries.map((d) => [d.order.toString(), d]));
  return orders.map((o) => {
    const obj = typeof o.toObject === "function" ? o.toObject() : o;
    return { ...obj, delivery: byOrder.get(o._id.toString()) ?? null };
  });
};

/** Reads { reason, note } from a request body. The reason must be one of the allowed codes for that actor. */
export const readCancelInfo = (
  body: any,
  actor: "customer" | "shop",
  { required = false }: { required?: boolean } = {},
): { reason?: string; note?: string; error?: string } => {
  const allowed = CANCEL_REASONS[actor].map(([code]) => code as string);
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
  const note = typeof body?.note === "string" ? body.note.trim().slice(0, 200) : "";
  if (!reason) return required ? { error: "Please choose a reason for cancelling." } : { note: note || undefined };
  if (!allowed.includes(reason)) return { error: "That cancellation reason isn't valid." };
  if (reason === "other" && required && !note) return { error: "Please add a short note for \"Other\"." };
  return { reason, note: note || undefined };
};

export const cancelReasonLabel = (actor: "customer" | "shop", code?: string) =>
  CANCEL_REASONS[actor].find(([c]) => c === code)?.[1];
