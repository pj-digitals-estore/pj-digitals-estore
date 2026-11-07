import mongoose from 'mongoose';
import Order from '../models/Order.js';
import Cart from '../models/Cart.js';
import { razorpay } from '../lib/razorpay.js';
import { HttpError, paise } from '../lib/trialValidation.js';

export async function confirmCapturedPayment(paymentId: string) {
  if (!/^pay_[a-zA-Z0-9]+$/.test(paymentId)) throw new HttpError(400, 'Invalid payment reference.');
  const payment = await razorpay(`/payments/${paymentId}`);
  const order = await Order.findOne({ razorpayOrderId: payment.order_id });
  if (!order) throw new HttpError(404, 'Payment order not found.');
  if (payment.status !== 'captured' || payment.currency !== 'INR' || payment.amount !== paise(order.totalAmount)) throw new HttpError(409, 'Payment is not yet captured for the expected amount. Please check again shortly.');
  await mongoose.connection.transaction(async session => {
    const paid = await Order.findOneAndUpdate({ _id: order._id, paymentStatus: 'pending', orderStatus: 'awaiting_payment' }, { $set: { paymentStatus: 'paid', paymentIntentId: payment.id, paidAt: new Date(), orderStatus: 'placed' } }, { session, returnDocument: 'after' });
    if (!paid) {
      // A payment can arrive after a cancellation race. Never fulfil it or remove cart items.
      // An operator must refund this captured payment in Razorpay and review the order.
      await Order.findOneAndUpdate({ _id: order._id, paymentStatus: 'pending', orderStatus: 'cancelled' }, { $set: { paymentStatus: 'paid', paymentIntentId: payment.id, paidAt: new Date(), manualReview: true } }, { session });
      return; // Duplicate callbacks/webhooks must not clear the cart twice.
    }
    const cart = await Cart.findOne({ user: paid.user }).session(session);
    if (cart) {
      for (const bought of paid.items) {
        const item = cart.items.find(i => String(i.product) === String(bought.product) && i.size === bought.size);
        if (item) item.quantity = Math.max(0, item.quantity - bought.quantity);
      }
      cart.items = cart.items.filter(i => i.quantity > 0); cart.calculateTotal(); await cart.save({ session });
    }
  });
  return order._id;
}

// Read-only provider lookup recovers a captured payment if a callback was lost.
export async function reconcileOrderPayment(order: { razorpayOrderId?: string; paymentStatus: string }) {
  if (order.paymentStatus !== 'pending' || !order.razorpayOrderId) return;
  const result = await razorpay(`/orders/${order.razorpayOrderId}/payments`);
  const captured = result.items?.find((payment: any) => payment.status === 'captured');
  if (captured) await confirmCapturedPayment(captured.id);
}
