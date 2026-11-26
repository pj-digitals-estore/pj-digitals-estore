import test from "node:test";
import assert from "node:assert/strict";
import { refundView } from "../utils/refundView.js";

const o = { totalAmount: 500 };
test("no refund started -> nothing to show", () => {
  assert.equal(refundView([], o), null);
  assert.equal(refundView([{ status: "cancelled", amountPaise: 50000 }], o), null);
});
test("pending refund", () => {
  assert.deepEqual(refundView([{ status: "pending", amountPaise: 50000 }], o), { state: "pending", paidPaise: 0, pendingPaise: 50000, reference: undefined, paidAt: undefined });
});
test("paid in full keeps the latest reference", () => {
  const v = refundView([{ status: "completed", amountPaise: 20000, reference: "A", completedAt: "2026-11-01" }, { status: "completed", amountPaise: 30000, reference: "B", completedAt: "2026-11-03" }], o)!;
  assert.equal(v.state, "paid"); assert.equal(v.reference, "B"); assert.equal(v.paidPaise, 50000);
});
test("part paid, rest pending or never started, is partial", () => {
  assert.equal(refundView([{ status: "completed", amountPaise: 10000 }, { status: "pending", amountPaise: 5000 }], o)!.state, "partial");
  assert.equal(refundView([{ status: "completed", amountPaise: 10000 }], o)!.state, "partial");
});
