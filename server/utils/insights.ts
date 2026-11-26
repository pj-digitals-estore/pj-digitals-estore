// Number crunching for the Insights screen (kept pure so the rules are tested). Money in rupees.
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
/** A percentage with one decimal; 0 when there is nothing to divide by. */
export const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0);

export type InsightInput = {
  orders: number; // non-cancelled orders in the range
  cancelled: number;
  gross: number; // total of those orders
  goods: number; // their goods subtotal before discounts
  delivery: number; // delivery fees charged
  discount: number; // coupon discounts given
  refunded: number; // money paid back in the range
  customers: number; // distinct customers who ordered
  repeatCustomers: number; // of those, how many had ordered before the range
};

export const headline = (i: InsightInput) => ({
  orders: i.orders,
  gross: r2(i.gross),
  goods: r2(i.goods),
  delivery: r2(i.delivery),
  discount: r2(i.discount),
  refunded: r2(i.refunded),
  net: r2(i.gross - i.refunded),
  averageOrder: i.orders > 0 ? r2(i.gross / i.orders) : 0,
  cancelRate: pct(i.cancelled, i.orders + i.cancelled),
  discountRate: pct(i.discount, i.goods),
  customers: i.customers,
  newCustomers: Math.max(0, i.customers - i.repeatCustomers),
  repeatCustomers: i.repeatCustomers,
  repeatRate: pct(i.repeatCustomers, i.customers),
});
