import mongoose, { Schema } from "mongoose";

// A repeat order: "this basket, every N days". We remind the customer when it is due; they add it to the
// cart and check out as usual (nothing is charged or reserved automatically).
const subscriptionSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, maxlength: 80 },
    items: [{ _id: false, product: { type: Schema.Types.ObjectId, ref: "Product", required: true }, quantity: { type: Number, min: 1, default: 1 }, size: String }],
    everyDays: { type: Number, min: 1, max: 90, required: true },
    active: { type: Boolean, default: true },
    nextAt: { type: Date, required: true, index: true }, // when the next reminder is due
    lastRemindedAt: Date,
  },
  { timestamps: true },
);

export default mongoose.models.Subscription || mongoose.model("Subscription", subscriptionSchema);
