import test from "node:test";
import assert from "node:assert/strict";
import { cleanPrefix, financialYear, formatInvoiceNumber } from "../utils/invoiceNumber.js";

test("financial year runs April to March in India time", () => {
  assert.equal(financialYear(new Date("2026-04-01T00:00:00+05:30")), "2026-27");
  assert.equal(financialYear(new Date("2026-03-31T23:59:00+05:30")), "2025-26");
  assert.equal(financialYear(new Date("2027-01-15T12:00:00Z")), "2026-27");
  // 31 March 20:00 UTC is already 1 April 01:30 in India
  assert.equal(financialYear(new Date("2026-03-31T20:00:00Z")), "2026-27");
  assert.equal(financialYear(new Date("2099-06-01T00:00:00Z")), "2099-00");
});

test("number format and prefix cleaning", () => {
  assert.equal(formatInvoiceNumber("nby", "2026-27", 42), "NBY/26-27/00042");
  assert.equal(formatInvoiceNumber("", "2026-27", 123456), "INV/26-27/123456");
  assert.equal(cleanPrefix("my shop!"), "MYSH");
  assert.equal(cleanPrefix(undefined), "INV");
  assert.ok(formatInvoiceNumber("ABCD", "2026-27", 99999).length <= 16);
});
