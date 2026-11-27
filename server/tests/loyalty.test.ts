import test from "node:test";
import assert from "node:assert/strict";
import { earnPoints, redeemablePoints } from "../utils/loyalty.js";

test("earning is a rounded-down percentage of what was paid for goods", () => {
  assert.equal(earnPoints(500, 2), 10);
  assert.equal(earnPoints(149, 2), 2);
  assert.equal(earnPoints(0, 2), 0);
  assert.equal(earnPoints(500, 0), 0);
});
const base = { balance: 300, goodsAfterCoupon: 1000, maxPercent: 20, minPoints: 50 };
test("spend up to the balance, capped by the share of goods", () => {
  assert.equal(redeemablePoints(base), 200);
  assert.equal(redeemablePoints({ ...base, balance: 120 }), 120);
});
test("nothing below the minimum, or when the cap is tiny", () => {
  assert.equal(redeemablePoints({ ...base, balance: 40 }), 0);
  assert.equal(redeemablePoints({ ...base, goodsAfterCoupon: 100 }), 0);
  assert.equal(redeemablePoints({ ...base, goodsAfterCoupon: -5 }), 0);
});
test("fractions of a point are never spent", () => {
  assert.equal(redeemablePoints({ ...base, balance: 99.9, minPoints: 1 }), 99);
});
