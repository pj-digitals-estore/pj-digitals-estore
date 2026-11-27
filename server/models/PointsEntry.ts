import mongoose, { Schema } from "mongoose";

// Loyalty points, append-only. points is signed: earn (+), redeem (-), restore (+, when a checkout that used
// points is cancelled). A customer's balance is the sum. uniqueKey makes every event happen once.
const pointsSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    kind: { type: String, enum: ["earn", "redeem", "restore"], required: true },
    points: { type: Number, required: true },
    order: { type: Schema.Types.ObjectId, ref: "Order" },
    checkoutId: String,
    uniqueKey: { type: String, required: true, unique: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export default mongoose.models.PointsEntry || mongoose.model("PointsEntry", pointsSchema);
