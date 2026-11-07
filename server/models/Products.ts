import mongoose, { Schema, model } from "mongoose";
import { IProduct } from "../types/index.js";

const productSchema = new Schema<IProduct>(
  {
    shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', index: true },
    sku: { type: String, trim: true },
    reorderLevel: { type: Number, default: 5, min: 0 },
    location: { type: String, default: 'Main shelf' },
    name: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    images: [{ type: String }],
    sizes: [{ type: String }],
    category: {
      type: String,
      required: true,
      enum: [
        "Mobile",
        "Tablet",
        "Laptop",
        "Accessories",
        "Electronics",
        "Other", "Textiles", "Home Appliances", "Computer Items",
      ],
      default: "Other",
    },
    stock: { type: Number, required: true, default: 0, min: 0 },
    isFeatured: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

productSchema.index({ name: "text", description: "text" });

const Product = mongoose.model<IProduct>("Product", productSchema);

export default Product;
