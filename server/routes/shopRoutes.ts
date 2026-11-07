import express from 'express';
import { randomUUID } from 'node:crypto';
import Shop from '../models/Shop.js';
import Product from '../models/Products.js';
import Order from '../models/Order.js';
import { protect, authorize } from '../middleware/auth.js';
import upload from '../middleware/upload.js';
import { createProduct, updateProduct } from '../controllers/productController.js';
import { categories, HttpError, paise, quantity } from '../lib/trialValidation.js';
import { failure } from '../lib/respond.js';
import { productImages } from '../lib/productImages.js';

export const ShopRouter = express.Router();
ShopRouter.get('/', async (req, res) => {
  try { res.json({ success: true, data: await Shop.find({ approved: true, ...(req.query.city ? { city: String(req.query.city) } : {}) } as any).select('name city address category') }); }
  catch (e) { failure(res, e); }
});
ShopRouter.use(protect, authorize('shop', 'admin'));
ShopRouter.use(async (req, res, next) => {
  try {
    const shop = await Shop.findOne({ owner: req.user._id, approved: true });
    if (!shop) throw new HttpError(403, 'Your shop is awaiting admin approval.');
    res.locals.shop = shop; next();
  } catch (e) { failure(res, e); }
});
ShopRouter.get('/profile', (req, res) => res.json({ success: true, data: res.locals.shop }));
ShopRouter.get('/products', async (req, res) => {
  try { res.json({ success: true, data: await Product.find({ shop: res.locals.shop._id, isActive: true }).sort('-createdAt') }); }
  catch (e) { failure(res, e); }
});
ShopRouter.get('/orders', async (req, res) => {
  try {
    // Only paid orders can be fulfilled. An order can contain products from several shops.
    const records = await Order.find({ 'items.shop': res.locals.shop._id, paymentStatus: 'paid', orderStatus: { $ne: 'cancelled' } }).sort('-createdAt').limit(200).lean();
    const data = records.map((order: any) => {
      const items = order.items.filter((item: any) => String(item.shop) === String(res.locals.shop._id));
      return { _id: order._id, orderNumber: order.orderNumber, customer: order.shippingAddress.name, items, totalAmount: items.reduce((sum: number, item: any) => sum + item.price * item.quantity, 0), orderStatus: order.orderStatus, paymentStatus: order.paymentStatus, createdAt: order.createdAt };
    });
    res.json({ success: true, data });
  } catch (e) { failure(res, e); }
});
async function owned(req: express.Request, res: express.Response, next: express.NextFunction) {
  try {
    if (!await Product.exists({ _id: req.params.id, shop: res.locals.shop._id })) throw new HttpError(404, 'Product not found.');
    next();
  } catch (e) { failure(res, e); }
}
function fields(req: express.Request, res: express.Response, next: express.NextFunction) {
  try {
    const b = req.body;
    if (typeof b.name !== 'string' || !b.name.trim() || typeof b.description !== 'string' || !b.description.trim()) throw new HttpError(400, 'A name and description are required.');
    if (!categories.includes(b.category)) throw new HttpError(400, 'Choose a supported category.');
    const price = paise(Number(b.price)) / 100, stock = quantity(Number(b.stock), true);
    const reorderLevel = quantity(Number(b.reorderLevel ?? 5), true);
    const body: any = { name: b.name.trim(), description: b.description.trim(), price, stock, category: b.category, sizes: b.sizes || [], shop: res.locals.shop._id, sku: typeof b.sku === 'string' && b.sku.trim() ? b.sku.trim() : randomUUID(), reorderLevel, location: typeof b.location === 'string' ? b.location.trim() : 'Main shelf' };
    if (req.method === 'PUT') body.version = quantity(Number(b.version), true);
    if (b.existingImages !== undefined) body.existingImages = b.existingImages;
    if (b.imageOrder !== undefined) body.imageOrder = b.imageOrder;
    req.body = body; next();
  } catch (e) { failure(res, e); }
}
ShopRouter.post('/products', upload.array('images', 5), fields, createProduct);
ShopRouter.put('/products/:id', owned, upload.array('images', 5), fields, updateProduct);
ShopRouter.put('/products/:id/images', owned, upload.array('images', 5), async (req, res) => {
  try {
    const version = quantity(Number(req.body.version), true);
    const current = await Product.findOne({ _id: req.params.id, shop: res.locals.shop._id, __v: version });
    if (!current) throw new HttpError(409, 'Product changed. Refresh before updating its images.');
    const images = await productImages(req.body, (req.files || []) as any, current.images);
    const product = await Product.findOneAndUpdate({ _id: req.params.id, shop: res.locals.shop._id, __v: version }, { $set: { images }, $inc: { __v: 1 } }, { returnDocument: 'after', runValidators: true });
    if (!product) throw new HttpError(409, 'Product changed. Refresh before updating its images.');
    res.json({ success: true, data: product });
  } catch (e) { failure(res, e); }
});
ShopRouter.put('/products/:id/stock', owned, async (req, res) => {
  try {
    // Version checks prevent a stale shop screen from overwriting a customer's purchase.
    const stock = quantity(req.body.stock, true), version = quantity(req.body.version, true);
    const product = await Product.findOneAndUpdate({ _id: req.params.id, shop: res.locals.shop._id, __v: version }, { $set: { stock }, $inc: { __v: 1 } }, { returnDocument: 'after', runValidators: true });
    if (!product) throw new HttpError(409, 'Stock changed elsewhere. Refresh and try again.');
    res.json({ success: true, data: product });
  } catch (e) { failure(res, e); }
});
ShopRouter.delete('/products/:id', owned, async (req, res) => {
  try { await Product.updateOne({ _id: req.params.id, shop: res.locals.shop._id }, { $set: { isActive: false }, $inc: { __v: 1 } }); res.json({ success: true }); }
  catch (e) { failure(res, e); }
});
