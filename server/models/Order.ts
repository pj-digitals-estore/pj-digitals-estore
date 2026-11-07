import mongoose from "mongoose";
import { IOrder } from "../types/index.js";

const orderItemSchema = new mongoose.Schema({
  shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },
  name: String,
  quantity: { type: Number, required: true, min: 1 },
  price: { type: Number, required: true },
  size: { type: String },
});

const orderSchema = new mongoose.Schema<IOrder>(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    checkoutKey: { type: String },
    cartFingerprint: { type: String },
    checkoutTokenHash: { type: String, select: false },
    razorpayOrderId: { type: String },
    paymentSetupUntil: { type: Date },
    paymentSetupLock: { type: String },
    paidAt: Date,
    manualReview: { type: Boolean, default: false },
    orderNumber: { type: String, unique: true },
    items: [orderItemSchema],
    shippingAddress: {
      name: { type: String, required: true },
      phone: { type: String, required: true },
      street: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      zipCode: { type: String, required: true },
      country: { type: String, required: true },
    },
    paymentMethod: {
      type: String,
      required: true,
      enum: ["razorpay"],
      default: "razorpay",
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded"],
      default: "pending",
    },
    paymentIntentId: { type: String },
    orderStatus: {
      type: String,
      enum: ["awaiting_payment", "placed", "processing", "shipping", "delivered", "cancelled"],
      default: "awaiting_payment",
    },
    subtotal: { type: Number, required: true },
    shippingCost: { type: Number, default: 0 },
    tax: { type: Number, required: true },
    totalAmount: { type: Number, required: true },
    notes: String,
    deliveredAt: Date,
  },
  { timestamps: true },
);

orderSchema.index({ user: 1, checkoutKey: 1 }, { unique: true, partialFilterExpression: { checkoutKey: { $type: 'string' } } });
const Order = mongoose.model<IOrder>("Order", orderSchema);

export default Order;
