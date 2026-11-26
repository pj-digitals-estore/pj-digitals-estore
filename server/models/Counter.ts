import mongoose, { Schema } from "mongoose";

// Named counters (e.g. "invoice:2026-27"). Incremented atomically, so two requests never get the same number.
const counterSchema = new Schema({ key: { type: String, required: true, unique: true }, seq: { type: Number, default: 0 } });

export default mongoose.models.Counter || mongoose.model("Counter", counterSchema);
