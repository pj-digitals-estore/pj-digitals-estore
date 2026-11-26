import mongoose, { Schema } from "mongoose";

// One row per checkout that used a coupon. The unique index stops one checkout counting twice.
const redemptionSchema = new Schema(
  {
    coupon: { type: Schema.Types.ObjectId, ref: "Coupon", required: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    checkoutId: { type: String, required: true },
    code: String,
    discountPaise: { type: Number, default: 0 },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
redemptionSchema.index({ coupon: 1, checkoutId: 1 }, { unique: true });
redemptionSchema.index({ coupon: 1, user: 1 });

export default mongoose.models.CouponRedemption || mongoose.model("CouponRedemption", redemptionSchema);
