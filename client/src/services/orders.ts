import { apiRequest } from '../lib/api';
import type { GetSessionToken } from './cart';
import type { Order, OrderStatus } from '../features/storefront/data/types';

type RecordValue = Record<string, unknown>;
const record = (value: unknown): value is RecordValue => !!value && typeof value === 'object' && !Array.isArray(value);
const statuses: Record<string, OrderStatus> = { awaiting_payment: 'Awaiting payment', shipping: 'Dispatched', placed: 'Placed', confirmed: 'Confirmed', processing: 'Processing', packed: 'Processing', shipped: 'Dispatched', dispatched: 'Dispatched', delivered: 'Delivered', cancelled: 'Cancelled', canceled: 'Cancelled' };

function parseSingleOrder(result: unknown): Order {
  if (record(result) && result.success === false) throw new Error(typeof result.message === 'string' ? result.message : 'Unable to load this order.');
  const data = record(result) ? result.order ?? result.data ?? result : result;
  return toOrder(record(data) && data.order ? data.order : data);
}

function toOrder(value: unknown): Order {
  if (!record(value) || typeof value._id !== 'string' || !Array.isArray(value.items)
    || typeof value.totalAmount !== 'number' || !Number.isFinite(value.totalAmount) || value.totalAmount < 0
    || typeof value.createdAt !== 'string' || Number.isNaN(Date.parse(value.createdAt))) throw new Error('The server returned an invalid order.');
  const items = value.items.map((item: unknown) => {
    if (!record(item) || typeof item.name !== 'string' || typeof item.quantity !== 'number' || !Number.isSafeInteger(item.quantity) || item.quantity < 1) throw new Error('The server returned an invalid order item.');
    const productId = typeof item.product === 'string' ? item.product : record(item.product) && typeof item.product._id === 'string' ? item.product._id : '';
    return { id: productId || (typeof item._id === 'string' ? item._id : item.name), name: item.name, quantity: item.quantity, size: typeof item.size === 'string' ? item.size : undefined };
  });
  const rawStatus = typeof value.orderStatus === 'string' ? value.orderStatus : typeof value.status === 'string' ? value.status : '';
  return {
    id: value._id, orderNumber: typeof value.orderNumber === 'string' ? value.orderNumber : undefined,
    date: new Date(value.createdAt).toLocaleString(), total: value.totalAmount, items,
    status: statuses[rawStatus.toLowerCase()],
    statusUpdatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : undefined,
    needsReview: value.manualReview === true,
    paymentStatus: typeof value.paymentStatus === 'string' ? value.paymentStatus : undefined,
    paymentMethod: value.paymentMethod === 'cod' || value.paymentMethod === 'cash_on_delivery' ? 'Cash on Delivery' : value.paymentMethod === 'razorpay' ? 'Razorpay' : value.paymentMethod === 'stripe' || value.paymentMethod === 'card' ? 'Card' : value.paymentMethod === 'UPI' || value.paymentMethod === 'upi' ? 'UPI' : undefined,
  };
}

export async function getUserOrders(getToken: GetSessionToken, signal?: AbortSignal): Promise<Order[]> {
  const token = await getToken();
  if (!token) throw new Error('Please sign in to view your orders.');
  const response = await apiRequest('/api/orders', { signal, headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }, cache: 'no-store' });
  const result: unknown = await response.json();
  if (record(result) && result.success === false) throw new Error(typeof result.message === 'string' ? result.message : 'Unable to load orders.');
  const data = record(result) ? result.orders ?? result.data : result;
  const list = record(data) ? data.orders : data;
  if (!Array.isArray(list)) throw new Error('The server returned an invalid orders response.');
  return list.map(toOrder);
}

export async function getUserOrder(id: string, getToken: GetSessionToken, signal?: AbortSignal): Promise<Order> {
  if (!/^[a-f\d]{24}$/i.test(id)) throw new Error('A valid order ID is required.');
  const token = await getToken();
  if (!token) throw new Error('Please sign in to view this order.');
  const response = await apiRequest(`/api/orders/${encodeURIComponent(id)}`, { signal, headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }, cache: 'no-store' });
  const result: unknown = await response.json();
  const order = parseSingleOrder(result);
  if (order.id !== id) throw new Error('The server returned a different order.');
  return order;
}

/** Pass the controller's confirmed body here. The server builds items and totals from the saved cart. */
export async function createUserOrder(body: Record<string, unknown>, getToken: GetSessionToken): Promise<Order> {
  const token = await getToken();
  if (!token) throw new Error('Please sign in to place your order.');
  // Never retry a creation request automatically: a lost response can still mean an order was created.
  const response = await apiRequest('/api/orders', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return parseSingleOrder(await response.json());
}
