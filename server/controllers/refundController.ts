import { Request, Response } from "express";
import Order from "../models/Order.js";
import Refund from "../models/Refund.js";
import LedgerEntry from "../models/LedgerEntry.js";
import { HttpError, sendError } from "../utils/http.js";
import { logActivity } from "../utils/activity.js";
import { notify } from "../utils/notify.js";
import { recordPayment, withTxn } from "../utils/ledger.js";
import { checkRefundAmount, paidPaise, paymentStatusAfter, REFUND_REASONS, refundReasonLabel } from "../utils/refunds.js";

const rupees = (paise: number) => Math.round(paise) / 100;
const pendingFor = async (orderId: any) => {
  const rows = await Refund.aggregate([{ $match: { order: orderId, status: "pending" } }, { $group: { _id: null, p: { $sum: "$amountPaise" } } }]);
  return rows[0]?.p ?? 0;
};
const present = (r: any) => ({ ...(r.toObject ? r.toObject() : r), amount: rupees(r.amountPaise), reasonLabel: refundReasonLabel(r.reason) });

// GET /api/admin/refunds?status=pending|completed|cancelled
// Also lists "refund due": orders that were paid and then cancelled, with nothing refunded yet.
export const adminListRefunds = async (req: Request, res: Response) => {
  try {
    const status = typeof req.query.status === "string" ? req.query.status : "";
    const filter: any = ["pending", "completed", "cancelled"].includes(status) ? { status } : {};
    const [rows, dueOrders] = await Promise.all([
      Refund.find(filter).sort({ createdAt: -1 }).limit(100),
      Order.find({ paymentStatus: "paid", orderStatus: "cancelled", refundedPaise: { $not: { $gt: 0 } } })
        .select("orderNumber totalAmount user cancelledAt cancelReason paymentMethod")
        .populate("user", "name email phone")
        .sort({ cancelledAt: -1 })
        .limit(50)
        .lean(),
    ]);
    // hide orders that already have a refund waiting to be paid out
    const waiting = new Set((await Refund.find({ status: "pending" }).select("order").lean()).map((r: any) => String(r.order)));
    res.json({
      success: true,
      data: {
        refunds: rows.map(present),
        due: dueOrders.filter((o: any) => !waiting.has(String(o._id))),
        reasons: REFUND_REASONS,
      },
    });
  } catch (error) {
    sendError(res, error, "Failed to load refunds");
  }
};

// POST /api/admin/refunds   body: { order | orderNumber, amount?, reason, note? }
export const adminCreateRefund = async (req: Request, res: Response) => {
  try {
    const { order: orderId, orderNumber, amount, reason, note } = req.body ?? {};
    const order: any = orderId ? await Order.findById(orderId) : orderNumber ? await Order.findOne({ orderNumber: String(orderNumber).trim() }) : null;
    if (!order) throw new HttpError(404, "Order not found");
    if (!REFUND_REASONS.some(([c]) => c === reason)) throw new HttpError(400, "Choose a reason for the refund");
    const check = checkRefundAmount(amount, order, await pendingFor(order._id));
    if (!check.ok) throw new HttpError(400, check.error);
    const refund = await Refund.create({
      order: order._id,
      orderNumber: order.orderNumber,
      user: order.user,
      amountPaise: check.paise,
      reason,
      note: typeof note === "string" ? note.trim().slice(0, 300) : undefined,
      requestedBy: req.user?._id,
    });
    await logActivity(req, "refund.created", "Order", order._id, { refund: refund._id, amount: rupees(check.paise), reason });
    res.status(201).json({ success: true, data: present(refund) });
  } catch (error) {
    sendError(res, error, "Failed to create refund");
  }
};

