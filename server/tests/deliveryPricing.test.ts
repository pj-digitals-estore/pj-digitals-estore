import test from "node:test";
import assert from "node:assert/strict";
import { ruleFor, quoteDelivery, splitFee, cleanCoords } from "../utils/deliveryPricing.js";

const S = { shippingCost: 20, freeShippingThreshold: 500 };

test("location values win, empty ones fall back to platform settings", () => {
  assert.deepEqual(ruleFor(null, S), { enabled: true, fee: 20, freeAbove: 500, minOrder: 0, location: null });
  const r = ruleFor({ name: "Muttom", deliveryFee: 0, freeAbove: null, minOrder: 100 }, S);
  assert.equal(r.fee, 0); assert.equal(r.freeAbove, 500); assert.equal(r.minOrder, 100);
});

test("fee, free threshold, minimum and disabled location", () => {
  const r = ruleFor({ name: "Thodupuzha", deliveryFee: 30, freeAbove: 400, minOrder: 100 }, S);
  assert.equal(quoteDelivery(250, r).fee, 30);
  assert.equal(quoteDelivery(250, r).addForFree, 150);
  assert.equal(quoteDelivery(400, r).fee, 0);
  assert.equal(quoteDelivery(400, r).addForFree, null);
  const low = quoteDelivery(60, r);
  assert.equal(low.ok, false); assert.match(low.reason!, /minimum order for Thodupuzha is ₹100/);
  const off = quoteDelivery(900, ruleFor({ name: "Kanjar", deliveryEnabled: false }, S));
  assert.equal(off.ok, false); assert.match(off.reason!, /not delivering to Kanjar/);
});

test("free offer off when freeAbove is 0", () => {
  const q = quoteDelivery(10000, ruleFor({ name: "A", freeAbove: 0 }, { shippingCost: 20, freeShippingThreshold: 0 }));
  assert.equal(q.fee, 20); assert.equal(q.addForFree, null);
});

test("split always adds up to the fee", () => {
  for (const [fee, subs] of [[20, [100, 200, 300]], [30, [1, 1, 1]], [0.07, [5, 5, 5]], [25, [0, 0]], [20, [333.33, 666.67]]] as [number, number[]][]) {
    const parts = splitFee(fee, subs);
    assert.equal(Math.round(parts.reduce((a, b) => a + b, 0) * 100), Math.round(fee * 100));
    assert.ok(parts.every((p) => p >= 0));
  }
  assert.deepEqual(splitFee(20, [300]), [20]);
  assert.deepEqual(splitFee(0, [1, 2]), [0, 0]);
});

test("coordinates are validated", () => {
  assert.deepEqual(cleanCoords("9.8957", "76.7197"), { latitude: 9.8957, longitude: 76.7197 });
  assert.equal(cleanCoords(0, 0), null);
  assert.equal(cleanCoords(91, 10), null);
  assert.equal(cleanCoords("abc", 10), null);
  assert.equal(cleanCoords(undefined, 10), null);
});

import { checkoutTotals } from "../utils/pricing.js";
test("checkout totals: one fee shared across shop orders, nothing lost", () => {
  const settings = { shippingCost: 20, freeShippingThreshold: 0, taxRate: 0.18, gstRegistered: false };
  const t = checkoutTotals([100, 200, 300], 20, settings);
  assert.equal(Math.round(t.reduce((s, x) => s + x.shippingCost, 0) * 100), 2000);
  assert.deepEqual(t.map((x) => x.subtotal), [100, 200, 300]);
  assert.equal(t.reduce((s, x) => s + x.totalAmount, 0), 620);
  assert.equal(t.every((x) => x.tax === 0), true); // GST off
  const single = checkoutTotals([250], 0, settings);
  assert.equal(single[0].totalAmount, 250);
});
