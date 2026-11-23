import { Request, Response } from "express";
import mongoose from "mongoose";
import Review from "../models/Review.js";
import Product from "../models/Products.js";
import Order from "../models/Order.js";
import { sendError } from "../utils/http.js";
import { destroyImages, ImageError, uploadImage } from "../utils/imageStore.js";

const MAX_REVIEW_PHOTOS = 3;
const SORTS: Record<string, any> = {
  recent: { createdAt: -1, _id: -1 },
  helpful: { helpfulCount: -1, createdAt: -1, _id: -1 },
  high: { rating: -1, createdAt: -1, _id: -1 },
  low: { rating: 1, createdAt: -1, _id: -1 },
};

// what the browser gets: no voter ids, but whether *you* voted
const present = (r: any, userId?: any) => {
  const o = typeof r.toObject === "function" ? r.toObject() : r;
  const voters: any[] = o.helpfulBy || [];
  delete o.helpfulBy;
  const authorId = String(o.user?._id ?? o.user ?? "");
  return {
    ...o,
    iVoted: userId ? voters.some((v) => String(v) === String(userId)) : false,
    isMine: userId ? authorId === String(userId) : false,
  };
};

const recalcRating = async (productId: any) => {
  const [agg] = await Review.aggregate([
    { $match: { product: new mongoose.Types.ObjectId(String(productId)) } },
    { $group: { _id: null, avg: { $avg: "$rating" }, count: { $sum: 1 } } },
  ]);
  await Product.updateOne(
    { _id: productId },
    {
      ratings: {
        average: agg ? Math.round(agg.avg * 10) / 10 : 0,
        count: agg?.count ?? 0,
      },
    },
  );
};

// GET /api/products/:id/reviews?page=&limit=&sort=recent|helpful|high|low
// (public; when signed in each review also says whether you marked it helpful)
export const getReviews = async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));
    const query = { product: req.params.id };
    const sort = SORTS[String(req.query.sort)] || SORTS.recent;

    const [total, reviews, hist] = await Promise.all([
      Review.countDocuments(query),
      Review.find(query)
        .select("+helpfulBy")
        .populate("user", "name image")
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit),
      Review.aggregate([
        { $match: { product: new mongoose.Types.ObjectId(String(req.params.id)) } },
        { $group: { _id: "$rating", n: { $sum: 1 } } },
      ]),
    ]);
    const breakdown: Record<string, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    hist.forEach((h: any) => { breakdown[String(h._id)] = h.n; });

    res.json({
      success: true,
      data: reviews.map((r) => present(r, req.user?._id)),
      breakdown,
      pagination: { total, page, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    sendError(res, error, "Failed to fetch reviews");
  }
};

// POST /api/products/:id/reviews   body: { rating: 1-5, comment?, keepImages? } + up to 3 "images" files
// Only customers with a DELIVERED order containing the product can review.
// Posting again updates the user's existing review: keepImages (JSON list of urls) says which of the
// old photos stay; the rest are deleted and new uploads are added (3 photos in total).
export const createReview = async (req: Request, res: Response) => {
  const files = ((req as any).files as Express.Multer.File[] | undefined) ?? [];
  let uploaded: string[] = [];
  try {
    const rating = Number(req.body.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res
        .status(400)
        .json({ success: false, message: "rating must be a whole number from 1 to 5" });
    }

    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    const purchased = await Order.exists({
      user: req.user._id,
      orderStatus: "delivered",
      "items.product": product._id,
    });
    if (!purchased) {
      return res.status(403).json({
        success: false,
        message: "You can review a product after your order has been delivered",
      });
    }

    const existing: any = await Review.findOne({ product: product._id, user: req.user._id });
    let keep: string[] = existing?.images ?? [];
    if (req.body.keepImages !== undefined) {
      let wanted: unknown = [];
      try { wanted = JSON.parse(String(req.body.keepImages)); } catch { /* treated as "keep none" */ }
      // only photos this review already has can be kept (nobody can attach someone else's file)
      keep = (existing?.images ?? []).filter((u: string) => Array.isArray(wanted) && wanted.includes(u));
    }
    if (keep.length + files.length > MAX_REVIEW_PHOTOS) {
      return res.status(400).json({ success: false, message: `You can add up to ${MAX_REVIEW_PHOTOS} photos to a review.` });
    }

    uploaded = (await Promise.all(files.map((f) => uploadImage(f, "reviews")))).map((r) => r.secure_url);
    const images = [...keep, ...uploaded];

    const review: any = await Review.findOneAndUpdate(
      { product: product._id, user: req.user._id },
      { rating, comment: typeof req.body.comment === "string" ? req.body.comment : undefined, verifiedPurchase: true, images },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
    );
    uploaded = []; // saved: from here on they belong to the review
    const dropped = (existing?.images ?? []).filter((u: string) => !images.includes(u));
    if (dropped.length) await destroyImages(dropped);
    await recalcRating(product._id);

    res.status(201).json({ success: true, data: present(review, req.user._id) });
  } catch (error) {
    if (uploaded.length) await destroyImages(uploaded); // don't leave orphan files behind
    if (error instanceof ImageError) return res.status(400).json({ success: false, message: error.message });
    sendError(res, error, "Failed to save review");
  }
};

// POST /api/products/:id/reviews/:reviewId/helpful   (toggles your "helpful" vote)
export const toggleHelpful = async (req: Request, res: Response) => {
  try {
    const review: any = await Review.findOne({ _id: req.params.reviewId, product: req.params.id }).select("user");
    if (!review) return res.status(404).json({ success: false, message: "Review not found" });
    if (review.user.toString() === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: "You can't vote on your own review" });
    }
    const uid = req.user._id;
    // each step only matches when it changes something, so double-taps and races can't double count
    const added = await Review.updateOne(
      { _id: review._id, helpfulBy: { $ne: uid } },
      { $addToSet: { helpfulBy: uid }, $inc: { helpfulCount: 1 } },
    );
    let voted = true;
    if (added.modifiedCount === 0) {
      await Review.updateOne({ _id: review._id, helpfulBy: uid }, { $pull: { helpfulBy: uid }, $inc: { helpfulCount: -1 } });
      voted = false;
    }
    const fresh: any = await Review.findById(review._id).select("helpfulCount");
    res.json({ success: true, data: { helpfulCount: Math.max(0, fresh?.helpfulCount ?? 0), iVoted: voted } });
  } catch (error) {
    sendError(res, error, "Failed to save your vote");
  }
};

// DELETE /api/products/:id/reviews/:reviewId  (author or admin)
export const deleteReview = async (req: Request, res: Response) => {
  try {
    const review = await Review.findOne({
      _id: req.params.reviewId,
      product: req.params.id,
    });
    if (!review) {
      return res.status(404).json({ success: false, message: "Review not found" });
    }
    if (review.user.toString() !== req.user._id.toString() && req.user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }
    await review.deleteOne();
    if ((review as any).images?.length) await destroyImages((review as any).images);
    await recalcRating(review.product);
    res.json({ success: true, message: "Review removed" });
  } catch (error) {
    sendError(res, error, "Failed to delete review");
  }
};
