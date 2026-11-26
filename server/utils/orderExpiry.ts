import Order from "../models/Order.js";
import { restoreOrderStock } from "./orderHelpers.js";
import { notify } from "./notify.js";
import { releaseCoupon } from "./couponService.js";
import { clampExpiryMinutes } from "./jobLoop.js";

/**
 * Cancels online orders that were never paid and gives their stock back.
 * Each order is switched with ONE conditional update ("still pending?"), so an order whose payment
 * arrives at the same moment is never turned into a cancelled one after being paid.
 */
export const expireUnpaidOrders = async (minutesRaw?: unknown) => {
  const minutes = clampExpiryMinutes(minutesRaw);
  const cutoff = new Date(Date.now() - minutes * 60 * 1000);
  const candidates: any[] = await Order.find({
    paymentMethod: "razorpay",
    paymentStatus: "pending",
    orderStatus: { $in: ["placed", "processing"] },
    createdAt: { $lt: cutoff },
  })
    .select("_id")
    .limit(200)
    .lean();

  let expired = 0;
  for (const c of candidates) {
    const order: any = await Order.findOneAndUpdate(
      { _id: c._id, paymentStatus: "pending", orderStatus: { $in: ["placed", "processing"] } },
      { orderStatus: "cancelled", paymentStatus: "failed", cancelledAt: new Date() },
      { new: true },
    );
    if (!order) continue; // paid or changed in the meantime: leave it alone
    await restoreOrderStock(order._id);
    if (order.checkoutId) await releaseCoupon(order.checkoutId).catch(() => {});
    await notify(order.user, {
      type: "payment",
      title: "Order cancelled - payment not completed",
      body: order.orderNumber,
      data: { orderId: order._id },
    }).catch(() => {});
    expired += 1;
  }
  return { expired, minutes };
};
