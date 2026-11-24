import test from "node:test";
import assert from "node:assert/strict";
import { fillDays } from "../utils/stats.js";

test("every day in the period appears, oldest first, with zeros where nothing sold", () => {
  const d = fillDays([{ _id: "2026-11-23", orders: 2, sales: 500 }], 5, new Date("2026-11-24T10:00:00+05:30"));
  assert.equal(d.length, 5);
  assert.equal(d[0].date, "2026-11-20");
  assert.equal(d[4].date, "2026-11-24");
  assert.equal(d[3].sales, 500);
  assert.equal(d[0].sales, 0);
});

test("'today' follows India time, not the server's clock", () => {
  // 00:30 IST on the 24th is still the 23rd in UTC
  assert.equal(fillDays([], 3, new Date("2026-11-24T00:30:00+05:30"))[2].date, "2026-11-24");
});
