import { normalizeBarcode } from "./catalog.js";

/** Stops a spreadsheet from running a cell as a formula (=, +, -, @ at the start). */
export const csvSafe = (v: any) => (typeof v === "string" && /^[=+\-@\t\r]/.test(v) ? `'${v}` : v);
const unsafe = (s: string) => (/^'[=+\-@\t\r]/.test(s) ? s.slice(1) : s); // undo csvSafe on the way back in

/** Reads CSV text (quotes, commas/newlines inside quotes, CRLF, BOM, ; or , or tab separated). */
export const parseCsv = (input: string): string[][] => {
  const text = input.replace(/^﻿/, "");
  const first = text.split(/\r?\n/, 1)[0] ?? "";
  const sep = [",", ";", "\t"].map((c) => [c, first.split(c).length] as const).sort((a, b) => b[1] - a[1])[0][0];
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += ch;
    } else if (ch === '"' && cell === "") q = true;
    else if (ch === sep) { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
};

const ALIASES: Record<string, string[]> = {
  name: ["name", "productname", "product", "item", "itemname", "title"],
  barcode: ["barcode", "ean", "upc", "code", "barcodeno"],
  sku: ["sku", "itemcode", "productcode"],
  brand: ["brand", "make", "manufacturer"],
  category: ["category", "type", "group"],
  unit: ["unit", "uom", "pack"],
  mrp: ["mrp", "comparepric", "compareprice", "listprice", "maxretailprice"],
  price: ["storeprice", "price", "sellingprice", "saleprice", "sp", "ourprice"],
  cost: ["costprice", "cost", "purchaseprice", "buyprice", "cp"],
  stock: ["stock", "quantity", "qty", "onhand", "stockqty"],
  status: ["status", "visibility"],
};
const norm = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, "");
export const FIELD_OF = new Map<string, string>(Object.entries(ALIASES).flatMap(([f, a]) => a.map((x) => [x, f] as [string, string])));

export type Existing = { _id: any; name: string; barcode?: string; sku?: string; category: string; price: number; comparePrice?: number | null; costPrice?: number | null; stock: number; isActive: boolean; brand?: string; unit?: string };
export type PlanRow = {
  line: number; // line number in the file (header = 1)
  action: "create" | "update" | "unchanged" | "error";
  name?: string;
  productId?: any;
  set?: Record<string, any>; // fields to write
  stockDelta?: number;
  changes?: { field: string; from: any; to: any }[];
  error?: string;
  warning?: string;
};
export type Plan = { rows: PlanRow[]; ignoredColumns: string[]; error?: string };

const money = (raw: string | undefined, label: string): number | undefined | { err: string } => {
  const s = (raw ?? "").trim().replace(/[₹,\s]|rs\.?/gi, "");
  if (s === "") return undefined;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return { err: `${label} "${raw}" is not a valid amount` };
  return Math.round(n * 100) / 100;
};
const bad = (v: any): v is { err: string } => typeof v === "object" && v !== null && "err" in v;

/**
 * Works out what a CSV would do to a shop's products, without touching anything.
 * Products are matched by barcode, then SKU, then an unambiguous exact name.
 * Rows that don't match are new products: they start hidden until a photo is added.
 */
