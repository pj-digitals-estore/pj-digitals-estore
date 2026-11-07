import { apiRequest } from '../lib/api';
import { parseOrder, parseOrders, type AccountOrder } from './orderData';

type Token = () => Promise<string | null>;
type Envelope = { data?: unknown; cart?: unknown; pagination?: { page?: number; pages?: number; total?: number } };
export type OrderAddress = { name: string; phone: string; street: string; city: string; state: string; zipCode: string; country: string };
export type CartPreview = { total: number; items: { name: string; quantity: number; price: number; available: boolean }[] };

export function createAdminOrdersApi(getToken: Token) {
  async function request(path: string, options: RequestInit & { timeoutMs?: number } = {}): Promise<Envelope> {
    const token = await getToken();
    if (!token) throw Error('Verified admin sign-in is required.');
    const response = await apiRequest(path, { ...options, cache: 'no-store', headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers } });
    const body = await response.json();
    if (body?.success !== true) throw Error(typeof body?.message === 'string' ? body.message : 'Request not confirmed by the server.');
    return body;
  }
  async function list(scope: 'all' | 'mine', page = 1, status = '', signal?: AbortSignal) {
    const query = new URLSearchParams({ page: String(page), limit: '20' });
    if (status) query.set('status', status);
    const body = await request(scope === 'all' ? `/api/orders/admin/all?${query}` : '/api/orders', { signal });
    const orders = parseOrders(body.data);
    const pagination = body.pagination;
    const result = { orders, page: pagination?.page ?? 1, pages: pagination?.pages ?? 1, total: pagination?.total ?? orders.length, paginationKnown: typeof pagination?.pages === 'number' && typeof pagination?.total === 'number' };
    if (!Number.isSafeInteger(result.page) || result.page < 1 || !Number.isSafeInteger(result.pages) || result.pages < 0 || !Number.isSafeInteger(result.total) || result.total < 0) throw Error('Invalid order pagination response.');
    return result;
  }
  async function get(id: string, signal?: AbortSignal): Promise<AccountOrder> {
    if (!id) throw Error('An order ID is required.');
    const order = parseOrder((await request(`/api/orders/${encodeURIComponent(id)}`, { signal })).data);
    if (order._id !== id) throw Error('The server returned a different order.');
    return order;
  }
  async function updateStatus(id: string, orderStatus: string): Promise<AccountOrder> {
    const body = await request(`/api/orders/${encodeURIComponent(id)}/status`, { method: 'PUT', body: JSON.stringify({ orderStatus }) });
    const order = parseOrder(body.data);
    if (order._id !== id || order.orderStatus !== orderStatus) throw Error('The server did not confirm the requested status. Refresh before retrying.');
    return order;
  }
  async function cart(signal?: AbortSignal): Promise<CartPreview> {
    const body = await request('/api/cart', { signal });
    const value = (body.cart ?? body.data) as { totalAmount?: unknown; items?: unknown } | undefined;
    if (!value || !Array.isArray(value.items) || typeof value.totalAmount !== 'number' || !Number.isFinite(value.totalAmount)) throw Error('Invalid cart response.');
    return { total: value.totalAmount, items: value.items.map(item => {
      if (!item || typeof item.quantity !== 'number' || !Number.isSafeInteger(item.quantity) || item.quantity < 1 || typeof item.price !== 'number' || !Number.isFinite(item.price)) throw Error('Invalid cart item.');
      return { name: typeof item.product?.name === 'string' ? item.product.name : 'Unavailable product', quantity: item.quantity, price: item.price, available: !!item.product?._id };
    }) };
  }
  async function create(address: OrderAddress, checkoutKey: string, paymentMethod: 'cod' | 'razorpay'): Promise<string> {
    const body = await request('/api/orders', { method: 'POST', timeoutMs: 45000, body: JSON.stringify({ shippingAddress: address, checkoutKey, paymentMethod }) });
    const order = body.data as { _id?: unknown } | undefined;
    if (typeof order?._id !== 'string' || !order._id) throw Error('Order creation was not confirmed. Check My account orders before retrying.');
    const saved = await get(order._id);
    if ((paymentMethod === 'cod' && !['cod', 'cash_on_delivery'].includes(saved.paymentMethod)) || (paymentMethod === 'razorpay' && saved.paymentMethod !== 'razorpay')) throw Error(`Order ${saved.orderNumber} was created with a different payment method. Check My account orders before retrying.`);
    return saved._id;
  }
  async function stats(signal?: AbortSignal) {
    const value = (await request('/api/admin/stats', { signal })).data as { totalOrders?: unknown; totalProducts?: unknown; totalRevenue?: unknown };
    if (!value || typeof value.totalOrders !== 'number' || typeof value.totalProducts !== 'number' || typeof value.totalRevenue !== 'number' || ![value.totalOrders, value.totalProducts, value.totalRevenue].every(Number.isFinite)) throw Error('Invalid statistics response.');
    return { totalOrders: value.totalOrders, totalProducts: value.totalProducts, totalRevenue: value.totalRevenue };
  }
  return { list, get, updateStatus, cart, create, stats };
}
export type AdminOrdersApi = ReturnType<typeof createAdminOrdersApi>;
