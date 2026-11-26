import mongoose from "mongoose";
import {
  CANCELLED_BY,
  IOrder,
  ORDER_STATUSES,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
} from "../types/index.js";

const orderItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },
  name: String,
  image: String,
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
      index: true,
    },
    orderNumber: { type: String, unique: true, required: true },
    items: [orderItemSchema],
    shippingAddress: {
      fullName: String,
      phone: String,
      street: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      zipCode: { type: String, required: true },
      country: { type: String, required: true },
      location: String,
      landmark: String,
      latitude: Number,
      longitude: Number,
    },
    // one order per shop; orders created in one checkout share a checkoutId
    shop: { type: mongoose.Schema.Types.ObjectId, ref: "Shop", index: true },
    checkoutId: { type: String, index: true },
    settlement: { type: mongoose.Schema.Types.ObjectId, ref: "Settlement" },
    paymentOption: { type: String }, // what the app sent: upi / card / cod ...
    paymentMethod: {
      type: String,
      required: true,
      enum: PAYMENT_METHODS,
      default: "cod",
    },
    paymentStatus: {
      type: String,
      enum: PAYMENT_STATUSES,
      default: "pending",
    },
    currency: { type: String, default: "INR" },
    discount: { type: Number, default: 0, min: 0 }, // coupon discount on the goods (platform-paid)
    couponCode: String,
    refundedPaise: { type: Number, default: 0, min: 0 }, // total paid back to the customer so far (see Refund / LedgerEntry)
    razorpayOrderId: { type: String, index: true, sparse: true },
    razorpayPaymentId: { type: String },
    razorpaySignature: { type: String },
    orderStatus: {
      type: String,
      enum: ORDER_STATUSES,
      default: "placed",
    },
    subtotal: { type: Number, required: true },
    shippingCost: { type: Number, default: 0 },
    tax: { type: Number, required: true, default: 0 },
    totalAmount: { type: Number, required: true },
    // fixed at checkout, in integer paise (see utils/money.ts). Older orders don't have it.
    money: {
      type: new mongoose.Schema(
        {
          version: Number,
          seller: { type: String, enum: ["shop", "platform"] },
          rateSource: { type: String, enum: ["shop", "platform_default", "none"] },
          commissionRate: Number,
          subtotalPaise: Number,
          shippingPaise: Number,
          taxPaise: Number,
          totalPaise: Number,
          discountPaise: Number,
          commissionPaise: Number,
          sellerPaise: Number,
        },
        { _id: false },
      ),
    },
    notes: String,
    stockRestored: { type: Boolean, default: false },
    paidAt: Date,
    deliveredAt: Date,
    invoiceNumber: { type: String, index: { unique: true, sparse: true } }, // e.g. INV/26-27/00042, given once the order is delivered
    invoiceDate: Date,
    cancelledAt: Date,
    cancelReason: { type: String, maxlength: 40 }, // a code from CANCEL_REASONS
    cancelNote: { type: String, maxlength: 200 },
    cancelledBy: { type: String, enum: CANCELLED_BY },
  },
  { timestamps: true },
);

orderSchema.index({ createdAt: -1 });

const Order = mongoose.model<IOrder>("Order", orderSchema);

export default Order;
