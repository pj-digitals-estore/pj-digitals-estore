import mongoose, { Schema } from "mongoose";

// Service locations (towns / areas), managed by the admin. Shops, addresses, drivers and ads store the
// location NAME, so renaming one rewrites those (see locationController). Delivery rules per location come in 11.2.
const locationSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 40 },
    nameKey: { type: String, required: true, unique: true }, // lower-case name: no "muttom" next to "Muttom"
    order: { type: Number, default: 0, index: true },
    isActive: { type: Boolean, default: true }, // off = not offered for new shops, drivers, addresses or ads
  },
  { timestamps: true },
);

export default mongoose.models.Location || mongoose.model("Location", locationSchema);
