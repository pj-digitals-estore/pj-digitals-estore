import test from "node:test";
import assert from "node:assert/strict";
import { checkCoupon, discountFor, normalizeCode } from "../utils/coupons.js";
import { checkoutTotals, computeTotals } from "../utils/pricing.js";

const S = { shippingCost: 20, freeShippingThreshold: 0, taxRate: 0.18, gstRegistered: false };
const base = { type: "percent" as const, value: 10, minOrder: 0, perUserLimit: 1 };

test("codes are normalised", () => {
  assert.equal(normalizeCode(" save10 "), "SAVE10");
  assert.equal(normalizeCode("ab"), null);
  assert.equal(normalizeCode("has space"), null);
  assert.equal(normalizeCode(undefined), null);
});

test("percent with cap, flat, never more than the cart", () => {
  assert.equal(discountFor({ type: "percent", value: 10 }, 500), 50);
  assert.equal(discountFor({ type: "percent", value: 10, maxDiscount: 30 }, 500), 30);
  assert.equal(discountFor({ type: "flat", value: 100 }, 500), 100);
  assert.equal(discountFor({ type: "flat", value: 100 }, 60), 60);
  assert.equal(discountFor({ type: "percent", value: 33.333 }, 100), 33.33);
});

test("rules: inactive, dates, limits, first order, minimum", () => {
  const ctx = { subtotal: 500, userUses: 0, userOrders: 0, now: new Date("2026-11-26T10:00:00Z") };
  assert.deepEqual(checkCoupon(base, ctx), { ok: true, discount: 50 });
  assert.equal(checkCoupon({ ...base, isActive: false }, ctx).ok, false);
  assert.equal(checkCoupon({ ...base, startsAt: "2026-12-01" }, ctx).ok, false);
  assert.equal(checkCoupon({ ...base, expiresAt: "2026-11-01" }, ctx).ok, false);
  assert.equal(checkCoupon({ ...base, usageLimit: 5, usedCount: 5 }, ctx).ok, false);
  assert.equal(checkCoupon(base, { ...ctx, userUses: 1 }).ok, false);
  assert.equal(checkCoupon({ ...base, perUserLimit: 3 }, { ...ctx, userUses: 2 }).ok, true);
  assert.equal(checkCoupon({ ...base, firstOrderOnly: true }, { ...ctx, userOrders: 1 }).ok, false);
  const low = checkCoupon({ ...base, minOrder: 600 }, ctx);
  assert.equal(low.ok, false); assert.match((low as any).reason, /Add ₹100 more/);
});

test("discount reduces the total, is shared across shop orders, and never changes the goods subtotal", () => {
  const t = checkoutTotals([100, 300], 20, S, 40);
  assert.deepEqual(t.map((x) => x.subtotal), [100, 300]);
  assert.equal(Math.round(t.reduce((s, x) => s + x.discount, 0) * 100), 4000);
  assert.equal(Math.round(t.reduce((s, x) => s + x.totalAmount, 0) * 100), (400 - 40 + 20) * 100);
  assert.equal(computeTotals(100, S, 0, 500).totalAmount, 0); // discount can't push the total below delivery + 0 goods
});

test("with GST on, tax is on what the customer pays for the goods", () => {
  const t = computeTotals(1000, { ...S, gstRegistered: true }, 0, 100);
  assert.equal(t.tax, 162); // 18% of 900
  assert.equal(t.totalAmount, 1062);
});
