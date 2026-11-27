import test from "node:test";
import assert from "node:assert/strict";
import { advancePast, morningAfter, reminderBody, validEvery } from "../utils/subscriptions.js";

test("every N days must be a whole number from 1 to 90", () => {
  assert.equal(validEvery(7), 7); assert.equal(validEvery("14"), 14);
  for (const bad of [0, 91, 2.5, "x", null]) assert.equal(validEvery(bad), null);
});
test("reminders land at 8:00 India time (02:30 UTC)", () => {
  assert.equal(morningAfter(new Date("2026-11-27T10:00:00Z"), 7).toISOString(), "2026-12-04T02:30:00.000Z");
  // 23:00 UTC is already the next day in India
  assert.equal(morningAfter(new Date("2026-11-27T23:00:00Z"), 1).toISOString(), "2026-11-29T02:30:00.000Z");
});
test("a late reminder moves on to the next future slot", () => {
  const next = advancePast(new Date("2026-11-01T02:30:00Z"), 7, new Date("2026-11-27T10:00:00Z"));
  assert.equal(next.toISOString(), "2026-11-29T02:30:00.000Z");
});
test("reminder text", () => {
  assert.equal(reminderBody(["Rice", "Milk", "Eggs", "Tea"]), "Rice, Milk and 2 more. Tap to order again.");
  assert.equal(reminderBody(["Rice"]), "Rice. Tap to order again.");
});
