import test from "node:test";
import assert from "node:assert/strict";
import { buildMoney, commissionPaiseOf, orderCommission, paiseOf } from "../utils/money.js";
import { normalizeKey } from "../utils/idemKey.js";
import { computeTotals } from "../utils/pricing.js";

const totals = (subtotal: number) =>
  computeTotals(subtotal, { shippingCost: 40, freeShippingThreshold: 500, taxRate: 0.18, gstRegistered: false });

test("paise are exact integers, even for awkward rupee amounts", () => {
  assert.equal(paiseOf(0.1 + 0.2), 30);
  assert.equal(paiseOf(1999.99), 199999);
  assert.equal(paiseOf("abc"), 0);
  assert.equal(Object.is(paiseOf(-0), 0), true);
});

test("commission is taken from goods only and the parts add up", () => {
  const m = buildMoney(totals(1000), { seller: "shop", rate: 0.07, source: "platform_default" });
  assert.equal(m.subtotalPaise, 100000);
  assert.equal(m.commissionPaise, 7000);
  assert.equal(m.sellerPaise, 93000);
  assert.equal(m.shippingPaise, 0); // free over 500
  assert.equal(m.totalPaise, m.subtotalPaise + m.shippingPaise + m.taxPaise);
  assert.equal(m.commissionRate, 0.07);
  assert.equal(m.rateSource, "platform_default");
});

test("total in paise always equals the sum of its parts", () => {
  for (const sub of [1, 99.99, 333.33, 499.99, 500, 12345.67]) {
    const t = computeTotals(sub, { shippingCost: 40, freeShippingThreshold: 500, taxRate: 0.18, gstRegistered: true });
    const m = buildMoney(t, { seller: "shop", rate: 0.05, source: "shop" });
    assert.equal(m.totalPaise, m.subtotalPaise + m.shippingPaise + m.taxPaise, `subtotal ${sub}`);
    assert.equal(m.sellerPaise + m.commissionPaise, m.subtotalPaise);
  }
});

test("platform-owned products carry no commission", () => {
  const m = buildMoney(totals(250), { seller: "platform", rate: 0.2, source: "shop" });
  assert.equal(m.commissionPaise, 0);
  assert.equal(m.commissionRate, 0);
  assert.equal(m.rateSource, "none");
  assert.equal(m.sellerPaise, m.subtotalPaise);
});

test("commission rate is clamped to something sensible", () => {
  assert.equal(commissionPaiseOf(10000, -1), 0);
  assert.equal(commissionPaiseOf(10000, "x"), 0);
  assert.equal(commissionPaiseOf(10000, 5), 10000); // never more than the goods
  assert.equal(commissionPaiseOf(0, 0.1), 0);
});

test("a later rate change does not touch an order that has a snapshot", () => {
  const old = { subtotal: 1000, money: buildMoney(totals(1000), { seller: "shop", rate: 0.05, source: "shop" }) };
  assert.equal(orderCommission(old, 0.2).paise, 5000); // shop's rate is 20% now, order keeps 5%
  assert.equal(orderCommission(old, 0.2).snapshotted, true);
});

test("an order from before snapshots uses the current rate, and an admin override beats both", () => {
  const legacy = { subtotal: 1000 };
  assert.deepEqual(orderCommission(legacy, 0.1), { paise: 10000, snapshotted: false });
  const snap = { subtotal: 1000, money: buildMoney(totals(1000), { seller: "shop", rate: 0.05, source: "shop" }) };
  assert.equal(orderCommission(snap, 0.1, 0.02).paise, 2000);
  assert.equal(orderCommission(legacy, 0.1, 0).paise, 0); // an explicit 0% is an override, not "unset"
  assert.equal(orderCommission(legacy, 0.1, null).paise, 10000);
});

test("idempotency keys: only plain tokens of a sensible length are accepted", () => {
  assert.equal(normalizeKey("chk_1f2e3d4c5b6a"), "chk_1f2e3d4c5b6a");
  assert.equal(normalizeKey("  abcdefgh-12345678 "), "abcdefgh-12345678");
  assert.equal(normalizeKey("short"), null);
  assert.equal(normalizeKey("has space inside"), null);
  assert.equal(normalizeKey("x".repeat(81)), null);
  assert.equal(normalizeKey(123456789), null);
  assert.equal(normalizeKey(undefined), null);
  assert.equal(normalizeKey({ $ne: "x" }), null); // no operator injection
});
