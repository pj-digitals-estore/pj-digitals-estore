import { Request, Response } from "express";
import mongoose from "mongoose";
import Product from "../models/Products.js";
import CatalogItem from "../models/CatalogItem.js";
import StockMovement, { MOVEMENT_REASONS } from "../models/StockMovement.js";
import { escapeRegex, round2, sendError } from "../utils/http.js";
import { getSettings } from "../utils/settings.js";
import { toCsv } from "../utils/payouts.js";
import { normalizeBarcode } from "../utils/catalog.js";
import { logMovements, MovementReason } from "../utils/stockLog.js";

/**
 * Stock tools for a shop (the "dealer" side). Everything here is scoped to req.shop, which
 * loadShop(true) fills in for approved shop owners (and for an admin acting as that shop).
 */

const intQty = (v: any) => {
  const n = Number(v);
  return Number.isInteger(n) ? n : NaN;
};

// ---------------------------------------------------------------- list + totals

const buildFilter = async (req: Request) => {
  const q: any = { shop: req.shop._id };
  const low = (await getSettings()).lowStockLevel;
  const filter = String(req.query.filter || "all");
  if (filter === "out") q.stock = 0;
  else if (filter === "low") q.stock = { $gt: 0, $lte: low };
  else if (filter === "in") q.stock = { $gt: low };
  if (req.query.isActive === "true" || req.query.isActive === "false") q.isActive = req.query.isActive === "true";

  const search = String(req.query.search || "").trim();
  if (search) {
    const rx = new RegExp(escapeRegex(search), "i");
    q.$or = [{ name: rx }, { barcode: rx }, { sku: rx }, { brand: rx }];
  }
  return { q, low };
};

const SORTS: Record<string, any> = {
  updated: { updatedAt: -1, _id: 1 },
  name: { name: 1, _id: 1 },
  stock_asc: { stock: 1, _id: 1 },
  stock_desc: { stock: -1, _id: 1 },
};

// GET /api/shop/inventory?filter=all|low|out|in&search=&sort=&page=&limit=
export const getInventory = async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const { q, low } = await buildFilter(req);
    const [total, products] = await Promise.all([
      Product.countDocuments(q),
      Product.find(q)
        .select("+costPrice")
        .sort(SORTS[String(req.query.sort)] || SORTS.updated)
        .skip((page - 1) * limit)
        .limit(limit),
    ]);
    res.json({ success: true, data: products, lowStockLevel: low, pagination: { total, page, pages: Math.ceil(total / limit) } });
  } catch (error) {
    sendError(res, error, "Failed to load stock");
  }
};

// GET /api/shop/inventory/summary
export const getInventorySummary = async (req: Request, res: Response) => {
  try {
    const low = (await getSettings()).lowStockLevel;
    const [row] = await Product.aggregate([
      { $match: { shop: req.shop._id } },
      {
        $group: {
          _id: null,
          products: { $sum: 1 },
          units: { $sum: "$stock" },
          out: { $sum: { $cond: [{ $eq: ["$stock", 0] }, 1, 0] } },
          low: { $sum: { $cond: [{ $and: [{ $gt: ["$stock", 0] }, { $lte: ["$stock", low] }] }, 1, 0] } },
          valueAtCost: { $sum: { $multiply: ["$stock", { $ifNull: ["$costPrice", 0] }] } },
          valueAtPrice: { $sum: { $multiply: ["$stock", "$price"] } },
          // stock for which a cost price is known; margin is only meaningful for those
          pricedUnits: { $sum: { $cond: [{ $gt: ["$costPrice", null] }, "$stock", 0] } },
          pricedValueAtPrice: { $sum: { $cond: [{ $gt: ["$costPrice", null] }, { $multiply: ["$stock", "$price"] }, 0] } },
          pricedValueAtCost: { $sum: { $cond: [{ $gt: ["$costPrice", null] }, { $multiply: ["$stock", "$costPrice"] }, 0] } },
          withoutCost: { $sum: { $cond: [{ $gt: ["$costPrice", null] }, 0, 1] } },
          withoutBarcode: { $sum: { $cond: [{ $gt: ["$barcode", null] }, 0, 1] } },
        },
      },
    ]);
    const r = row || {};
    res.json({
      success: true,
      data: {
        products: r.products || 0,
        units: r.units || 0,
        out: r.out || 0,
        low: r.low || 0,
        lowStockLevel: low,
        valueAtCost: round2(r.valueAtCost || 0),
        valueAtPrice: round2(r.valueAtPrice || 0),
        // expected profit if everything sells at today's price, counting only products with a known cost
        expectedProfit: round2((r.pricedValueAtPrice || 0) - (r.pricedValueAtCost || 0)),
        withoutCost: r.withoutCost || 0,
        withoutBarcode: r.withoutBarcode || 0,
      },
    });
  } catch (error) {
    sendError(res, error, "Failed to load the stock summary");
  }
};

