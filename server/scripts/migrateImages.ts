/**
 * One-time move of existing Cloudinary images to your own storage.
 *
 *   docker compose exec api pnpm exec tsx scripts/migrateImages.ts --dry-run   (just count)
 *   docker compose exec api pnpm exec tsx scripts/migrateImages.ts             (do it)
 *
 * Safe to run again: it only touches images still on Cloudinary, never deletes anything on
 * Cloudinary, and re-uses one copy when the same image is used in several places.
 * If a download fails, that image keeps its old URL and is retried on the next run.
 */
import "dotenv/config";
import mongoose from "mongoose";
import connectDB from "../config/db.js";
import Product from "../models/Products.js";
import Shop from "../models/Shop.js";
import Advertisement from "../models/Advertisement.js";
import DeliveryPartner from "../models/DeliveryPartner.js";
import Order from "../models/Order.js";
import { saveImageBuffer } from "../utils/imageStore.js";

const DRY = process.argv.includes("--dry-run");
const isCloud = (u: unknown): u is string => typeof u === "string" && /^https?:\/\/res\.cloudinary\.com\//.test(u);

const cache = new Map<string, string | null>();
const stats = { found: 0, moved: 0, failed: 0 };

const move = async (url: string, folder: string): Promise<string | null> => {
  stats.found++;
  if (cache.has(url)) return cache.get(url)!;
  if (DRY) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const saved = await saveImageBuffer(Buffer.from(await res.arrayBuffer()), folder);
    cache.set(url, saved.url);
    stats.moved++;
    return saved.url;
  } catch (e: any) {
    stats.failed++;
    console.error(`  FAILED ${url}: ${e.message}`);
    cache.set(url, null);
    return null;
  }
};

const run = async () => {
  await connectDB();
  console.log(DRY ? "DRY RUN: nothing will be changed\n" : "Moving images...\n");

  // single-field documents
  const singles: [string, any, string, string][] = [
    ["shop logos", Shop, "logo", "shops"],
    ["ads", Advertisement, "image", "ads"],
    ["driver photos", DeliveryPartner, "photo", "drivers"],
  ];
  for (const [label, Model, field, folder] of singles) {
    const docs = await Model.find({ [field]: /^https?:\/\/res\.cloudinary\.com\// }).select(field).lean();
    console.log(`${label}: ${docs.length}`);
    for (const d of docs as any[]) {
      const next = await move(d[field], folder);
      if (next) await Model.updateOne({ _id: d._id }, { $set: { [field]: next } });
    }
  }

  // products: images[]
  const products = await Product.find({ images: /^https?:\/\/res\.cloudinary\.com\// }).select("images").lean();
  console.log(`products: ${products.length}`);
  for (const p of products as any[]) {
    const images: string[] = [];
    for (const img of p.images as string[]) images.push(isCloud(img) ? ((await move(img, "products")) ?? img) : img);
    if (!DRY && images.some((v, i) => v !== p.images[i])) await Product.updateOne({ _id: p._id }, { $set: { images } });
  }

  // order lines keep a copy of the product image
  const orders = await Order.find({ "items.image": /^https?:\/\/res\.cloudinary\.com\// }).select("items.image").lean();
  console.log(`orders: ${orders.length}`);
  for (const o of orders as any[]) {
    const set: Record<string, string> = {};
    for (let i = 0; i < o.items.length; i++) {
      const img = o.items[i].image;
      if (!isCloud(img)) continue;
      const next = await move(img, "products");
      if (next) set[`items.${i}.image`] = next;
    }
    if (!DRY && Object.keys(set).length) await Order.updateOne({ _id: o._id }, { $set: set });
  }

  console.log(`\nImages found on Cloudinary: ${stats.found}${DRY ? "" : `, moved: ${stats.moved}, failed: ${stats.failed}`}`);
  if (!DRY && stats.failed) console.log("Run it again to retry the failed ones.");
  await mongoose.disconnect();
};

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
