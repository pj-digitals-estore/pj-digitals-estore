import { Request, Response } from "express";
import Category from "../models/Category.js";
import Product from "../models/Products.js";
import CatalogItem from "../models/CatalogItem.js";
import Shop from "../models/Shop.js";
import { HttpError, sendError } from "../utils/http.js";
import { logActivity } from "../utils/activity.js";
import { FALLBACK_CATEGORY, categoryKey, categoryNameProblem, cleanCategoryName, invalidateCategories } from "../utils/categories.js";

const isFallback = (name: string) => categoryKey(name) === categoryKey(FALLBACK_CATEGORY);

// GET /api/admin/categories  - every category with how much uses it
export const adminListCategories = async (_req: Request, res: Response) => {
  try {
    const [rows, products, shops] = await Promise.all([
      Category.find().sort({ order: 1, name: 1 }).lean(),
      Product.aggregate([{ $group: { _id: "$category", n: { $sum: 1 } } }]),
      Shop.aggregate([{ $unwind: "$categories" }, { $group: { _id: "$categories", n: { $sum: 1 } } }]),
    ]);
    const pc = new Map(products.map((p: any) => [p._id, p.n]));
    const sc = new Map(shops.map((p: any) => [p._id, p.n]));
    res.json({
      success: true,
      data: rows.map((c: any) => ({ ...c, products: pc.get(c.name) ?? 0, shops: sc.get(c.name) ?? 0, locked: isFallback(c.name) })),
    });
  } catch (error) {
    sendError(res, error, "Failed to load categories");
  }
};

// POST /api/admin/categories { name }
export const adminCreateCategory = async (req: Request, res: Response) => {
  try {
    const name = cleanCategoryName(req.body.name);
    const bad = categoryNameProblem(name);
    if (bad) throw new HttpError(400, bad);
    if (await Category.exists({ nameKey: categoryKey(name) })) throw new HttpError(409, `"${name}" already exists`);
    const last: any = await Category.findOne().sort({ order: -1 }).select("order").lean();
    const cat = await Category.create({ name, nameKey: categoryKey(name), order: (last?.order ?? -1) + 1, isActive: true });
    invalidateCategories();
    await logActivity(req, "category.created", "Category", cat._id, { name });
    res.status(201).json({ success: true, data: cat });
  } catch (error: any) {
    if (error?.code === 11000) return void res.status(409).json({ success: false, message: "That category already exists" });
    sendError(res, error, "Failed to create category");
  }
};

// PUT /api/admin/categories/:id { name?, isActive? }   (a new name is applied to every product, catalogue item and shop)
export const adminUpdateCategory = async (req: Request, res: Response) => {
  try {
    const cat: any = await Category.findById(req.params.id);
    if (!cat) throw new HttpError(404, "Category not found");
    const oldName: string = cat.name;
    const out: any = { renamed: false, productsUpdated: 0 };

    if (req.body.isActive !== undefined) {
      const on = req.body.isActive === true || req.body.isActive === "true";
      if (!on && isFallback(oldName)) throw new HttpError(400, `"${oldName}" can't be hidden`);
      cat.isActive = on;
    }
    if (req.body.name !== undefined) {
      const name = cleanCategoryName(req.body.name);
      if (name !== oldName) {
        if (isFallback(oldName)) throw new HttpError(400, `"${oldName}" can't be renamed`);
        const bad = categoryNameProblem(name);
        if (bad) throw new HttpError(400, bad);
        const clash = await Category.exists({ nameKey: categoryKey(name), _id: { $ne: cat._id } });
        if (clash) throw new HttpError(409, `"${name}" already exists. Use delete → move products to merge them.`);
        cat.name = name;
        cat.nameKey = categoryKey(name);
        out.renamed = true;
      }
    }
    await cat.save();
    if (out.renamed) {
      const r = await Product.updateMany({ category: oldName }, { $set: { category: cat.name } });
      out.productsUpdated = r.modifiedCount;
      await CatalogItem.updateMany({ category: oldName }, { $set: { category: cat.name } });
      await Shop.updateMany({ categories: oldName }, { $set: { "categories.$[c]": cat.name } }, { arrayFilters: [{ c: oldName }] });
    }
    invalidateCategories();
    await logActivity(req, "category.updated", "Category", cat._id, { from: oldName, to: cat.name, isActive: cat.isActive });
    res.json({ success: true, data: cat, ...out });
  } catch (error: any) {
    if (error?.code === 11000) return void res.status(409).json({ success: false, message: "That category already exists" });
    sendError(res, error, "Failed to update category");
  }
};

// PUT /api/admin/categories/order { ids: [...] }  - the order customers see
export const adminReorderCategories = async (req: Request, res: Response) => {
  try {
    const ids: string[] = Array.isArray(req.body.ids) ? req.body.ids.map(String) : [];
    if (!ids.length) throw new HttpError(400, "ids is required");
    await Category.bulkWrite(ids.map((id, i) => ({ updateOne: { filter: { _id: id }, update: { $set: { order: i } } } })));
    invalidateCategories();
    res.json({ success: true });
  } catch (error) {
    sendError(res, error, "Failed to reorder categories");
  }
};

// DELETE /api/admin/categories/:id?moveTo=<name>
// A category that's in use needs somewhere to send its products ("Other" unless moveTo says otherwise).
export const adminDeleteCategory = async (req: Request, res: Response) => {
  try {
    const cat: any = await Category.findById(req.params.id);
    if (!cat) throw new HttpError(404, "Category not found");
    if (isFallback(cat.name)) throw new HttpError(400, `"${cat.name}" can't be deleted`);

    const targetName = cleanCategoryName(req.query.moveTo || FALLBACK_CATEGORY);
    const target: any = await Category.findOne({ nameKey: categoryKey(targetName) });
    if (!target) throw new HttpError(400, `"${targetName}" isn't a category`);
    if (String(target._id) === String(cat._id)) throw new HttpError(400, "Choose a different category to move products to");

    const moved = await Product.updateMany({ category: cat.name }, { $set: { category: target.name } });
    await CatalogItem.updateMany({ category: cat.name }, { $set: { category: target.name } });
    // shops listing this category now list the target instead (once)
    const shops: any[] = await Shop.find({ categories: cat.name }).select("categories");
    for (const s of shops) {
      s.categories = [...new Set(s.categories.map((c: string) => (c === cat.name ? target.name : c)))];
      await s.save();
    }
    await cat.deleteOne();
    invalidateCategories();
    await logActivity(req, "category.deleted", "Category", cat._id, { name: cat.name, movedTo: target.name, products: moved.modifiedCount });
    res.json({ success: true, moved: moved.modifiedCount, movedTo: target.name });
  } catch (error) {
    sendError(res, error, "Failed to delete category");
  }
};
