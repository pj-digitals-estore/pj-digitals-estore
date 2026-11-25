import mongoose, { Schema } from "mongoose";

// One row per background job. "lockedUntil" in the future means some server instance is running it right now,
// so two instances (or a restart in the middle of a run) never do the same job at once.
const jobLockSchema = new Schema({
  name: { type: String, required: true, unique: true },
  lockedUntil: Date,
  lastRunAt: Date,
  lastResult: Schema.Types.Mixed,
});

export default mongoose.model("JobLock", jobLockSchema);
