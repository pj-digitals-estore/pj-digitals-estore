import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import Order from '../models/Order.js';
import Cart from '../models/Cart.js';
import Product from '../models/Products.js';
import Shop from '../models/Shop.js';
import { HttpError, paise, quantity, shippingAddress } from '../lib/trialValidation.js';
import { failure } from '../lib/respond.js';
import { paymentConfig, razorpay } from '../lib/razorpay.js';
import { reconcileOrderPayment } from '../services/payments.js';

const hash = (value: string) => createHash('sha256').update(value).digest('hex');
export async function getOrders(req: Request, res: Response) {
  try {
    const pending = await Order.findOne({ user: req.user._id, paymentStatus: 'pending', razorpayOrderId: { $exists: true } }).sort('-createdAt');
    if (pending) { try { await reconcileOrderPayment(pending); } catch { /* Keep pending until verification succeeds. */ } }
    res.json({ success: true, data: await Order.find({ user: req.user._id }).sort('-createdAt') });
  }
  catch (error) { failure(res, error); }
}
export async function getOrder(req: Request, res: Response) {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) throw new HttpError(404, 'Order not found.');
    if (String(order.user) !== String(req.user._id) && req.user.role !== 'admin') throw new HttpError(403, 'Not authorized.');
    if (order.paymentStatus === 'pending') {
      try { await reconcileOrderPayment(order); const current = await Order.findById(order._id); if (current) return res.json({ success: true, data: current }); }
      catch { /* A pending payment is never shown as paid without verification. */ }
    }
    res.json({ success: true, data: order });
  } catch (error) { failure(res, error); }
}
async function checkoutResponse(orderId: string, owner: string) {
  const config = paymentConfig();
  let order = await Order.findOne({ _id: orderId, user: owner });
  if (!order) throw new HttpError(404, 'Order not found.');
  if (order.paymentStatus === 'paid') return { success: true, data: order };
  if (order.orderStatus !== 'awaiting_payment' || order.paymentStatus !== 'pending') throw new HttpError(409, 'This order cannot be paid.');
  if (!order.razorpayOrderId) {
    const lock = randomUUID();
    const locked = await Order.findOneAndUpdate({ _id: order._id, razorpayOrderId: { $exists: false }, $or: [{ paymentSetupUntil: { $exists: false } }, { paymentSetupUntil: { $lt: new Date() } }] }, { $set: { paymentSetupUntil: new Date(Date.now() + 60000), paymentSetupLock: lock } }, { returnDocument: 'after' });
    if (!locked) throw new HttpError(409, 'Checkout is being prepared. Wait a moment and check your orders.');
    try {
      const remote = await razorpay('/orders', { amount: paise(order.totalAmount), currency: 'INR', receipt: String(order._id) });
      if (typeof remote.id !== 'string' || !/^order_[a-zA-Z0-9]+$/.test(remote.id)) throw new HttpError(502, 'Invalid payment-provider order.');
      order = await Order.findOneAndUpdate({ _id: order._id, paymentSetupLock: lock }, { $set: { razorpayOrderId: remote.id }, $unset: { paymentSetupUntil: '', paymentSetupLock: '' } }, { returnDocument: 'after' });
      if (!order) throw new HttpError(409, 'Check the latest order before paying.');
    } catch (e) {
      await Order.updateOne({ _id: orderId, paymentSetupLock: lock }, { $unset: { paymentSetupUntil: '', paymentSetupLock: '' } });
      throw e;
    }
  }
  const token = randomBytes(32).toString('hex');
  await Order.updateOne({ _id: order._id }, { $set: { checkoutTokenHash: hash(token) } });
  return { success: true, data: order, checkoutUrl: `${config.origin}/api/payments/checkout/${token}` };
}
export async function resumeCheckout(req: Request, res: Response) {
  try { res.json(await checkoutResponse(String(req.params.id), String(req.user._id))); }
  catch (error) { failure(res, error); }
}
export async function cancelUnpaidOrder(req: Request, res: Response) {
  try {
    const order = await Order.findById(req.params.id);
    if (!order || (String(order.user) !== String(req.user._id) && req.user.role !== 'admin')) throw new HttpError(404, 'Order not found.');
    if (order.orderStatus === 'cancelled') return res.json({ success: true });
    if (order.paymentStatus !== 'pending' || order.orderStatus !== 'awaiting_payment') throw new HttpError(409, 'Only unpaid checkouts can be cancelled here.');
    if (order.razorpayOrderId) {
      const payments = await razorpay(`/orders/${order.razorpayOrderId}/payments`);
      if (payments.items?.some((p: any) => p.status === 'captured' || p.status === 'authorized')) throw new HttpError(409, 'A payment has been received or is processing. Refresh the order instead of cancelling.');
    }
    await mongoose.connection.transaction(async session => {
      const cancelled = await Order.findOneAndUpdate({ _id: order._id, paymentStatus: 'pending', orderStatus: 'awaiting_payment' }, { $set: { orderStatus: 'cancelled' } }, { session, returnDocument: 'after' });
      if (!cancelled) throw new HttpError(409, 'The order changed. Refresh it before proceeding.');
      for (const item of cancelled.items) await Product.updateOne({ _id: item.product }, { $inc: { stock: item.quantity, __v: 1 } }, { session });
    });
    res.json({ success: true });
  } catch (error) { failure(res, error); }
}
export async function createOrder(req: Request, res: Response) {
  try {
    paymentConfig();
    const address = shippingAddress(req.body.shippingAddress);
    const key = req.body.checkoutKey;
    if (typeof key !== 'string' || !/^[a-zA-Z0-9_-]{16,100}$/.test(key)) throw new HttpError(400, 'A checkout request ID is required.');
    let created: any;
    await mongoose.connection.transaction(async session => {
      const existing = await Order.findOne({ user: req.user._id, checkoutKey: key }).session(session);
      if (existing) { created = existing; return; }
      const cart = await Cart.findOne({ user: req.user._id }).session(session);
      if (!cart?.items.length) throw new HttpError(400, 'Your cart is empty.');
      const fingerprint = hash(JSON.stringify({ items: cart.items.map(i => [String(i.product), i.quantity, i.size]), address }));
      const pending = await Order.findOne({ user: req.user._id, cartFingerprint: fingerprint, paymentStatus: 'pending', orderStatus: 'awaiting_payment' }).session(session);
      if (pending) { created = pending; return; }
      const items: any[] = []; let subtotal = 0;
      for (const line of cart.items) {
        quantity(line.quantity);
        const product = await Product.findOneAndUpdate({ _id: line.product, isActive: true, stock: { $gte: line.quantity } }, { $inc: { stock: -line.quantity, __v: 1 } }, { session, returnDocument: 'after' });
        if (!product || !product.shop) throw new HttpError(409, 'An item is unavailable or is not linked to an approved shop. Refresh your cart.');
        if (product.sizes.length && (!line.size || !product.sizes.includes(line.size))) throw new HttpError(409, 'A selected size is unavailable.');
        if (!await Shop.exists({ _id: String(product.shop), approved: true, city: address.city } as any).session(session)) throw new HttpError(409, 'A shop does not deliver to your selected location.');
        subtotal += paise(product.price) * line.quantity;
        items.push({ product: product._id, shop: product.shop, name: product.name, quantity: line.quantity, price: product.price, size: line.size });
      }
      const shippingCost = subtotal >= 99900 ? 0 : 9900;
      const records = await Order.create([{ user: req.user._id, checkoutKey: key, cartFingerprint: fingerprint, items, shippingAddress: address, paymentMethod: 'razorpay', paymentStatus: 'pending', orderStatus: 'awaiting_payment', subtotal: subtotal / 100, shippingCost: shippingCost / 100, tax: 0, totalAmount: (subtotal + shippingCost) / 100, orderNumber: `NB-${randomUUID().slice(0, 12).toUpperCase()}` }], { session });
      created = records[0];
      // Writing the cart serializes simultaneous checkout requests against its version.
      cart.increment(); await cart.save({ session });
    });
    res.status(201).json(await checkoutResponse(String(created._id), String(req.user._id)));
  } catch (error) { failure(res, error); }
}
export async function updateOrderStatus(req: Request, res: Response) {
  try {
    const transitions: Record<string, string[]> = { placed: ['processing'], processing: ['shipping'], shipping: ['delivered'] };
    const order = await Order.findById(req.params.id);
    if (!order) throw new HttpError(404, 'Order not found.');
    if (req.body.paymentStatus !== undefined) throw new HttpError(400, 'Payment status is verified by Razorpay and cannot be edited.');
    if (order.paymentStatus !== 'paid' || !transitions[order.orderStatus]?.includes(req.body.orderStatus)) throw new HttpError(409, 'This status change is not allowed.');
    const updated = await Order.findOneAndUpdate({ _id: order._id, orderStatus: order.orderStatus }, { $set: { orderStatus: req.body.orderStatus, ...(req.body.orderStatus === 'delivered' ? { deliveredAt: new Date() } : {}) } }, { returnDocument: 'after' });
    if (!updated) throw new HttpError(409, 'Order changed. Refresh before updating it.');
    res.json({ success: true, data: updated });
  } catch (error) { failure(res, error); }
}
export async function getAllOrders(req: Request, res: Response) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1), limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const query: any = req.query.status ? { orderStatus: String(req.query.status) } : {};
    const total = await Order.countDocuments(query);
    const orders = await Order.find(query).populate('user', 'name email').sort('-createdAt').skip((page - 1) * limit).limit(limit);
    res.json({ success: true, data: orders, pagination: { total, page, pages: Math.ceil(total / limit) } });
  } catch (error) { failure(res, error); }
}
