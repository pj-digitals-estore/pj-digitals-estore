import test from "node:test";
import assert from "node:assert/strict";
import { codBlockReason, computeTotals, toPaise } from "../utils/pricing.js";

const s = (o: any = {}) => ({ shippingCost: 40, freeShippingThreshold: 500, taxRate: 0.18, gstRegistered: false, ...o });

test("delivery is the flat fee below the free-delivery threshold, and free at or above it", () => {
  assert.equal(computeTotals(499, s()).shippingCost, 40);
  assert.equal(computeTotals(500, s()).shippingCost, 0);
  assert.equal(computeTotals(100, s({ freeShippingThreshold: 0 })).shippingCost, 40); // 0 = offer off
});

test("no GST is charged until the shop is GST registered", () => {
  assert.equal(computeTotals(1000, s()).tax, 0);
  assert.equal(computeTotals(1000, s({ gstRegistered: true })).tax, 180);
});

test("the total adds up and is rounded to paise", () => {
  const t = computeTotals(333.33, s({ gstRegistered: true, freeShippingThreshold: 0 }));
  assert.equal(t.tax, 60);
  assert.equal(t.totalAmount, 433.33);
});

test("bad settings fall back to zero instead of NaN", () => {
  const t = computeTotals(100, { shippingCost: "x" as any, freeShippingThreshold: 0, taxRate: "y" as any, gstRegistered: true });
  assert.equal(t.totalAmount, 100);
});

test("Razorpay amounts are whole paise", () => {
  assert.equal(toPaise(199.99), 19999);
  assert.equal(toPaise(0.1 + 0.2), 30);
});

test("cash on delivery: switched off, over the limit, or fine", () => {
  assert.match(codBlockReason({ allowCod: false, codMaxAmount: 0 }, 100)!, /not available/);
  assert.match(codBlockReason({ allowCod: true, codMaxAmount: 2000 }, 2001)!, /up to ₹2000/);
  assert.equal(codBlockReason({ allowCod: true, codMaxAmount: 2000 }, 2000), null);
  assert.equal(codBlockReason({ allowCod: true, codMaxAmount: 0 }, 999999), null); // 0 = no limit
});
