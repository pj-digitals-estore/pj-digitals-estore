import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Cart from '../models/Cart.js';
import Product from '../models/Products.js';
import { HttpError, quantity } from '../lib/trialValidation.js';
import { failure } from '../lib/respond.js';

function sizeOf(value: unknown) {
  if (value == null || value === '') return undefined;
  if (typeof value !== 'string' || value.length > 40) throw new HttpError(400, 'Invalid product size.');
  return value;
}
function idOf(value: unknown) {
  if (typeof value !== 'string' || !mongoose.isValidObjectId(value)) throw new HttpError(400, 'Invalid product ID.');
  return value;
}
async function populated(cart: any) { return cart.populate('items.product', 'name images price stock'); }
export async function getCart(req: Request, res: Response) {
  try {
    const cart = await Cart.findOneAndUpdate({ user: req.user._id }, { $setOnInsert: { user: req.user._id, items: [], totalAmount: 0 } }, { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true });
    res.json({ success: true, cart: await populated(cart) });
  } catch (error) { failure(res, error); }
}
export async function addToCart(req: Request, res: Response) {
  try {
    const productId = idOf(req.body.productId), amount = quantity(req.body.quantity ?? 1), size = sizeOf(req.body.size);
    const product = await Product.findOne({ _id: productId, isActive: true });
    if (!product) throw new HttpError(404, 'Product unavailable.');
    if (product.sizes.length && (!size || !product.sizes.includes(size))) throw new HttpError(400, 'Choose an available size.');
    if (!product.sizes.length && size) throw new HttpError(400, 'This product does not have sizes.');
    let cart = await Cart.findOne({ user: req.user._id });
    if (!cart) cart = new Cart({ user: req.user._id, items: [] });
    const total = cart.items.filter(i => i.product.toString() === productId).reduce((n, i) => n + i.quantity, 0);
    if (total + amount > product.stock) throw new HttpError(409, 'Insufficient stock.');
    const item = cart.items.find(i => i.product.toString() === productId && i.size === size);
    if (item) { item.quantity += amount; item.price = product.price; }
    else cart.items.push({ product: product._id as any, quantity: amount, price: product.price, size });
    cart.calculateTotal(); await cart.save();
    res.json({ success: true, data: await populated(cart) });
  } catch (error) { failure(res, error); }
}
export async function updateCartItems(req: Request, res: Response) {
  try {
    const productId = idOf(req.params.productId), amount = quantity(req.body.quantity, true), size = sizeOf(req.body.size);
    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) throw new HttpError(404, 'Cart not found.');
    const index = cart.items.findIndex(i => i.product.toString() === productId && i.size === size);
    if (index < 0) throw new HttpError(404, 'Cart item not found.');
    if (!amount) cart.items.splice(index, 1);
    else {
      const product = await Product.findOne({ _id: productId, isActive: true });
      if (!product) throw new HttpError(409, 'Product unavailable.');
      const others = cart.items.filter((i, n) => n !== index && i.product.toString() === productId).reduce((n, i) => n + i.quantity, 0);
      if (amount + others > product.stock) throw new HttpError(409, 'Insufficient stock.');
      cart.items[index].quantity = amount; cart.items[index].price = product.price;
    }
    cart.calculateTotal(); await cart.save(); res.json({ success: true, data: await populated(cart) });
  } catch (error) { failure(res, error); }
}
export async function removeCartItem(req: Request, res: Response) {
  req.body = { quantity: 0, size: req.query.size };
  return updateCartItems(req, res);
}
export async function clearCart(req: Request, res: Response) {
  try {
    await Cart.updateOne({ user: req.user._id }, { $set: { items: [], totalAmount: 0 }, $inc: { __v: 1 } });
    res.status(204).end();
  } catch (error) { failure(res, error); }
}
