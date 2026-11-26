import test from "node:test";
import assert from "node:assert/strict";
import { editDistance, normalize, rankDocs, scoreDoc, tokensOf } from "../utils/search.js";

const P = (id: string, name: string, extra: any = {}) => ({ _id: id, name, ...extra });
const docs = [
  P("1", "Tata Salt 1kg", { brand: "Tata", category: "Grocery" }),
  P("2", "Aashirvaad Atta 5kg", { brand: "Aashirvaad", category: "Grocery" }),
  P("3", "Samsung Galaxy M14 Phone Cover", { brand: "Generic", category: "Mobile Accessories" }),
  P("4", "Parle-G Biscuits", { brand: "Parle", category: "Snacks", barcode: "8901719101267" }),
  P("5", "Salted Peanuts 200g", { category: "Snacks", description: "roasted and salted groundnuts" }),
];
const ids = (q: string) => rankDocs(q, docs).map((d) => d._id);

test("normalising", () => {
  assert.equal(normalize("  Café-Crème!! "), "cafe creme");
  assert.deepEqual(tokensOf("the salt of tata"), ["salt", "tata"]);
});

test("edit distance with swaps and a limit", () => {
  assert.equal(editDistance("salt", "slat"), 1);
  assert.equal(editDistance("biscuit", "biscut"), 1);
  assert.equal(editDistance("abc", "xyz", 1), 2);
});

test("word order, partial words and category all work", () => {
  assert.deepEqual(ids("salt tata"), ["1"]);
  assert.equal(ids("tata sal")[0], "1");
  assert.equal(ids("mobile")[0], "3");
  assert.equal(ids("grocery").length, 2);
});

test("typos are forgiven (but short words must be exact)", () => {
  assert.equal(ids("biscut")[0], "4");
  assert.equal(ids("samsng")[0], "3");
  assert.equal(ids("aashirvad atta")[0], "2");
  assert.deepEqual(ids("sat"), []); // 3 letters: no typo allowance
});

test("every word must match; barcode matches exactly", () => {
  assert.deepEqual(ids("tata phone"), []);
  assert.deepEqual(ids("8901719101267"), ["4"]);
});

test("name matches beat description matches; exact beats partial", () => {
  const r = ids("salt");
  assert.equal(r[0], "1"); // "Tata Salt" exact word in name
  assert.ok(r.includes("5")); // "Salted Peanuts" still found
  assert.ok(scoreDoc(["salt"], docs[0]) > scoreDoc(["salt"], docs[4]));
});

test("empty or junk query returns nothing", () => {
  assert.deepEqual(ids("   "), []);
  assert.deepEqual(ids("!!!"), []);
});
