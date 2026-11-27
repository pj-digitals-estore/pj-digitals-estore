import Coupon from "../models/Coupon.js";
import CouponRedemption from "../models/CouponRedemption.js";
import Order from "../models/Order.js";
import { HttpError } from "./http.js";
import { paiseOf } from "./money.js";
import { checkCoupon, normalizeCode } from "./coupons.js";
import { releasePoints } from "./loyaltyService.js";

/** Looks the code up and checks it for this user and cart. Returns the coupon and the discount, or a reason. */
export const evaluateForUser = async (rawCode: unknown, userId: any, subtotal: number) => {
  const code = normalizeCode(rawCode);
  if (!code) return { ok: false as const, reason: "That is not a valid coupon code." };
  const coupon: any = await Coupon.findOne({ code });
  if (!coupon) return { ok: false as const, reason: "That coupon code does not exist." };
  const [userUses, userOrders] = await Promise.all([
    CouponRedemption.countDocuments({ coupon: coupon._id, user: userId }),
    coupon.firstOrderOnly ? Order.countDocuments({ user: userId, orderStatus: { $ne: "cancelled" } }) : Promise.resolve(0),
  ]);
  const result = checkCoupon(coupon, { subtotal, userUses, userOrders });
  return result.ok ? { ok: true as const, coupon, discount: result.discount } : { ok: false as const, reason: result.reason };
};

/**
 * Counts the use. The update is conditional, so two checkouts racing for the last use can't both win, and the
 * unique redemption row stops one checkout counting twice. Throws a customer-facing error when it loses.
 */
export const claimCoupon = async (coupon: any, userId: any, checkoutId: string, discount: number) => {
  const limited = coupon.usageLimit != null;
  const updated = await Coupon.findOneAndUpdate(
    { _id: coupon._id, isActive: true, ...(limited ? { usedCount: { $lt: coupon.usageLimit } } : {}) },
    { $inc: { usedCount: 1 } },
    { new: true },
  );
  if (!updated) throw new HttpError(400, "This coupon has just been fully used.");
  try {
    await CouponRedemption.create({ coupon: coupon._id, user: userId, checkoutId, code: coupon.code, discountPaise: paiseOf(discount) });
    const mine = await CouponRedemption.countDocuments({ coupon: coupon._id, user: userId });
    if (mine > (coupon.perUserLimit ?? 1)) throw new HttpError(400, "You have already used this coupon.");
  } catch (err) {
    await releaseCoupon(checkoutId, true);
    throw err;
  }
};

/**
 * Gives the use back. Called when checkout fails (force) or when every order of the checkout was cancelled.
 * Safe to call twice: only a redemption that still exists is released.
 */
export const releaseCoupon = async (checkoutId: string, force = false) => {
  if (!checkoutId) return;
  if (!force && (await Order.exists({ checkoutId, orderStatus: { $ne: "cancelled" } }))) return;
  await releasePoints(checkoutId); // loyalty points spent on the same checkout come back at the same moments
  const row: any = await CouponRedemption.findOneAndDelete({ checkoutId });
  if (row) await Coupon.updateOne({ _id: row.coupon, usedCount: { $gt: 0 } }, { $inc: { usedCount: -1 } });
};
