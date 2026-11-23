import Category from "../models/Category.js";
import Product from "../models/Products.js";
import { PRODUCT_CATEGORIES } from "../types/index.js";

/** The catch-all. It can't be deleted, renamed or hidden, so a product always has somewhere to go. */
export const FALLBACK_CATEGORY = "Other";

export const cleanCategoryName = (raw: unknown): string => String(raw ?? "").replace(/\s+/g, " ").trim();
export const categoryKey = (name: string) => cleanCategoryName(name).toLowerCase();

/** Returns an error message, or "" when the name is fine. Commas are out because shops store category lists as text. */
export const categoryNameProblem = (name: string): string => {
  if (name.length < 2) return "Category name must be at least 2 characters";
  if (name.length > 40) return "Category name can be at most 40 characters";
  if (/[,<>]/.test(name)) return "Category name can't contain commas or < >";
  return "";
};

let cache: { at: number; names: string[]; all: string[] } | null = null;
const TTL_MS = 30_000;
export const invalidateCategories = () => { cache = null; };

const load = async () => {
  if (cache && Date.now() - cache.at < TTL_MS) return cache;
  const rows: any[] = await Category.find().sort({ order: 1, name: 1 }).lean();
  cache = { at: Date.now(), names: rows.filter((r) => r.isActive).map((r) => r.name), all: rows.map((r) => r.name) };
  return cache;
};

/** Visible categories in the admin's order (what customers and shop forms offer). */
export const activeCategoryNames = async (): Promise<string[]> => {
  try {
    const c = await load();
    return c.names.length ? c.names : [...PRODUCT_CATEGORIES];
  } catch {
    return [...PRODUCT_CATEGORIES]; // database hiccup: the storefront still works
  }
};

/**
 * Matches what a client sent (any capitalisation) to the real category name.
 * Hidden categories are refused for new choices, unless it's the one the product already has.
 */
export const resolveCategory = async (raw: unknown, current?: string): Promise<string | null> => {
  const key = categoryKey(String(raw ?? ""));
  if (!key) return null;
  if (current && categoryKey(current) === key) return current;
  const c = await load();
  return c.names.find((n) => categoryKey(n) === key) ?? null;
};

/** Run at start-up: first run fills in the original list, and any category already used by a product is kept. */
export const ensureCategories = async () => {
  try {
    const have: any[] = await Category.find().select("name").lean();
    const keys = new Set(have.map((c) => categoryKey(c.name)));
    let order = have.length;
    const add: any[] = [];
    const want = have.length === 0 ? [...PRODUCT_CATEGORIES] : [];
    const used: string[] = (await Product.distinct("category")).filter(Boolean);
    for (const name of [...want, ...used, FALLBACK_CATEGORY]) {
      const n = cleanCategoryName(name);
      if (!n || keys.has(categoryKey(n))) continue;
      keys.add(categoryKey(n));
      add.push({ name: n, nameKey: categoryKey(n), order: order++, isActive: true });
    }
    if (add.length) await Category.insertMany(add, { ordered: false });
    invalidateCategories();
  } catch (error: any) {
    console.error("ensureCategories failed:", error.message);
  }
};