// ---------------------------------------------------------------- barcode lookup

// GET /api/shop/inventory/lookup?barcode=...
// -> { inShop: product | null, catalog: item | null }
export const lookupBarcode = async (req: Request, res: Response) => {
  try {
    const barcode = normalizeBarcode(req.query.barcode);
    if (!barcode) return res.status(400).json({ success: false, message: "That does not look like a valid barcode." });
    const [inShop, catalog] = await Promise.all([
      Product.findOne({ shop: req.shop._id, barcode }).select("+costPrice"),
      CatalogItem.findOne({ barcode }),
    ]);
    res.json({ success: true, data: { barcode, inShop, catalog } });
  } catch (error) {
    sendError(res, error, "Barcode lookup failed");
  }
};

// ---------------------------------------------------------------- receive stock (scan in)

// POST /api/shop/inventory/receive
// body: { items: [{ productId, quantity, costPrice? }], note? }
// All-or-nothing is not needed here: each line is independent, and the answer lists what failed.
export const receiveStock = async (req: Request, res: Response) => {
  try {
    const items: any[] = Array.isArray(req.body?.items) ? req.body.items : [];
    if (!items.length) return res.status(400).json({ success: false, message: "Nothing to receive." });
    if (items.length > 200) return res.status(400).json({ success: false, message: "Too many lines at once (max 200)." });
    const note = typeof req.body?.note === "string" ? req.body.note.trim().slice(0, 200) : undefined;

    const results: any[] = [];
    const moves: any[] = [];
    for (const it of items) {
      const qty = intQty(it?.quantity);
      if (!mongoose.isValidObjectId(it?.productId) || !Number.isInteger(qty) || qty < 1 || qty > 100000) {
        results.push({ productId: it?.productId, ok: false, message: "Invalid line" });
        continue;
      }
      const set: any = {};
      if (it.costPrice !== undefined && String(it.costPrice).trim() !== "") {
        const c = Number(it.costPrice);
        if (!Number.isFinite(c) || c < 0) { results.push({ productId: it.productId, ok: false, message: "Invalid cost price" }); continue; }
        set.costPrice = c;
      }
      const p: any = await Product.findOneAndUpdate(
        { _id: it.productId, shop: req.shop._id }, // can only restock your own products
        { $inc: { stock: qty }, ...(Object.keys(set).length && { $set: set }) },
        { new: true },
      );
      if (!p) { results.push({ productId: it.productId, ok: false, message: "Product not found" }); continue; }
      results.push({ productId: p._id, ok: true, name: p.name, stock: p.stock });
      moves.push({ shop: req.shop._id, product: p._id, delta: qty, reason: "restock", note, costPrice: set.costPrice, by: req.user?._id });
    }
    await logMovements(moves);
    const failed = results.filter((r) => !r.ok).length;
    res.status(failed === results.length ? 400 : 200).json({
      success: failed < results.length,
      message: failed ? `${results.length - failed} received, ${failed} failed.` : `${results.length} product${results.length === 1 ? "" : "s"} restocked.`,
      data: results,
    });
  } catch (error) {
    sendError(res, error, "Failed to receive stock");
  }
};

// ---------------------------------------------------------------- history

