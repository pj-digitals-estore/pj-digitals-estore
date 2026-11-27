import { Request, Response } from "express";
import Subscription from "../models/Subscription.js";
import Order from "../models/Order.js";
import { sendError } from "../utils/http.js";
import { morningAfter, validEvery } from "../utils/subscriptions.js";

const MAX_PER_USER = 10;
const mine = (req: Request) => ({ _id: req.params.id, user: req.user._id });

// GET /api/subscriptions
export const listSubscriptions = async (req: Request, res: Response) => {
  try {
    const rows = await Subscription.find({ user: req.user._id }).sort("nextAt").populate("items.product", "name images price stock isActive").lean();
    res.json({ success: true, data: rows });
  } catch (e) { sendError(res, e, "Failed to load repeat orders"); }
};

// POST /api/subscriptions  { orderId, everyDays }  -> repeats the items of one of the customer's own orders
export const createSubscription = async (req: Request, res: Response) => {
  try {
    const every = validEvery(req.body.everyDays);
    if (!every) return res.status(400).json({ success: false, message: "Choose how often, from 1 to 90 days." });
    if ((await Subscription.countDocuments({ user: req.user._id })) >= MAX_PER_USER) return res.status(400).json({ success: false, message: `You can keep up to ${MAX_PER_USER} repeat orders.` });
    const order: any = await Order.findOne({ _id: req.body.orderId, user: req.user._id });
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });
    const items = (order.items || []).map((i: any) => ({ product: i.product, quantity: i.quantity, size: i.size || undefined }));
    if (!items.length) return res.status(400).json({ success: false, message: "That order has no items." });
    const name = String(req.body.name || "").trim().slice(0, 80) || (every === 7 ? "weekly order" : every === 30 ? "monthly order" : `order every ${every} days`);
    const row = await Subscription.create({ user: req.user._id, name, items, everyDays: every, nextAt: morningAfter(new Date(), every) });
    res.status(201).json({ success: true, data: row });
  } catch (e) { sendError(res, e, "Failed to save repeat order"); }
};

// PUT /api/subscriptions/:id  { everyDays?, active?, name? }
export const updateSubscription = async (req: Request, res: Response) => {
  try {
    const row: any = await Subscription.findOne(mine(req));
    if (!row) return res.status(404).json({ success: false, message: "Not found" });
    if (req.body.everyDays !== undefined) {
      const every = validEvery(req.body.everyDays);
      if (!every) return res.status(400).json({ success: false, message: "Choose how often, from 1 to 90 days." });
      row.everyDays = every;
      row.nextAt = morningAfter(new Date(), every);
    }
    if (typeof req.body.name === "string" && req.body.name.trim()) row.name = req.body.name.trim().slice(0, 80);
    if (typeof req.body.active === "boolean") {
      if (req.body.active && !row.active) row.nextAt = morningAfter(new Date(), row.everyDays); // resuming starts a fresh cycle
      row.active = req.body.active;
    }
    await row.save();
    res.json({ success: true, data: row });
  } catch (e) { sendError(res, e, "Failed to update repeat order"); }
};

// POST /api/subscriptions/:id/done  -> the customer has just ordered it: the next reminder is a full cycle away
export const markOrdered = async (req: Request, res: Response) => {
  try {
    const row: any = await Subscription.findOne(mine(req));
    if (!row) return res.status(404).json({ success: false, message: "Not found" });
    row.nextAt = morningAfter(new Date(), row.everyDays);
    await row.save();
    res.json({ success: true, data: row });
  } catch (e) { sendError(res, e, "Failed to update repeat order"); }
};

// DELETE /api/subscriptions/:id
export const deleteSubscription = async (req: Request, res: Response) => {
  try {
    await Subscription.deleteOne(mine(req));
    res.json({ success: true });
  } catch (e) { sendError(res, e, "Failed to remove repeat order"); }
};
