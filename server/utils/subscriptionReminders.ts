import Subscription from "../models/Subscription.js";
import { notify } from "./notify.js";
import { advancePast, reminderBody } from "./subscriptions.js";

/** Sends a reminder for every repeat order that is due, then schedules the next one. Returns how many. */
export const sendDueReminders = async (now = new Date()) => {
  const due: any[] = await Subscription.find({ active: true, nextAt: { $lte: now } }).limit(300).populate("items.product", "name isActive");
  let sent = 0;
  for (const s of due) {
    // move the date first, so a crash can never send the same reminder over and over
    const claimed = await Subscription.updateOne({ _id: s._id, nextAt: s.nextAt }, { $set: { nextAt: advancePast(s.nextAt, s.everyDays, now), lastRemindedAt: now } });
    if (!claimed.modifiedCount) continue;
    const names = (s.items || []).filter((i: any) => i.product?.isActive).map((i: any) => i.product.name);
    if (!names.length) continue; // everything in it has been removed from the shop
    await notify(s.user, { type: "order", title: `Time for your ${s.name || "repeat order"}`, body: reminderBody(names), data: { subscriptionId: s._id, url: "/orders" } });
    sent += 1;
  }
  return sent;
};
