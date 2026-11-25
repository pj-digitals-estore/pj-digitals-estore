import mongoose, { Schema } from "mongoose";

// One row per checkout attempt the app has identified with an idempotency key. The unique index is what
// stops two simultaneous requests with the same key from both creating orders. Rows expire after a day.
const checkoutKeySchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: "User", required: true },
  key: { type: String, required: true },
  checkoutId: String, // filled in once the orders exist
  createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 },
});
checkoutKeySchema.index({ user: 1, key: 1 }, { unique: true });

export default mongoose.model("CheckoutKey", checkoutKeySchema);
