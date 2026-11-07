import { productImages } from '../lib/productImages.js';
import { failure } from '../lib/respond.js';
import { Request, Response } from "express";
import Product from "../models/Products.js";
import Shop from '../models/Shop.js';
import cloudinary from "../config/cloudinary.js";

// get all products
// GET api/products?page=1&limit=10
export const getProducts = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const query: any = { isActive: true };
    if (req.query.city || req.query.shop) {
      const shops = await Shop.find({ approved: true, ...(req.query.city ? { city: req.query.city } : {}), ...(req.query.shop ? { _id: req.query.shop } : {}) } as any).select('_id');
      query.shop = { $in: shops.map(shop => shop._id) };
    }

    const total = await Product.countDocuments(query);

    const products = await Product.find(query)
      .skip((Number(page) - 1) * Number(limit))
      .limit(Math.min(100, Math.max(1, Number(limit))))
      .populate('shop', 'name city address category');

    res.json({
      success: true,
      data: products,
      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error: any) {
    failure(res, error);
  }
};

// get single product
// GET api/products/:id
export const getProduct = async (req: Request, res: Response) => {
  try {
    const product = await Product.findOne({ _id: req.params.id, isActive: true }).populate('shop', 'name city address category');
    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }
    return res.json({ success: true, data: product });
  } catch (error: any) {
    failure(res, error);
  }
};

// create a new product
// POST api/products
export const createProduct = async (req: Request, res: Response) => {
  try {
    const images = await productImages(req.body, (req.files || []) as any);

    let sizes = req.body.sizes || [];
    if (typeof sizes === "string") {
      try {
        sizes = JSON.parse(sizes);
      } catch (e) {
        sizes = sizes
          .split(",")
          .map((size: string) => size.trim())
          .filter((s: string) => s !== "");
      }
    }
    // ensure they are arrays
    if (!Array.isArray(sizes)) sizes = [sizes];

    const productData = {
      ...req.body,
      images: images,
      sizes,
    };

    if (images.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Upload at least one product image.",
      });
    }

    const product = await Product.create(productData);
    res.status(201).json({ success: true, data: product });
  } catch (error: any) {
    failure(res, error);
  }
};

// update a product
// PUT api/products/:id
export const updateProduct = async (req: Request, res: Response) => {
  try {
    const current = await Product.findById(req.params.id);
    if (!current) return res.status(404).json({ success: false, message: 'Product not found' });
    const changingImages = req.body.existingImages !== undefined || req.body.imageOrder !== undefined || !!(req.files && (req.files as any).length);
    const images = changingImages ? await productImages(req.body, (req.files || []) as any, current.images) : current.images;

    const updates = { ...req.body };

    if (req.body.sizes) {
      let sizes = req.body.sizes;
      if (typeof sizes === "string") {
        try {
          sizes = JSON.parse(sizes);
        } catch (e) {
          sizes = sizes
            .split(",")
            .map((size: string) => size.trim())
            .filter((s: string) => s !== "");
        }
      }
      if (!Array.isArray(sizes)) sizes = [sizes];
      updates.sizes = sizes;
    }

    updates.images = images;

    delete updates.existingImages; delete updates.imageOrder; // remove existingImages from updates

    const revision = updates.version; delete updates.version;
    const filter: any = { _id: req.params.id };
    if (res.locals.shop) { filter.shop = res.locals.shop._id; filter.__v = revision; }
    const product = await Product.findOneAndUpdate(filter, { $set: updates, $inc: { __v: 1 } }, {
      returnDocument: 'after',
      runValidators: true,
    });

    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }

    res.json({ success: true, data: product });
  } catch (error: any) {
    failure(res, error);
  }
};

// Delete product
// DELETE api/products/:id

export const deleteProduct = async (req: Request, res: Response) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }

    // delete images from cloudinary
    if (product.images && product.images.length > 0) {
      const deletePromises = product.images.map((imageUrl) => {
        const publicIdMatch = imageUrl.match(/\/([^/]+)\.[a-zA-Z]+$/);
        const publicId = publicIdMatch ? publicIdMatch[1] : null;
        if (publicId) {
          return cloudinary.uploader.destroy(publicId);
        }
        return Promise.resolve(); // if no publicId, resolve immediately
      });
      await Promise.all(deletePromises);
    }
    await Product.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Product deleted" });
  } catch (error: any) {
    failure(res, error);
  }
};
