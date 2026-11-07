import express from 'express';
import { createHash } from 'node:crypto';
import Order from '../models/Order.js';
import { paymentConfig, validSignature } from '../lib/razorpay.js';
import { confirmCapturedPayment } from '../services/payments.js';
import { HttpError, paise } from '../lib/trialValidation.js';
import { failure } from '../lib/respond.js';

export const PaymentRouter = express.Router();
async function byToken(token: unknown) {
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) throw new HttpError(404, 'Checkout not found.');
  const order = await Order.findOne({ checkoutTokenHash: createHash('sha256').update(token).digest('hex') });
  if (!order) throw new HttpError(404, 'This checkout link was replaced. Reopen checkout from your orders.');
  return order;
}
PaymentRouter.get('/config', (req, res) => {
  try { const config = paymentConfig(); res.json({ success: true, enabled: true, mode: config.id.startsWith('rzp_live_') ? 'live' : 'test' }); }
  catch { res.json({ success: true, enabled: false }); }
});
PaymentRouter.get('/checkout/:token', async (req, res) => {
  try {
    const order = await byToken(req.params.token), config = paymentConfig();
    res.setHeader('Cache-Control', 'no-store'); res.setHeader('Referrer-Policy', 'no-referrer'); res.setHeader('X-Content-Type-Options', 'nosniff');
    if (order.paymentStatus === 'paid') return res.type('html').send('<!doctype html><title>NearBy payment</title><p>Payment received. Close this page and return to NearBy.</p>');
    if (!order.razorpayOrderId || order.orderStatus !== 'awaiting_payment') throw new HttpError(409, 'Checkout is not ready.');
    const data = JSON.stringify({ key: config.id, order_id: order.razorpayOrderId, amount: paise(order.totalAmount), currency: 'INR', name: 'NearBy', token: req.params.token }).replace(/</g, '\\u003c');
    res.type('html').send(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>NearBy secure payment</title><style>body{font:16px system-ui;background:#f7f8ff;color:#283453;padding:24px}main{max-width:440px;margin:10vh auto;background:white;padding:28px;border-radius:20px}button{padding:16px;border:0;border-radius:12px;background:#6547d3;color:white;font:inherit;width:100%}p{line-height:1.6}button:disabled{opacity:.5}</style></head><body><main><h1>NearBy payment</h1><p id="amount"></p><p id="status">Pay securely with Razorpay. After payment, return to the app to see the confirmed order.</p><button id="pay">Continue to payment</button></main><script src="https://checkout.razorpay.com/v1/checkout.js"></script><script>const d=${data};const b=document.getElementById('pay'),s=document.getElementById('status');document.getElementById('amount').textContent='Total: ₹'+(d.amount/100).toFixed(2)+(d.key.startsWith('rzp_test_')?' · TEST PAYMENT':'');b.onclick=()=>{if(!window.Razorpay){s.textContent='Payment could not load. Check your connection and reopen this page.';return}b.disabled=true;const r=new Razorpay({...d,handler:async result=>{s.textContent='Verifying payment…';try{const response=await fetch('/api/payments/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...result,token:d.token})});const body=await response.json();if(!response.ok)throw Error(body.message||'Payment is being confirmed.');s.textContent='Payment received. Close this page and return to NearBy.';b.hidden=true;}catch(e){s.textContent=e.message+' Return to My orders and refresh. Do not pay again until you check the status.';}},modal:{ondismiss:()=>{b.disabled=false;s.textContent='Checkout closed. If money was debited, check My orders before retrying.';}}});r.on('payment.failed',()=>{s.textContent='Payment was not confirmed. Check My orders before retrying.';b.disabled=false});r.open();};</script></body></html>`);
  } catch (error) { failure(res, error); }
});
PaymentRouter.post('/verify', async (req, res) => {
  try {
    const order = await byToken(req.body.token), config = paymentConfig();
    if (req.body.razorpay_order_id !== order.razorpayOrderId || !validSignature(`${order.razorpayOrderId}|${req.body.razorpay_payment_id}`, req.body.razorpay_signature, config.secret)) throw new HttpError(400, 'Payment verification failed.');
    await confirmCapturedPayment(req.body.razorpay_payment_id);
    const current = await Order.findById(order._id);
    if (current?.orderStatus === 'cancelled') throw new HttpError(409, 'Payment reached a cancelled order and requires a refund. Contact support with your order number; do not pay again.');
    res.json({ success: true });
  } catch (error) { failure(res, error); }
});
export async function paymentWebhook(req: express.Request, res: express.Response) {
  try {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret || !Buffer.isBuffer(req.body) || !validSignature(req.body, req.headers['x-razorpay-signature'], secret)) throw new HttpError(400, 'Invalid webhook signature.');
    const event = JSON.parse(req.body.toString('utf8'));
    if (event.event === 'payment.captured') await confirmCapturedPayment(event.payload?.payment?.entity?.id);
    if (event.event === 'refund.processed') {
      // Do not automatically restock a refunded order: it may already have been delivered.
      const entity = event.payload?.refund?.entity;
      if (entity?.payment_id) await Order.updateOne({ paymentIntentId: entity.payment_id, paymentStatus: 'paid', totalAmount: entity.amount / 100 }, { $set: { paymentStatus: 'refunded', manualReview: false } });
    }
    res.json({ success: true });
  } catch (error) { failure(res, error); }
}
