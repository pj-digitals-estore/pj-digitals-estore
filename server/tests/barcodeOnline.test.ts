import test from "node:test";
import assert from "node:assert/strict";
import { lookupOnline, parseOpenFoodFacts } from "../utils/barcodeOnline.js";

test("reads an Open Food Facts answer", () => {
  const r = parseOpenFoodFacts({ status: 1, product: { product_name: "  Parle-G  Gold ", brands: "Parle, Parle Products", quantity: "100 g" } });
  assert.deepEqual(r, { name: "Parle-G Gold", brand: "Parle", unit: "100 g", source: "Open Food Facts" });
});

test("unknown or empty products give nothing", () => {
  assert.equal(parseOpenFoodFacts({ status: 0 }), null);
  assert.equal(parseOpenFoodFacts({ status: 1, product: { product_name: "" } }), null);
  assert.equal(parseOpenFoodFacts(null), null);
});

test("lookup uses the network once per barcode, ignores bad codes and failures", async () => {
  let calls = 0;
  const fake = (async () => { calls++; return { ok: true, json: async () => ({ status: 1, product: { product_name: "Salt" } }) }; }) as any;
  assert.equal((await lookupOnline("8901234567890", fake))?.name, "Salt");
  assert.equal((await lookupOnline("8901234567890", fake))?.name, "Salt");
  assert.equal(calls, 1); // second answer came from the cache
  assert.equal(await lookupOnline("abc", fake), null);
  assert.equal(calls, 1);
  const boom = (async () => { throw new Error("offline"); }) as any;
  assert.equal(await lookupOnline("8900000000001", boom), null);
});
