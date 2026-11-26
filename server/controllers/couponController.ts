import { Request, Response } from "express";
import Coupon from "../models/Coupon.js";
import { HttpError, sendError } from "../utils/http.js";
import { logActivity } from "../utils/activity.js";
import { normalizeCode } from "../utils/coupons.js";

const numOrNull = (v: unknown, label: string, { min = 0, max = 1e7 } = {}) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max) throw new HttpError(400, `${label} must be a number from ${min} to ${max}`);
  return Math.round(n * 100) / 100;
};
const dateOrNull = (v: unknown, label: string) => {
  if (v === null || v === undefined || v === "") return null;
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) throw new HttpError(400, `${label} is not a valid date`);
  return d;
};

/** Reads the editable fields from a request body (all optional on update). */
const readFields = (b: any, creating: boolean) => {
  const out: Record<string, any> = {};
  if (b.description !== undefined) out.description = String(b.description ?? "").trim().slice(0, 120);
  if (creating || b.type !== undefined) {
    if (!["percent", "flat"].includes(b.type)) throw new HttpError(400, "Type must be percent or flat");
    out.type = b.type;
  }
  if (creating || b.value !== undefined) {
    const v = numOrNull(b.value, "Value", { min: 0.01 });
    if (v === null) throw new HttpError(400, "Enter the discount value");
    out.value = v;
  }
  if (out.type === "percent" || (out.type === undefined && b.value !== undefined && b.type === undefined)) {
    // validated against the stored type on update below
  }
  if (b.maxDiscount !== undefined) out.maxDiscount = numOrNull(b.maxDiscount, "Maximum discount");
  if (b.minOrder !== undefined) out.minOrder = numOrNull(b.minOrder, "Minimum order") ?? 0;
  if (b.startsAt !== undefined) out.startsAt = dateOrNull(b.startsAt, "Start date");
  if (b.expiresAt !== undefined) out.expiresAt = dateOrNull(b.expiresAt, "Expiry date");
  if (b.usageLimit !== undefined) {
    const n = numOrNull(b.usageLimit, "Total uses", { min: 1 });
    out.usageLimit = n === null ? null : Math.floor(n);
  }
  if (b.perUserLimit !== undefined) out.perUserLimit = Math.floor(numOrNull(b.perUserLimit, "Uses per customer", { min: 1 }) ?? 1);
  if (b.firstOrderOnly !== undefined) out.firstOrderOnly = b.firstOrderOnly === true || b.firstOrderOnly === "true";
  if (b.isActive !== undefined) out.isActive = b.isActive === true || b.isActive === "true";
  return out;
};

const checkSane = (c: { type?: string; value?: number; startsAt?: Date | null; expiresAt?: Date | null }) => {
  if (c.type === "percent" && (c.value ?? 0) > 100) throw new HttpError(400, "A percent coupon can't be more than 100");
  if (c.startsAt && c.expiresAt && c.expiresAt <= c.startsAt) throw new HttpError(400, "The expiry date must be after the start date");
};

// GET /api/admin/coupons
export const adminListCoupons = async (_req: Request, res: Response) => {
  try {
    res.json({ success: true, data: await Coupon.find().sort({ createdAt: -1 }).limit(200).lean() });
  } catch (error) {
    sendError(res, error, "Failed to load coupons");
  }
};

// POST /api/admin/coupons
export const adminCreateCoupon = async (req: Request, res: Response) => {
  try {
    const code = normalizeCode(req.body?.code);
    if (!code) throw new HttpError(400, "The code must be 3 to 20 letters, digits, - or _");
    const data = readFields(req.body ?? {}, true);
    checkSane(data);
    if (await Coupon.exists({ code })) throw new HttpError(409, `The code ${code} already exists`);
    const coupon: any = await Coupon.create({ ...data, code });
    await logActivity(req, "coupon.created", "Coupon", coupon._id, { code, type: coupon.type, value: coupon.value });
    res.status(201).json({ success: true, data: coupon });
  } catch (error) {
    sendError(res, error, "Failed to create coupon");
  }
};

// PUT /api/admin/coupons/:id   (the code itself can't change: customers may already hold it)
export const adminUpdateCoupon = async (req: Request, res: Response) => {
  try {
    const coupon: any = await Coupon.findById(req.params.id);
    if (!coupon) throw new HttpError(404, "Coupon not found");
    const data = readFields(req.body ?? {}, false);
    checkSane({ type: data.type ?? coupon.type, value: data.value ?? coupon.value, startsAt: data.startsAt !== undefined ? data.startsAt : coupon.startsAt, expiresAt: data.expiresAt !== undefined ? data.expiresAt : coupon.expiresAt });
    coupon.set(data);
    await coupon.save();
    await logActivity(req, "coupon.updated", "Coupon", coupon._id, { code: coupon.code, ...data });
    res.json({ success: true, data: coupon });
  } catch (error) {
    sendError(res, error, "Failed to update coupon");
  }
};

// DELETE /api/admin/coupons/:id   (a coupon that has been used is kept for the records: switch it off instead)
export const adminDeleteCoupon = async (req: Request, res: Response) => {
  try {
    const coupon: any = await Coupon.findById(req.params.id);
    if (!coupon) throw new HttpError(404, "Coupon not found");
    if (coupon.usedCount > 0) throw new HttpError(400, "This coupon has been used. Switch it off instead of deleting it.");
    await coupon.deleteOne();
    await logActivity(req, "coupon.deleted", "Coupon", coupon._id, { code: coupon.code });
    res.json({ success: true });
  } catch (error) {
    sendError(res, error, "Failed to delete coupon");
  }
};
