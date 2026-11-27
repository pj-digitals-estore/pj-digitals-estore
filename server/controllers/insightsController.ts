import { Request, Response } from "express";
import Order from "../models/Order.js";
import LedgerEntry from "../models/LedgerEntry.js";
import { round2, sendError } from "../utils/http.js";
import { headline } from "../utils/insights.js";

const DAY = 24 * 60 * 60 * 1000;
const rangeOf = (req: Request) => {
  const to = req.query.to ? new Date(String(req.query.to)) : new Date();
  if (req.query.to && /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.to))) to.setUTCHours(23, 59, 59, 999);
  const from = req.query.from ? new Date(String(req.query.from)) : new Date(to.getTime() - 30 * DAY);
  return { from, to };
};

// GET /api/admin/reports/insights?from=&to=
// One call for the Insights screen: headline numbers, top products, areas, coupons, payment methods.
export const insightsReport = async (req: Request, res: Response) => {
  try {
    const { from, to } = rangeOf(req);
    const inRange = { createdAt: { $gte: from, $lte: to } };
    const live = { ...inRange, orderStatus: { $ne: "cancelled" } };

    const [sums, cancelled, refunds, topProducts, areas, coupons, methods, rangeUsers] = await Promise.all([
      Order.aggregate([{ $match: live }, { $group: { _id: null, orders: { $sum: 1 }, gross: { $sum: "$totalAmount" }, goods: { $sum: "$subtotal" }, delivery: { $sum: "$shippingCost" }, discount: { $sum: { $ifNull: ["$discount", 0] } } } }]),
      Order.countDocuments({ ...inRange, orderStatus: "cancelled" }),
      LedgerEntry.aggregate([{ $match: { kind: "refund", createdAt: { $gte: from, $lte: to } } }, { $group: { _id: null, p: { $sum: "$amountPaise" } } }]),
      Order.aggregate([
        { $match: live }, { $unwind: "$items" },
        { $group: { _id: "$items.product", name: { $first: "$items.name" }, qty: { $sum: "$items.quantity" }, revenue: { $sum: { $multiply: ["$items.price", "$items.quantity"] } } } },
        { $sort: { revenue: -1 } }, { $limit: 10 },
      ]),
      Order.aggregate([
        { $match: live },
        { $group: { _id: { $ifNull: ["$shippingAddress.location", "Unknown"] }, orders: { $sum: 1 }, gross: { $sum: "$totalAmount" } } },
        { $sort: { gross: -1 } }, { $limit: 20 },
      ]),
      Order.aggregate([
        { $match: { ...live, couponCode: { $exists: true, $ne: null } } },
        { $group: { _id: "$couponCode", orders: { $sum: 1 }, discount: { $sum: { $subtract: [{ $ifNull: ["$discount", 0] }, { $ifNull: ["$pointsDiscount", 0] }] } }, gross: { $sum: "$totalAmount" } } },
        { $sort: { discount: -1 } }, { $limit: 20 },
      ]),
      Order.aggregate([{ $match: live }, { $group: { _id: "$paymentMethod", orders: { $sum: 1 }, gross: { $sum: "$totalAmount" } } }, { $sort: { gross: -1 } }]),
      Order.distinct("user", live),
    ]);

    // repeat customers: ordered in the range AND had an earlier (non-cancelled) order
    const returning = rangeUsers.length
      ? (await Order.distinct("user", { user: { $in: rangeUsers }, createdAt: { $lt: from }, orderStatus: { $ne: "cancelled" } })).length
      : 0;

    const s = sums[0] ?? { orders: 0, gross: 0, goods: 0, delivery: 0, discount: 0 };
    res.json({
      success: true,
      data: {
        from, to,
        headline: headline({ ...s, cancelled, refunded: (refunds[0]?.p ?? 0) / 100, customers: rangeUsers.length, repeatCustomers: returning }),
        topProducts: topProducts.map((p: any) => ({ product: p._id, name: p.name, qty: p.qty, revenue: round2(p.revenue) })),
        areas: areas.map((a: any) => ({ area: a._id, orders: a.orders, gross: round2(a.gross) })),
        coupons: coupons.map((c: any) => ({ code: c._id, orders: c.orders, discount: round2(c.discount), gross: round2(c.gross) })),
        methods: methods.map((m: any) => ({ method: m._id, orders: m.orders, gross: round2(m.gross) })),
      },
    });
  } catch (error) {
    sendError(res, error, "Failed to build insights");
  }
};