// GET /api/shop/inventory/movements?product=&reason=&page=&limit=
export const getMovements = async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30));
    const q: any = { shop: req.shop._id };
    if (req.query.product) {
      if (!mongoose.isValidObjectId(req.query.product)) return res.status(400).json({ success: false, message: "Invalid product" });
      q.product = req.query.product;
    }
    if (req.query.reason && (MOVEMENT_REASONS as readonly string[]).includes(String(req.query.reason))) q.reason = req.query.reason;
    const [total, rows] = await Promise.all([
      StockMovement.countDocuments(q),
      StockMovement.find(q)
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("product", "name barcode images")
        .populate("by", "name"),
    ]);
    res.json({ success: true, data: rows, pagination: { total, page, pages: Math.ceil(total / limit) } });
  } catch (error) {
    sendError(res, error, "Failed to load the stock history");
  }
};

// ---------------------------------------------------------------- manual change (with a reason)

const MANUAL_REASONS: MovementReason[] = ["adjust", "damage", "return", "count"];

// POST /api/shop/inventory/:id/adjust   body: { delta, reason?, note? }  or  { set, note? } (stock count)
export const adjustStock = async (req: Request, res: Response) => {
  try {
    const { delta, set } = req.body || {};
    const note = typeof req.body?.note === "string" ? req.body.note.trim().slice(0, 200) : undefined;
    let reason: MovementReason = MANUAL_REASONS.includes(req.body?.reason) ? req.body.reason : "adjust";

    const filter: any = { _id: req.params.id, shop: req.shop._id };
    let moved: number;
    let product: any;

    if (set !== undefined) {
      const n = intQty(set);
      if (!Number.isInteger(n) || n < 0 || n > 10_000_000) return res.status(400).json({ success: false, message: "Stock must be a whole number, 0 or more." });
      const before: any = await Product.findOneAndUpdate(filter, { stock: n }, { new: false });
      if (!before) return res.status(404).json({ success: false, message: "Product not found" });
      moved = n - before.stock;
      reason = "count";
      product = { ...before.toObject(), stock: n };
    } else {
      const d = intQty(delta);
      if (!Number.isInteger(d) || d === 0 || Math.abs(d) > 100000) return res.status(400).json({ success: false, message: "Change must be a non-zero whole number." });
      if (reason === "damage" && d > 0) return res.status(400).json({ success: false, message: "Damaged or lost stock must be a negative change." });
      if (reason === "return" && d < 0) return res.status(400).json({ success: false, message: "A customer return must be a positive change." });
      if (d < 0) filter.stock = { $gte: -d }; // never below zero
      product = await Product.findOneAndUpdate(filter, { $inc: { stock: d } }, { new: true });
      if (!product) return res.status(404).json({ success: false, message: "Product not found (or not enough stock to remove)" });
      moved = d;
    }
    await logMovements([{ shop: req.shop._id, product: product._id, delta: moved, reason, note, by: req.user?._id }]);
    res.json({ success: true, data: product });
  } catch (error) {
    sendError(res, error, "Failed to change stock");
  }
};

// ---------------------------------------------------------------- export

// Spreadsheets run text starting with = + - @ as a formula; a leading apostrophe makes it plain text.
const safe = (v: any) => (typeof v === "string" && /^[=+\-@\t\r]/.test(v) ? `'${v}` : v);

// GET /api/shop/inventory/export.csv
export const exportInventory = async (req: Request, res: Response) => {
  try {
    const list: any[] = await Product.find({ shop: req.shop._id }).select("+costPrice").sort("name").limit(10000).lean();
    const rows = list.map((p) => ({
      name: safe(p.name),
      barcode: safe(p.barcode ?? ""),
      sku: safe(p.sku ?? ""),
      brand: safe(p.brand ?? ""),
      category: p.category,
      unit: safe(p.unit ?? ""),
      mrp: p.comparePrice ?? "",
      store_price: p.price,
      cost_price: p.costPrice ?? "",
      stock: p.stock,
      stock_value_at_cost: p.costPrice != null ? round2(p.costPrice * p.stock) : "",
      status: p.isActive ? "active" : "hidden",
    }));
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="my-stock.csv"');
    res.send("﻿" + (rows.length ? toCsv(rows) : "name,barcode,stock"));
  } catch (error) {
    sendError(res, error, "Failed to export");
  }
};