export const planImport = (
  table: string[][],
  existing: Existing[],
  resolveCat: (raw: string) => string | null,
): Plan => {
  if (table.length < 2) return { rows: [], ignoredColumns: [], error: "The file has no data rows. The first row must be the column names." };
  const cols: (string | null)[] = table[0].map((h) => FIELD_OF.get(norm(h)) ?? null);
  const ignoredColumns = table[0].filter((_, i) => !cols[i]).map((h) => h.trim()).filter(Boolean);
  const has = (f: string) => cols.includes(f);
  if (!has("name") && !has("barcode") && !has("sku")) {
    return { rows: [], ignoredColumns, error: "Couldn't find a column for name, barcode or SKU. Check the first row has column names (see the template)." };
  }

  const byBarcode = new Map(existing.filter((p) => p.barcode).map((p) => [p.barcode!, p]));
  const bySku = new Map(existing.filter((p) => p.sku).map((p) => [p.sku!.toLowerCase(), p]));
  const nameCount = new Map<string, Existing[]>();
  for (const p of existing) { const k = p.name.trim().toLowerCase(); nameCount.set(k, [...(nameCount.get(k) ?? []), p]); }

  const seen = new Set<string>();
  const out: PlanRow[] = [];

  table.slice(1).forEach((cells, idx) => {
    const line = idx + 2;
    const get = (f: string) => { const i = cols.indexOf(f); return i >= 0 ? unsafe((cells[i] ?? "").trim()) : ""; };
    const fail = (error: string): void => { out.push({ line, action: "error", name: get("name") || get("barcode") || get("sku"), error }); };

    const name = get("name").slice(0, 120);
    const barcodeRaw = get("barcode");
    const barcode = barcodeRaw ? normalizeBarcode(barcodeRaw) : null;
    if (barcodeRaw && !barcode) return fail(`Barcode "${barcodeRaw}" must be 3-32 letters, numbers, dots, dashes or underscores`);
    const sku = get("sku").slice(0, 60);

    let match: Existing | undefined = (barcode && byBarcode.get(barcode)) || (sku ? bySku.get(sku.toLowerCase()) : undefined);
    if (!match && !barcode && !sku && name) {
      const same = nameCount.get(name.toLowerCase()) ?? [];
      if (same.length === 1) match = same[0];
      else if (same.length > 1) return fail(`More than one of your products is called "${name}". Add a barcode or SKU to say which`);
    }
    const key = match ? `p:${match._id}` : barcode ? `b:${barcode}` : sku ? `s:${sku.toLowerCase()}` : name ? `n:${name.toLowerCase()}` : "";
    if (!key) return fail("Row has no name, barcode or SKU");
    if (seen.has(key)) return fail("This product appears earlier in the file; only the first row is used");
    seen.add(key);

    const mrp = money(get("mrp"), "MRP"); if (bad(mrp)) return fail(mrp.err);
    const price = money(get("price"), "Price"); if (bad(price)) return fail(price.err);
    const cost = money(get("cost"), "Cost price"); if (bad(cost)) return fail(cost.err);
    let stock: number | undefined;
    const stockRaw = get("stock");
    if (stockRaw !== "") {
      const n = Number(stockRaw.replace(/,/g, ""));
      if (!Number.isInteger(n) || n < 0 || n > 1_000_000) return fail(`Stock "${stockRaw}" must be a whole number, 0 or more`);
      stock = n;
    }
    let category: string | undefined;
    const catRaw = get("category");
    if (catRaw) {
      const c = resolveCat(catRaw);
      if (!c) return fail(`Unknown category "${catRaw}". Ask the store team to add it, or leave it blank`);
      category = c;
    }
    const brand = get("brand").slice(0, 60), unit = get("unit").slice(0, 60);
    const statusRaw = get("status").toLowerCase();
    const isActive = statusRaw === "" ? undefined : ["active", "visible", "yes", "true", "1", "live"].includes(statusRaw) ? true : ["hidden", "inactive", "no", "false", "0", "draft"].includes(statusRaw) ? false : null;
    if (isActive === null) return fail(`Status "${statusRaw}" should be active or hidden`);

    if (!match) {
      if (!name) return fail("New product needs a name");
      if (price === undefined) return fail("New product needs a store price");
      const set: Record<string, any> = { name, price, stock: stock ?? 0, category: category ?? "Other", isActive: false };
      if (barcode) set.barcode = barcode;
      if (sku) set.sku = sku;
      if (brand) set.brand = brand;
      if (unit) set.unit = unit;
      if (mrp !== undefined) set.comparePrice = mrp;
      if (cost !== undefined) set.costPrice = cost;
      out.push({ line, action: "create", name, set, stockDelta: set.stock, warning: mrp !== undefined && mrp < price ? "MRP is lower than the store price" : undefined });
      return;
    }

    const set: Record<string, any> = {};
    const changes: PlanRow["changes"] = [];
    const diff = (field: string, key: string, from: any, to: any) => { if (to !== undefined && to !== from) { set[key] = to; changes!.push({ field, from: from ?? "", to }); } };
    diff("Name", "name", match.name, name || undefined);
    diff("Category", "category", match.category, category);
    diff("Brand", "brand", match.brand, brand || undefined);
    diff("Unit", "unit", match.unit, unit || undefined);
    diff("MRP", "comparePrice", match.comparePrice, mrp);
    diff("Price", "price", match.price, price);
    diff("Cost price", "costPrice", match.costPrice, cost);
    diff("Visibility", "isActive", match.isActive, isActive ?? undefined);
    if (barcode && !match.barcode) { set.barcode = barcode; changes!.push({ field: "Barcode", from: "", to: barcode }); }
    if (sku && !match.sku) { set.sku = sku; changes!.push({ field: "SKU", from: "", to: sku }); }
    let stockDelta = 0;
    if (stock !== undefined && stock !== match.stock) { stockDelta = stock - match.stock; changes!.push({ field: "Stock", from: match.stock, to: stock }); }
    const finalPrice = (set.price as number | undefined) ?? match.price;
    const finalMrp = (set.comparePrice as number | undefined) ?? match.comparePrice ?? undefined;
    out.push(changes!.length
      ? { line, action: "update", name: match.name, productId: match._id, set, stockDelta, changes, warning: finalMrp !== undefined && finalMrp < finalPrice ? "MRP is lower than the store price" : undefined }
      : { line, action: "unchanged", name: match.name, productId: match._id });
  });
  return { rows: out, ignoredColumns };
};

export const IMPORT_TEMPLATE =
  "name,barcode,sku,brand,category,unit,mrp,store_price,cost_price,stock\n" +
  "Example Charger 20W,8901234567890,CH-20,Acme,Other,pcs,799,699,520,10\n";
