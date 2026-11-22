import mongoose, { Schema } from "mongoose";

/**
 * Shared product catalogue, keyed by barcode. Filled automatically the first time any shop
 * saves a product with a barcode; later shops that scan the same code get the details pre-filled.
 * It holds NO prices except the MRP (the printed price), never a shop's selling or cost price.
 */
const catalogSchema = new Schema(
  {
    barcode: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    brand: { type: String, trim: true },
    category: { type: String },
    description: { type: String },
    unit: { type: String, trim: true },
    mrp: { type: Number, min: 0 },
    image: { type: String }, // its own copy of the picture (so deleting a shop's product never breaks it)
    createdByShop: { type: Schema.Types.ObjectId, ref: "Shop" },
    uses: { type: Number, default: 1 },
  },
  { timestamps: true },
);

export default mongoose.model("CatalogItem", catalogSchema);
