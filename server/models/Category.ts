import mongoose, { Schema } from "mongoose";

// Product categories, managed by the admin. Products, catalogue items and shops store the
// category NAME, so renaming a category rewrites those (see categoryController).
const categorySchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 40 },
    nameKey: { type: String, required: true, unique: true }, // lower-case name: no "mobile" next to "Mobile"
    order: { type: Number, default: 0, index: true },
    isActive: { type: Boolean, default: true }, // hidden = not offered for new products or browsing
  },
  { timestamps: true },
);

export default mongoose.models.Category || mongoose.model("Category", categorySchema);
