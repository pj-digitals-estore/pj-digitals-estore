import test from "node:test";
import assert from "node:assert/strict";
import { fitCharges, shopChargePaise } from "../utils/shopCharge.js";

const delivered = { shop: "s1", orderStatus: "delivered", subtotal: 1000, money: { subtotalPaise: 100000, sellerPaise: 95000 } };

test("the shop gives back its net share of the goods refunded", () => {
  assert.equal(shopChargePaise({ refundPaise: 20000, order: delivered, fullyRefunded: false }), 19000);
});
test("delivery and tax are not the shop's: capped at the goods", () => {
  assert.equal(shopChargePaise({ refundPaise: 110000, order: { ...delivered, settlement: "x" }, fullyRefunded: true }), 95000);
});
test("nothing to charge: no shop, not delivered, or fully refunded before any settlement", () => {
  assert.equal(shopChargePaise({ refundPaise: 5000, order: { ...delivered, shop: undefined }, fullyRefunded: false }), 0);
  assert.equal(shopChargePaise({ refundPaise: 5000, order: { ...delivered, orderStatus: "cancelled" }, fullyRefunded: false }), 0);
  assert.equal(shopChargePaise({ refundPaise: 100000, order: delivered, fullyRefunded: true }), 0);
});
test("partial refund of an unsettled order is charged (the order still counts in full)", () => {
  assert.equal(shopChargePaise({ refundPaise: 10000, order: delivered, fullyRefunded: false }), 9500);
});
test("older orders without a snapshot use the whole refunded goods amount", () => {
  assert.equal(shopChargePaise({ refundPaise: 10000, order: { shop: "s", orderStatus: "delivered", subtotal: 500 }, fullyRefunded: false }), 10000);
});
test("charges that do not fit wait for the next settlement", () => {
  const r = fitCharges([{ amountPaise: 6000 }, { amountPaise: 5000 }, { amountPaise: 1000 }], 10000);
  assert.deepEqual(r.applied.map((c) => c.amountPaise), [6000, 1000]);
  assert.equal(r.waiting.length, 1);
  assert.equal(r.totalPaise, 7000);
  assert.equal(fitCharges([{ amountPaise: 1 }], 0).applied.length, 0);
});
