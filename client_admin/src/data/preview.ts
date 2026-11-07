import snapshot from './app-preview.json';

export const appPreview = snapshot;
export type PreviewOrder = typeof snapshot.orders[number];
export type Issue = { id: string; title: string; detail: string; level: 'warning' | 'info' };
const deliveryState: Record<string, string> = { Preparing: 'Assigned', 'Ready for pickup': 'Assigned', 'Picked up': 'Picked up', 'In transit': 'Picked up', 'Out for delivery': 'On the way', Delivered: 'Delivered' };
export const money = (amount: number) => `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

export function calculatePreview(data = appPreview) {
  const issues: Issue[] = [];
  let matchedDeliveries = 0;
  for (const job of data.deliveries) {
    const shop = data.shopDeliveries.find(delivery => delivery.orderId === job.id);
    if (!shop) {
      issues.push({ id: `missing-${job.id}`, title: `${job.id} has no matching shop delivery`, detail: 'This job appears only in the delivery app sample. There is no shared dispatch record to compare.', level: 'info' });
      continue;
    }
    const differences = [];
    if (shop.total !== job.amount) differences.push(`Order value: shop ${money(shop.total)}, delivery ${money(job.amount)}.`);
    if (shop.items !== job.items) differences.push(`Item count: shop ${shop.items}, delivery ${job.items}.`);
    if (shop.customer !== job.customer) differences.push(`Customer: shop ${shop.customer}, delivery ${job.customer}.`);
    if (deliveryState[shop.status] !== job.state) differences.push(`Status: shop ${shop.status}, delivery ${job.state}.`);
    if (differences.length) issues.push({ id: `compare-${job.id}`, title: `${job.id} details differ`, detail: differences.join(' '), level: 'warning' });
    else matchedDeliveries++;
  }
  const unassignedSamples = data.shopDeliveries.filter(delivery => !data.deliveries.some(job => job.id === delivery.orderId));
  if (unassignedSamples.length) issues.push({ id: 'shop-only-deliveries', title: `${unassignedSamples.length} shop delivery records are absent from the delivery sample`, detail: `${unassignedSamples.map(delivery => delivery.orderId).join(', ')} appear only in the shop sample. This is a sample coverage gap, not a confirmed live dispatch failure.`, level: 'info' });
  const active = data.deliveries.filter(job => job.state !== 'Delivered');
  const customers = [...new Set([...data.orders.map(order => order.customer), ...data.deliveries.map(job => job.customer)])].map(name => ({
    name, shopOrders: data.orders.filter(order => order.customer === name).length,
    deliveryJobs: data.deliveries.filter(job => job.customer === name).length,
  }));
  const categories = [...new Set(data.products.map(product => product.category))].map(name => ({ name, count: data.products.filter(product => product.category === name).length }));
  return {
    issues, matchedDeliveries, customers, categories,
    totalOrders: data.orders.length, openOrders: data.orders.filter(order => order.status !== 'Completed').length,
    orderValue: data.orders.reduce((sum, order) => sum + order.total, 0),
    totalProducts: data.products.length, unitsInStock: data.products.reduce((sum, product) => sum + product.stock, 0),
    lowStock: data.products.filter(product => product.stock > 0 && product.stock <= product.reorderLevel),
    soldOut: data.products.filter(product => product.stock === 0),
    activeDeliveries: active.length, completedDeliveries: data.deliveries.length - active.length,
    shopCount: data.shops.length, discrepancyCount: issues.filter(issue => issue.level === 'warning').length,
  };
}

export const appConnections = [
  { name: 'Customer', icon: '◈', source: 'API-backed catalogue and cart', status: 'Partly connected', detail: 'Products, cart and orders have API integrations. Wishlist, addresses and reviews remain local to the session. The preview cannot read a signed-in customer’s current basket.' },
  { name: 'Shop owner', icon: '▦', source: 'Local sample records', status: 'Preview only', detail: 'Product, stock, advertisement and order changes stay in this app’s memory. They do not update the customer catalogue or this admin snapshot.' },
  { name: 'Delivery', icon: '↗', source: 'Local sample jobs', status: 'Preview only', detail: 'Availability and delivery status changes are local. GPS opens map directions; it does not publish live driver positions.' },
  { name: 'Admin', icon: '◎', source: 'Reviewed app samples', status: 'Preview only', detail: 'Statistics below are derived from the source snapshot. Clerk sign-in and a server admin-role check protect access. Business statistics remain sample-based.' },
];
