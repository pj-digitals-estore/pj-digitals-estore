import test from "node:test";
import assert from "node:assert/strict";
import { IMPORT_TEMPLATE, csvSafe, parseCsv, planImport } from "../utils/csvImport.js";

const cats: Record<string, string> = { mobile: "Mobile", other: "Other" };
const resolve = (r: string) => cats[r.toLowerCase()] ?? null;
const existing: any[] = [
  { _id: "1", name: "Charger", barcode: "8901", sku: "CH1", category: "Mobile", price: 699, comparePrice: 799, costPrice: 500, stock: 10, isActive: true },
  { _id: "2", name: "Cable", category: "Mobile", price: 99, stock: 0, isActive: true },
  { _id: "3", name: "Dup", category: "Other", price: 1, stock: 1, isActive: true },
  { _id: "4", name: "dup", category: "Other", price: 1, stock: 1, isActive: true },
];
const plan = (csv: string) => planImport(parseCsv(csv), existing, resolve);

test("parseCsv handles quotes, commas, BOM, CRLF, blank lines and multi-line cells", () => {
  const t = parseCsv('﻿name,price\r\n"Cable, 1m",99\r\n"He said ""hi""",5\r\n\r\n');
  assert.equal(t.length, 3);
  assert.equal(t[1][0], "Cable, 1m");
  assert.equal(t[2][0], 'He said "hi"');
  assert.equal(parseCsv('name,price\n"a\nb",5')[1][0], "a\nb");
});

test("parseCsv detects ; and tab separators (Excel in some regions)", () => {
  assert.equal(parseCsv("name;price\nA;5")[1][1], "5");
  assert.equal(parseCsv("name\tprice\nA\t5")[1][1], "5");
});

test("existing products are matched by barcode, then SKU, then a unique name", () => {
  assert.equal(plan("name,barcode,store_price,stock\nCharger,8901,649,12").rows[0].productId, "1");
  assert.equal(plan("sku,stock\nch1,10").rows[0].action, "unchanged");
  assert.equal(plan("name,price\nCable,120").rows[0].productId, "2");
});

test("an update lists exactly what changes, and sets stock by difference", () => {
  const r = plan("name,barcode,store_price,stock\nCharger,8901,649,12").rows[0];
  assert.equal(r.action, "update");
  assert.equal(r.set!.price, 649);
  assert.equal(r.stockDelta, 2);
  assert.deepEqual(r.changes!.map((c) => c.field), ["Price", "Stock"]);
});

test("empty cells leave the product alone; unknown columns are reported and ignored", () => {
  const p = plan("name,price,colour\nCable,99,red");
  assert.equal(p.rows[0].action, "unchanged");
  assert.deepEqual(p.ignoredColumns, ["colour"]);
});

test("a name used by two products needs a barcode or SKU", () => {
  const r = plan("name,price\nDup,5").rows[0];
  assert.equal(r.action, "error");
  assert.match(r.error!, /barcode or SKU/);
});

test("new products start hidden, default to Other, and warn when MRP < price", () => {
  const r = plan("name,barcode,price,stock,category,mrp\nNew Thing,NEW123,50,5,mobile,40").rows[0];
  assert.equal(r.action, "create");
  assert.equal(r.set!.isActive, false);
  assert.equal(r.set!.category, "Mobile");
  assert.match(r.warning!, /MRP/);
  assert.equal(plan("name,price\nBrand New,10").rows[0].set!.category, "Other");
});

test("bad rows become row-level errors instead of failing the file", () => {
  const cases: [string, RegExp][] = [
    ["name,price\nOnly name,", /store price/],
    ["name,price\n,5", /no name, barcode or SKU/],
    ["name,price\nCable,-5", /valid amount/],
    ['name,price,stock\nCable,5,3.5', /whole number/],
    ["name,category,price\nCable,Toys,5", /Unknown category/],
    ["name,barcode,price\nZ,!!,5", /Barcode/],
    ["name,status\nCable,maybe", /Status/],
  ];
  for (const [csv, re] of cases) {
    const r = plan(csv).rows[0];
    assert.equal(r.action, "error", csv);
    assert.match(r.error!, re, csv);
  }
});

test("the same product twice in one file: only the first row counts", () => {
  const rows = plan("name,barcode,price\nA,8901,5\nB,8901,6").rows;
  assert.equal(rows[0].action, "update");
  assert.equal(rows[1].action, "error");
});

test("prices like ₹1,299.50 are understood", () => {
  assert.equal(plan('name,price\nCable,"₹1,299.50"').rows[0].set!.price, 1299.5);
});

test("a file with no usable columns or no rows gets a plain-language error", () => {
  assert.ok(plan("foo,bar\n1,2").error);
  assert.ok(plan("name").error);
});

test("an exported file imports back as 'unchanged' (the round trip)", () => {
  const r = plan("name,barcode,sku,brand,category,unit,mrp,store_price,cost_price,stock,stock_value_at_cost,status\nCharger,8901,CH1,,Mobile,,799,699,500,10,5000,active").rows[0];
  assert.equal(r.action, "unchanged");
});

test("spreadsheet formulas are neutralised on export and restored on import", () => {
  assert.equal(csvSafe("=1+1"), "'=1+1");
  assert.equal(csvSafe("ok"), "ok");
  assert.equal(plan("name,price\n'=EVIL(),5").rows[0].set!.name, "=EVIL()");
});

test("the downloadable template parses with its own columns", () => {
  const t = parseCsv(IMPORT_TEMPLATE);
  assert.equal(t.length, 2);
  assert.equal(planImport(t, [], resolve).rows[0].action, "create");
});
