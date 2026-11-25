import JobLock from "../models/JobLock.js";
import ActivityLog from "../models/ActivityLog.js";
import { createJobLoop } from "./jobLoop.js";
import { expireUnpaidOrders } from "./orderExpiry.js";
import { alertOps, errorText, escapeHtml } from "./telegram.js";

/** Takes the named lock for ttlMs. false = another run holds it. */
export const acquireLock = async (name: string, ttlMs: number) => {
  const now = new Date();
  try {
    const row = await JobLock.findOneAndUpdate(
      { name, $or: [{ lockedUntil: { $lt: now } }, { lockedUntil: { $exists: false } }, { lockedUntil: null }] },
      { $set: { lockedUntil: new Date(now.getTime() + ttlMs) } },
      { upsert: true, new: true },
    );
    return !!row;
  } catch (e: any) {
    if (e?.code === 11000) return false; // row exists and is still locked
    throw e;
  }
};

export const releaseLock = (name: string, lastResult?: unknown) =>
  JobLock.updateOne({ name }, { $set: { lockedUntil: new Date(0), lastRunAt: new Date(), lastResult } });

/** Background jobs that used to need an outside cron. Runs inside the API process. */
export const startJobs = () => {
  if (String(process.env.JOBS_ENABLED ?? "true").toLowerCase() === "false") {
    console.log("Background jobs are off (JOBS_ENABLED=false).");
    return;
  }

  const expiry = createJobLoop({
    intervalMs: 5 * 60 * 1000,
    firstDelayMs: 60 * 1000,
    run: async () => {
      if (!(await acquireLock("expire-unpaid", 4 * 60 * 1000))) return;
      let result: any;
      try {
        result = await expireUnpaidOrders(process.env.UNPAID_EXPIRE_MINUTES);
        if (result.expired > 0) {
          await ActivityLog.create({ actorName: "system", action: "orders.expired_unpaid", targetType: "Order", meta: result }).catch(() => {});
        }
      } finally {
        await releaseLock("expire-unpaid", result).catch(() => {});
      }
    },
    onError: (e) => {
      console.error("expire-unpaid job failed:", e);
      alertOps(`🟠 Job failed: expire-unpaid\n${escapeHtml(errorText(e))}`, { key: "job-expire-unpaid", cooldownMs: 60 * 60 * 1000 });
    },
  });
  expiry.start();
  console.log("Background jobs started: expire-unpaid every 5 min.");
};
