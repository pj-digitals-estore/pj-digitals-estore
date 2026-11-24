import CatalogItem from "../models/CatalogItem.js";
import { cloneImage } from "./imageStore.js";

import { normalizeBarcode } from "./barcode.js";
export { normalizeBarcode };

const num = (v: unknown) => {
  if (v === undefined || v === null || String(v).trim() === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : NaN;
};

/**
 * Reads the optional product fields (barcode, sku, brand, unit, costPrice) from a request body.
 * Sent as an empty string = remove the value. Returns what to $set, what to $unset, or an error.
 */
export const cleanExtras = (body: any) => {
  const set: Record<string, any> = {};
  const unset: Record<string, 1> = {};
  let error: string | undefined;

  for (const f of ["barcode", "sku", "brand", "unit"] as const) {
    if (body[f] === undefined) continue;
    const v = String(body[f]).trim();
    if (!v) { unset[f] = 1; continue; }
    if (f === "barcode") {
      const b = normalizeBarcode(v);
      if (!b) { error = "Barcode must be 3-32 letters, numbers, dots, dashes or underscores."; continue; }
      set.barcode = b;
    } else {
      set[f] = v.slice(0, 60);
    }
  }

  if (body.costPrice !== undefined) {
    const n = num(body.costPrice);
    if (n === undefined) unset.costPrice = 1;
    else if (Number.isNaN(n)) error = "Cost price must be a number, 0 or more.";
    else set.costPrice = n;
  }
  return { set, unset, error };
};

/**
 * Remember a product's public details under its barcode so other shops can pre-fill them.
 * First writer wins (later shops cannot overwrite it); only fills in what is still missing.
 * Failure here must never fail the product save.
 */
export const rememberInCatalog = async (product: any, shopId?: any) => {
  try {
    const barcode = normalizeBarcode(product?.barcode);
    if (!barcode) return;
    const existing: any = await CatalogItem.findOne({ barcode });
    if (!existing) {
      const image = await cloneImage(product.images?.[0], "catalog");
      await CatalogItem.create({
        barcode,
        name: product.name,
        brand: product.brand,
        category: product.category,
        description: product.description,
        unit: product.unit,
        mrp: product.comparePrice,
        image: image || undefined,
        createdByShop: shopId || undefined,
      });
      return;
    }
    const fill: Record<string, any> = {};
    for (const k of ["brand", "category", "description", "unit"] as const) if (!existing[k] && product[k]) fill[k] = product[k];
    if (existing.mrp == null && product.comparePrice != null) fill.mrp = product.comparePrice;
    if (!existing.image && product.images?.[0]) {
      const image = await cloneImage(product.images[0], "catalog");
      if (image) fill.image = image;
    }
    if (Object.keys(fill).length) await CatalogItem.updateOne({ _id: existing._id }, { $set: fill });
  } catch (e) {
    console.error("catalogue update skipped:", (e as Error).message);
  }
};
