import type { AccountOrder } from './orderData';
import type { AdminProduct } from './adminProducts';

type Page<T> = { items: T[]; pages: number; total: number; coverageKnown?: boolean };
export type Coverage<T> = { items: T[]; total: number; totalKnown: boolean; complete: boolean };

// Bounded reads; partial coverage is explicitly surfaced in the Insights UI.
export async function collectInsightPages<T extends { _id: string }>(fetchPage: (page: number, signal: AbortSignal) => Promise<Page<T>>, signal: AbortSignal, onProgress: (loaded: number, total: number) => void, maxPages = 100): Promise<Coverage<T>> {
  const records = new Map<string, T>();
  let total = 0, pages = 1, completedPage = 0, stopped = false, totalKnown = true;
  for (let page = 1; page <= Math.min(pages, maxPages); page++) {
    if (signal.aborted) throw Error('Insights loading cancelled.');
    const result = await fetchPage(page, signal);
    if (signal.aborted) throw Error('Insights loading cancelled.');
    if (!Number.isSafeInteger(result.pages) || result.pages < 0 || !Number.isSafeInteger(result.total) || result.total < 0) throw Error('Invalid analytics pagination.');
    totalKnown = totalKnown && result.coverageKnown !== false;
    total = Math.max(total, result.total); pages = Math.max(pages, result.pages);
    const before = records.size;
    result.items.forEach(item => records.set(item._id, item));
    onProgress(records.size, total); completedPage = page;
    if (!result.items.length || (page > 1 && records.size === before)) { stopped = page < pages; break; }
  }
  return { items: [...records.values()], total, totalKnown, complete: totalKnown && !stopped && completedPage >= pages && records.size === total };
}

const DAY = 86400000;
const IST = 330 * 60000;
function dayOf(date: string) { const time = Date.parse(date); return Number.isFinite(time) ? Math.floor((time + IST) / DAY) : null; }
const lower = (value: string) => value.toLowerCase().trim();
const methodOf = (value: string) => {
  const method = lower(value).replace(/[\s-]+/g, '_');
  return ['cod', 'cash_on_delivery'].includes(method) ? 'Cash on Delivery' : method === 'razorpay' ? 'Razorpay' : method === 'upi' ? 'UPI' : method === 'card' ? 'Card' : method.replace(/_/g, ' ') || 'Not supplied';
};
const paid = (order: AccountOrder) => lower(order.paymentStatus) === 'paid' && !['cancelled', 'canceled'].includes(lower(order.orderStatus));
const valueOf = (orders: AccountOrder[]) => orders.reduce((sum, order) => sum + Math.round(order.totalAmount * 100), 0) / 100;

export function analyzeOrders(orders: AccountOrder[], days: number, asOf: string) {
  const today = dayOf(asOf);
  if (today === null || !Number.isSafeInteger(days) || days < 1) throw Error('A valid insights period is required.');
  const first = today - days + 1, time = Date.parse(asOf);
  const dated = orders.map(order => ({ order, day: dayOf(order.createdAt) }));
  const current = dated.filter(({ order, day }) => day !== null && day >= first && day <= today && Date.parse(order.createdAt) <= time).map(({ order }) => order);
  const previous = dated.filter(({ day }) => day !== null && day >= first - days && day < first).map(({ order }) => order);
  const currentPaid = current.filter(paid), previousPaid = previous.filter(paid);
  const paidValue = valueOf(currentPaid), previousValue = valueOf(previousPaid);
  const cancelled = current.filter(order => ['cancelled', 'canceled'].includes(lower(order.orderStatus))).length;
  const codDue = current.filter(order => ['cod', 'cash_on_delivery'].includes(lower(order.paymentMethod).replace(/\s+/g, '_')) && ['pending', 'unpaid', 'due'].includes(lower(order.paymentStatus)) && !['cancelled', 'canceled'].includes(lower(order.orderStatus)));
  const trend = Array.from({ length: days }, (_, index) => ({ day: first + index, date: new Date((first + index) * DAY).toISOString().slice(0, 10), value: 0 }));
  currentPaid.forEach(order => { const day = dayOf(order.createdAt)!; trend[day - first].value += Math.round(order.totalAmount * 100) / 100; });
  const states = new Map<string, number>(), methods = new Map<string, number>();
  current.forEach(order => { const status = lower(order.orderStatus) === 'canceled' ? 'cancelled' : lower(order.orderStatus) || 'not supplied'; states.set(status, (states.get(status) ?? 0) + 1); const method = methodOf(order.paymentMethod); methods.set(method, (methods.get(method) ?? 0) + 1); });
  const products = new Map<string, { id: string; name: string; units: number }>();
  let unlinkedUnits = 0;
  currentPaid.forEach(order => order.items.forEach(item => {
    if (!item.productId) { unlinkedUnits += item.quantity; return; }
    const product = products.get(item.productId) ?? { id: item.productId, name: item.name, units: 0 };
    product.units += item.quantity; products.set(product.id, product);
  }));
  return {
    count: current.length, paidCount: currentPaid.length, paidValue, previousValue,
    growth: previousValue > 0 ? (paidValue - previousValue) / previousValue * 100 : null,
    average: currentPaid.length ? paidValue / currentPaid.length : 0,
    cancelled, cancelRate: current.length ? cancelled / current.length * 100 : 0,
    codDue: valueOf(codDue), codDueCount: codDue.length,
    delivered: current.filter(order => lower(order.orderStatus) === 'delivered').length,
    invalidDates: dated.filter(({ day }) => day === null).length,
    trend, states: [...states].map(([name, count]) => ({ name, count })), methods: [...methods].map(([name, count]) => ({ name, count })),
    topProducts: [...products.values()].sort((a, b) => b.units - a.units).slice(0, 8), unlinkedUnits,
  };
}

export function analyzeStock(products: AdminProduct[]) {
  const categories = new Map<string, { name: string; products: number; units: number }>();
  products.forEach(product => { const name = product.category || 'Not supplied'; const category = categories.get(name) ?? { name, products: 0, units: 0 }; category.products++; category.units += product.stock; categories.set(name, category); });
  return {
    products: products.length, units: products.reduce((sum, product) => sum + product.stock, 0),
    retailValue: products.reduce((sum, product) => sum + Math.round(product.price * 100) * product.stock, 0) / 100,
    soldOut: products.filter(product => product.stock === 0),
    lowStock: products.filter(product => product.stock > 0 && product.stock <= 5).sort((a, b) => a.stock - b.stock),
    categories: [...categories.values()].sort((a, b) => b.products - a.products),
  };
}
