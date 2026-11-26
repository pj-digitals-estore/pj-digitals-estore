import test from "node:test";
import assert from "node:assert/strict";
import { checkRefundAmount, paymentStatusAfter, refundablePaise, isNoTransactionSupport } from "../utils/refunds.js";

const paid = { paymentStatus: "paid", totalAmount: 499.5, refundedPaise: 0 };

test("whole remaining amount by default, and partial amounts", () => {
  assert.deepEqual(checkRefundAmount(undefined, paid), { ok: true, paise: 49950 });
  assert.deepEqual(checkRefundAmount("100", paid), { ok: true, paise: 10000 });
  assert.deepEqual(checkRefundAmount(499.5, paid), { ok: true, paise: 49950 });
});

test("cannot refund more than paid, or unpaid orders, or zero", () => {
  assert.equal(checkRefundAmount(500, paid).ok, false);
  assert.equal(checkRefundAmount(0, paid).ok, false);
  assert.equal(checkRefundAmount("abc", paid).ok, false);
  assert.equal(checkRefundAmount(10, { paymentStatus: "pending", totalAmount: 100 }).ok, false);
});

test("earlier and pending refunds reduce what is left", () => {
  const part = { ...paid, refundedPaise: 20000 };
  assert.equal(refundablePaise(part), 29950);
  assert.equal(refundablePaise(part, 10000), 19950);
  assert.equal(checkRefundAmount(300, part).ok, false);
  assert.deepEqual(checkRefundAmount(undefined, part, 10000), { ok: true, paise: 19950 });
  assert.equal(checkRefundAmount(undefined, { ...paid, refundedPaise: 49950 }).ok, false);
});

test("order becomes refunded only when fully refunded", () => {
  assert.equal(paymentStatusAfter(paid, 10000), "paid");
  assert.equal(paymentStatusAfter(paid, 49950), "refunded");
});

test("recognises a MongoDB without transactions", () => {
  assert.equal(isNoTransactionSupport({ code: 20, message: "x" }), true);
  assert.equal(isNoTransactionSupport(new Error("Transaction numbers are only allowed on a replica set member or mongos")), true);
  assert.equal(isNoTransactionSupport(new Error("duplicate key")), false);
});
