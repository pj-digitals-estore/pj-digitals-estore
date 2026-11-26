import mongoose, { Schema } from "mongoose";

// A refund the admin has decided on. It starts "pending" (the money has not left yet) and becomes
// "completed" when the admin confirms they paid it back (with the UPI / bank reference).
const refundSchema = new Schema(
  {
    order: { type: Schema.Types.ObjectId, ref: "Order", required: true, index: true },
    orderNumber: String,
    user: { type: Schema.Types.ObjectId, ref: "User" },
    amountPaise: { type: Number, required: true, min: 1 },
    reason: { type: String, default: "other" },
    note: { type: String, maxlength: 300 },
    status: { type: String, enum: ["pending", "completed", "cancelled"], default: "pending", index: true },
    reference: { type: String, maxlength: 120 },
    requestedBy: { type: Schema.Types.ObjectId, ref: "User" },
    completedBy: { type: Schema.Types.ObjectId, ref: "User" },
    completedAt: Date,
  },
  { timestamps: true },
);

export default mongoose.models.Refund || mongoose.model("Refund", refundSchema);
