import mongoose, { Schema } from "mongoose";

export const MOVEMENT_REASONS = [
  "restock", // new stock received
  "sale", // an order took it
  "cancel", // an order was cancelled / failed and returned it
  "adjust", // manual +/- from the stock screen
  "count", // stock count: the number was set directly
  "damage", // damaged / expired / lost
  "return", // customer return handled by the shop
] as const;

const movementSchema = new Schema(
  {
    shop: { type: Schema.Types.ObjectId, ref: "Shop", index: true },
    product: { type: Schema.Types.ObjectId, ref: "Product", required: true, index: true },
    delta: { type: Number, required: true }, // + in, - out
    reason: { type: String, enum: MOVEMENT_REASONS, required: true },
    note: { type: String, maxlength: 200 },
    costPrice: { type: Number, min: 0 }, // cost per unit for restocks
    by: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

movementSchema.index({ shop: 1, createdAt: -1 });
movementSchema.index({ product: 1, createdAt: -1 });

export default mongoose.model("StockMovement", movementSchema);
