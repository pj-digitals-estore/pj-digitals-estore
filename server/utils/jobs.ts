import JobLock from "../models/JobLock.js";
import ActivityLog from "../models/ActivityLog.js";
import { createJobLoop } from "./jobLoop.js";
import { expireUnpaidOrders } from "./orderExpiry.js";
import Order from "../models/Order.js";
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

  // Orders nobody has moved for hours: a shop that is asleep, or a delivery nobody picked up.
  const stuck = createJobLoop({
    intervalMs: 30 * 60 * 1000,
    firstDelayMs: 5 * 60 * 1000,
    run: async () => {
      if (!(await acquireLock("stuck-orders", 10 * 60 * 1000))) return;
      let result: any;
      try {
        const hours = Math.max(1, Number(process.env.STUCK_ORDER_HOURS) || 6);
        const before = new Date(Date.now() - hours * 3600 * 1000);
        const count = await Order.countDocuments({
          orderStatus: { $in: ["placed", "processing"] },
          createdAt: { $lt: before },
          $or: [{ paymentMethod: "cod" }, { paymentStatus: "paid" }], // unpaid online ones are the expiry job's business
        });
        result = { count, hours };
        if (count > 0) {
          alertOps(`⏰ ${count} order${count === 1 ? "" : "s"} not moved for over ${hours}h. Check Admin > Orders.`, { key: "stuck-orders", cooldownMs: 6 * 3600 * 1000 });
        }
      } finally {
        await releaseLock("stuck-orders", result).catch(() => {});
      }
    },
    onError: (e) => console.error("stuck-orders job failed:", e),
  });
  stuck.start();
  console.log("Background jobs started: expire-unpaid every 5 min, stuck-orders every 30 min.");
};
