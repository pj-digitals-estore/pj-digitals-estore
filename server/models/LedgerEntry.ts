import mongoose, { Schema } from "mongoose";

// The money book. Append-only: a mistake is fixed by a new entry, never by editing an old one.
// amountPaise is always positive; the kind says which way the money moved.
const ledgerSchema = new Schema(
  {
    kind: { type: String, enum: ["payment", "refund"], required: true, index: true }, // payment = money in, refund = money out
    order: { type: Schema.Types.ObjectId, ref: "Order", required: true, index: true },
    shop: { type: Schema.Types.ObjectId, ref: "Shop" },
    amountPaise: { type: Number, required: true, min: 1 },
    method: { type: String, enum: ["razorpay", "cod", "manual"], default: "manual" },
    reference: { type: String, maxlength: 120 }, // provider payment id, or the UPI/bank reference of a manual refund
    refund: { type: Schema.Types.ObjectId, ref: "Refund" },
    note: { type: String, maxlength: 300 },
    by: { type: Schema.Types.ObjectId, ref: "User" },
    // makes the same event impossible to record twice (e.g. "payment:<orderId>", "refund:<refundId>")
    uniqueKey: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
ledgerSchema.index({ uniqueKey: 1 }, { unique: true });
ledgerSchema.index({ createdAt: -1 });

export default mongoose.models.LedgerEntry || mongoose.model("LedgerEntry", ledgerSchema);
