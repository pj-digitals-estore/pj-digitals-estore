import test from "node:test";
import assert from "node:assert/strict";
import { checkOtp, codeForCustomer, otpFor, otpRequired } from "../utils/deliveryOtp.js";

test("code is 4 digits, stable per order, differs between orders and secrets", () => {
  const a = otpFor("65a1", "k1");
  assert.match(a, /^\d{4}$/);
  assert.equal(otpFor("65a1", "k1"), a);
  assert.notEqual(otpFor("65a1", "k2") + otpFor("65a2", "k1"), a + a); // not constant
  const codes = new Set(Array.from({ length: 200 }, (_, i) => otpFor(`order${i}`, "k")));
  assert.ok(codes.size > 150); // spread over the 10,000 possible codes
});

test("when a code is required", () => {
  assert.equal(otpRequired("off", "cod"), false);
  assert.equal(otpRequired("cod", "cod"), true);
  assert.equal(otpRequired("cod", "razorpay"), false);
  assert.equal(otpRequired("all", "razorpay"), true);
  assert.equal(otpRequired(undefined, "cod"), false);
});

test("checking a typed code", () => {
  assert.equal(checkOtp("0427", "0427"), true);
  assert.equal(checkOtp(" 04 27 ", "0427"), true);
  assert.equal(checkOtp("0428", "0427"), false);
  assert.equal(checkOtp("", "0427"), false);
  assert.equal(checkOtp("04271", "0427"), false);
  assert.equal(checkOtp(undefined, "0427"), false);
});

test("the customer only sees the code while the order is on its way", () => {
  const o = { _id: "abc", paymentMethod: "cod", orderStatus: "shipping" };
  assert.match(codeForCustomer(o, "cod")!, /^\d{4}$/);
  assert.equal(codeForCustomer({ ...o, orderStatus: "delivered" }, "cod"), undefined);
  assert.equal(codeForCustomer({ ...o, orderStatus: "cancelled" }, "cod"), undefined);
  assert.equal(codeForCustomer({ ...o, paymentMethod: "razorpay" }, "cod"), undefined);
  assert.equal(codeForCustomer(o, "off"), undefined);
});
