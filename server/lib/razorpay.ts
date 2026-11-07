import { createHmac, timingSafeEqual } from 'node:crypto';
import { HttpError } from './trialValidation.js';

export function paymentConfig() {
  const id = process.env.RAZORPAY_KEY_ID, secret = process.env.RAZORPAY_KEY_SECRET;
  const origin = process.env.PUBLIC_API_ORIGIN;
  if (process.env.ENABLE_CHECKOUT !== 'true' || !id || !secret || !origin || !process.env.RAZORPAY_WEBHOOK_SECRET) throw new HttpError(503, 'Online checkout is not enabled yet.');
  let url: URL;
  try { url = new URL(origin); } catch { throw new HttpError(503, 'Payment server address is not configured.'); }
  if (url.protocol !== 'https:' || url.origin !== origin || url.username || url.password) throw new HttpError(503, 'Payment server address is not configured.');
  return { id, secret, origin };
}
export async function razorpay(path: string, body?: object): Promise<any> {
  const { id, secret } = paymentConfig();
  const response = await fetch(`https://api.razorpay.com/v1${path}`, { method: body ? 'POST' : 'GET', signal: AbortSignal.timeout(15000), headers: { Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  if (!response.ok) throw new HttpError(502, 'The payment provider could not complete the request. Check order status before retrying.');
  return response.json();
}
export function validSignature(payload: string | Buffer, signature: unknown, secret: string): boolean {
  if (typeof signature !== 'string' || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = createHmac('sha256', secret).update(payload).digest();
  return timingSafeEqual(expected, Buffer.from(signature, 'hex'));
}
