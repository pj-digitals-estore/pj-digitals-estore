export type AccountOrder = {
  _id: string; orderNumber: string; customer: string; totalAmount: number;
  orderStatus: string; paymentStatus: string; paymentMethod: string; createdAt: string;
  address: string; phone: string;
  items: { name: string; quantity: number; size?: string; price?: number }[];
};
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown) => typeof value === 'string' ? value : '';

export function parseOrder(value: unknown): AccountOrder {
  if (!record(value) || !text(value._id) || typeof value.totalAmount !== 'number' || !Number.isFinite(value.totalAmount) || value.totalAmount < 0 || !Array.isArray(value.items)) throw Error('The server returned an invalid order.');
  const address = record(value.shippingAddress) ? value.shippingAddress : {};
  return {
    _id: text(value._id), orderNumber: text(value.orderNumber) || text(value._id),
    customer: text(address.name) || text(value.customer), totalAmount: value.totalAmount,
    orderStatus: text(value.orderStatus) || text(value.status) || 'Not supplied',
    paymentStatus: text(value.paymentStatus) || 'Not supplied', paymentMethod: text(value.paymentMethod),
    createdAt: text(value.createdAt), phone: text(address.phone),
    address: ['street', 'city', 'state', 'zipCode', 'country'].map(key => text(address[key])).filter(Boolean).join(', '),
    items: value.items.map(item => {
      if (!record(item) || !text(item.name) || typeof item.quantity !== 'number' || !Number.isSafeInteger(item.quantity) || item.quantity < 1) throw Error('The server returned an invalid order item.');
      return { name: text(item.name), quantity: item.quantity, size: text(item.size) || undefined, price: typeof item.price === 'number' && Number.isFinite(item.price) && item.price >= 0 ? item.price : undefined };
    }),
  };
}

export function parseOrders(value: unknown): AccountOrder[] {
  if (!Array.isArray(value)) throw Error('The server returned an invalid orders list.');
  return [...new Map(value.map(item => { const order = parseOrder(item); return [order._id, order] as const; })).values()];
}

export function orderDate(value: string): string {
  return value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString('en-IN') : 'Date not supplied';
}
