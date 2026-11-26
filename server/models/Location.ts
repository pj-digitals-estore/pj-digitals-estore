import mongoose, { Schema } from "mongoose";

// Service locations (towns / areas), managed by the admin. Shops, addresses, drivers and ads store the
// location NAME, so renaming one rewrites those (see locationController). Delivery rules per location come in 11.2.
const locationSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 40 },
    nameKey: { type: String, required: true, unique: true }, // lower-case name: no "muttom" next to "Muttom"
    order: { type: Number, default: 0, index: true },
    isActive: { type: Boolean, default: true }, // off = not offered for new shops, drivers, addresses or ads
    // Delivery rules. null = use the platform setting (Admin > Settings).
    deliveryEnabled: { type: Boolean, default: true }, // false = no deliveries here right now (checkout refuses)
    deliveryFee: { type: Number, default: null, min: 0 }, // one fee per checkout
    freeAbove: { type: Number, default: null, min: 0 }, // checkout subtotal that makes delivery free (0 = no offer)
    minOrder: { type: Number, default: null, min: 0 }, // smallest checkout subtotal
  },
  { timestamps: true },
);

export default mongoose.models.Location || mongoose.model("Location", locationSchema);
