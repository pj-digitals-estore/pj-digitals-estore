import mongoose, { Schema } from "mongoose";

// A discount code the platform pays for: the shop is still paid on the full price, the customer pays less.
const couponSchema = new Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    description: { type: String, maxlength: 120 }, // shown to the customer
    type: { type: String, enum: ["percent", "flat"], required: true },
    value: { type: Number, required: true, min: 0 }, // percent (1-100) or rupees
    maxDiscount: { type: Number, default: null, min: 0 }, // cap for percent coupons, rupees (null = no cap)
    minOrder: { type: Number, default: 0, min: 0 }, // smallest cart (goods) total that qualifies
    startsAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null },
    usageLimit: { type: Number, default: null, min: 1 }, // total uses across everyone (null = unlimited)
    perUserLimit: { type: Number, default: 1, min: 1 },
    firstOrderOnly: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    usedCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

export default mongoose.models.Coupon || mongoose.model("Coupon", couponSchema);