// PUT /api/admin/refunds/:id/complete   body: { reference }   (the admin has paid the money back)
export const adminCompleteRefund = async (req: Request, res: Response) => {
  try {
    const reference = typeof req.body?.reference === "string" ? req.body.reference.trim().slice(0, 120) : "";
    if (!reference) throw new HttpError(400, "Enter the UPI / bank reference of the refund you paid");
    let done: any = null;
    let orderAfter: any = null;
    await withTxn(async (session) => {
      const opts = session ? { session } : {};
      // only a pending refund can be completed, and only once: the update itself is the lock
      const refund: any = await Refund.findOneAndUpdate(
        { _id: req.params.id, status: "pending" },
        { status: "completed", reference, completedBy: req.user?._id, completedAt: new Date() },
        { new: true, ...opts },
      );
      if (!refund) throw new HttpError(409, "This refund is not pending (already completed or cancelled)");
      const order: any = await Order.findById(refund.order, null, opts);
      if (!order) throw new HttpError(404, "Order not found");
      const refundedPaise = Math.max(0, order.refundedPaise ?? 0) + refund.amountPaise;
      if (refundedPaise > paidPaise(order)) throw new HttpError(400, "That would refund more than the customer paid");
      await LedgerEntry.create(
        [{
          kind: "refund", order: order._id, shop: order.shop, amountPaise: refund.amountPaise, method: "manual", reference,
          refund: refund._id, note: refund.note, by: req.user?._id, uniqueKey: `refund:${refund._id}`,
        }],
        opts,
      );
      order.refundedPaise = refundedPaise;
      order.paymentStatus = paymentStatusAfter(order, refundedPaise);
      await order.save(opts);
      done = refund;
      orderAfter = order;
    });
    await notify(orderAfter.user, {
      type: "payment",
      title: `Refund of ₹${rupees(done.amountPaise)} sent`,
      body: `${orderAfter.orderNumber}: it can take a few days to show in your account.`,
      data: { orderId: orderAfter._id },
    });
    await logActivity(req, "refund.completed", "Order", orderAfter._id, { refund: done._id, amount: rupees(done.amountPaise), reference });
    res.json({ success: true, data: present(done) });
  } catch (error) {
    sendError(res, error, "Failed to complete refund");
  }
};

// PUT /api/admin/refunds/:id/cancel
export const adminCancelRefund = async (req: Request, res: Response) => {
  try {
    const refund: any = await Refund.findOneAndUpdate({ _id: req.params.id, status: "pending" }, { status: "cancelled" }, { new: true });
    if (!refund) throw new HttpError(409, "This refund is not pending");
    await logActivity(req, "refund.cancelled", "Order", refund.order, { refund: refund._id });
    res.json({ success: true, data: present(refund) });
  } catch (error) {
    sendError(res, error, "Failed to cancel refund");
  }
};

// GET /api/admin/ledger?kind=&page=   the money book, newest first, with totals
export const adminLedger = async (req: Request, res: Response) => {
  try {
    const kind = req.query.kind === "payment" || req.query.kind === "refund" ? req.query.kind : undefined;
    const filter: any = kind ? { kind } : {};
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = 50;
    const [rows, total, sums] = await Promise.all([
      LedgerEntry.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate("order", "orderNumber").lean(),
      LedgerEntry.countDocuments(filter),
      LedgerEntry.aggregate([{ $group: { _id: "$kind", p: { $sum: "$amountPaise" }, n: { $sum: 1 } } }]),
    ]);
    const get = (k: string) => sums.find((s: any) => s._id === k) ?? { p: 0, n: 0 };
    res.json({
      success: true,
      data: {
        entries: rows.map((r: any) => ({ ...r, amount: rupees(r.amountPaise) })),
        total, page, pages: Math.max(1, Math.ceil(total / limit)),
        totals: { in: rupees(get("payment").p), out: rupees(get("refund").p), net: rupees(get("payment").p - get("refund").p), payments: get("payment").n, refunds: get("refund").n },
      },
    });
  } catch (error) {
    sendError(res, error, "Failed to load the ledger");
  }
};

// POST /api/admin/ledger/backfill   writes the "money in" entry for paid orders that don't have one (history before the ledger existed)
export const adminLedgerBackfill = async (req: Request, res: Response) => {
  try {
    let added = 0;
    const cursor = Order.find({ paymentStatus: { $in: ["paid", "refunded"] } }).select("totalAmount shop paymentMethod razorpayPaymentId").cursor();
    const before = await LedgerEntry.countDocuments({ kind: "payment" });
    for await (const o of cursor) await recordPayment(o, req.user?._id);
    added = (await LedgerEntry.countDocuments({ kind: "payment" })) - before;
    await logActivity(req, "ledger.backfilled", undefined, undefined, { added });
    res.json({ success: true, added });
  } catch (error) {
    sendError(res, error, "Failed to build the ledger");
  }
};
