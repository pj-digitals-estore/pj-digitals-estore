import test from "node:test";
import assert from "node:assert/strict";
import { headline, pct } from "../utils/insights.js";

test("percentages are safe and rounded", () => {
  assert.equal(pct(1, 3), 33.3);
  assert.equal(pct(5, 0), 0);
});

test("headline numbers", () => {
  const h = headline({ orders: 8, cancelled: 2, gross: 4000, goods: 3700, delivery: 300, discount: 185, refunded: 500, customers: 5, repeatCustomers: 2 });
  assert.equal(h.averageOrder, 500);
  assert.equal(h.net, 3500);
  assert.equal(h.cancelRate, 20);
  assert.equal(h.discountRate, 5);
  assert.equal(h.newCustomers, 3);
  assert.equal(h.repeatRate, 40);
});

test("an empty range gives zeros, not NaN", () => {
  const h = headline({ orders: 0, cancelled: 0, gross: 0, goods: 0, delivery: 0, discount: 0, refunded: 0, customers: 0, repeatCustomers: 0 });
  assert.equal(h.averageOrder, 0); assert.equal(h.cancelRate, 0); assert.equal(h.repeatRate, 0);
});
