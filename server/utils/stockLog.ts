import StockMovement, { MOVEMENT_REASONS } from "../models/StockMovement.js";
import Product from "../models/Products.js";

export type MovementReason = (typeof MOVEMENT_REASONS)[number];
type Row = { product: any; delta: number; reason: MovementReason; note?: string; costPrice?: number; by?: any; shop?: any };

/**
 * Writes stock history. It must NEVER break the thing it is logging (an order, a restock), so
 * every error is swallowed. Rows without a shop get it from the product; platform products
 * (no shop) are not logged.
 */
export const logMovements = async (rows: Row[]) => {
  try {
    const clean = rows.filter((r) => r.delta !== 0);
    if (!clean.length) return;
    const missing = clean.filter((r) => !r.shop).map((r) => r.product);
    const shopOf = new Map<string, any>();
    if (missing.length) {
      const prods: any[] = await Product.find({ _id: { $in: missing } }).select("shop").lean();
      prods.forEach((p) => p.shop && shopOf.set(String(p._id), p.shop));
    }
    const docs = clean
      .map((r) => ({ ...r, shop: r.shop || shopOf.get(String(r.product)) }))
      .filter((r) => r.shop);
    if (docs.length) await StockMovement.insertMany(docs, { ordered: false });
  } catch (e) {
    console.error("stock log skipped:", (e as Error).message);
  }
};
