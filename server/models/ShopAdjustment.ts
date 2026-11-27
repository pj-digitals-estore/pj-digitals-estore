import mongoose, { Schema } from "mongoose";

// Money to take back from a shop on its next settlement (today: its share of a refund paid to a customer).
// pending -> applied (taken in a settlement) or void (no longer needed). uniqueKey makes each refund count once.
const adjustmentSchema = new Schema(
  {
    shop: { type: Schema.Types.ObjectId, ref: "Shop", required: true, index: true },
    order: { type: Schema.Types.ObjectId, ref: "Order", index: true },
    orderNumber: String,
    refund: { type: Schema.Types.ObjectId, ref: "Refund" },
    amountPaise: { type: Number, required: true, min: 1 },
    note: String,
    status: { type: String, enum: ["pending", "applied", "void"], default: "pending", index: true },
    settlement: { type: Schema.Types.ObjectId, ref: "Settlement" },
    uniqueKey: { type: String, required: true, unique: true },
  },
  { timestamps: true },
);

export default mongoose.models.ShopAdjustment || mongoose.model("ShopAdjustment", adjustmentSchema);
