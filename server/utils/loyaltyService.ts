import PointsEntry from "../models/PointsEntry.js";
import { HttpError } from "./http.js";
import { earnPoints } from "./loyalty.js";
import { getSettings } from "./settings.js";
import { reportError } from "./errorReport.js";

const isDuplicate = (e: any) => e?.code === 11000;

export const balanceOf = async (userId: any): Promise<number> => {
  const r = await PointsEntry.aggregate([{ $match: { user: userId } }, { $group: { _id: null, p: { $sum: "$points" } } }]);
  return Math.max(0, r[0]?.p ?? 0);
};

/** Spends points for a checkout. Throws a customer-facing error if the balance turns out to be too low. */
export const claimPoints = async (userId: any, checkoutId: string, points: number) => {
  if (points <= 0) return;
  await PointsEntry.create({ user: userId, kind: "redeem", points: -points, checkoutId, uniqueKey: `redeem:${checkoutId}` });
  const left = await PointsEntry.aggregate([{ $match: { user: userId } }, { $group: { _id: null, p: { $sum: "$points" } } }]);
  if ((left[0]?.p ?? 0) < 0) {
    await PointsEntry.deleteOne({ uniqueKey: `redeem:${checkoutId}` });
    throw new HttpError(400, "You do not have enough points for that.");
  }
};

/** Gives the spent points back (checkout failed or was cancelled). Safe to call twice. */
export const releasePoints = async (checkoutId: string) => {
  if (!checkoutId) return;
  const row: any = await PointsEntry.findOne({ uniqueKey: `redeem:${checkoutId}` }).lean();
  if (!row) return;
  try {
    await PointsEntry.create({ user: row.user, kind: "restore", points: -row.points, checkoutId, uniqueKey: `restore:${checkoutId}` });
  } catch (e) {
    if (!isDuplicate(e)) throw e;
  }
};

/** Awards points when an order is delivered. Once per order; never blocks the delivery. */
export const awardForOrder = async (order: any) => {
  try {
    const s = await getSettings();
    if (!s.loyaltyEnabled) return;
    const pts = earnPoints((order.subtotal || 0) - (order.discount || 0), s.loyaltyEarnPercent);
    if (pts <= 0) return;
    await PointsEntry.create({ user: order.user, kind: "earn", points: pts, order: order._id, uniqueKey: `earn:${order._id}` });
  } catch (e) {
    if (isDuplicate(e)) return;
    console.error("award points failed:", e);
    reportError(e, { tags: { where: "loyalty.award" } });
  }
};
