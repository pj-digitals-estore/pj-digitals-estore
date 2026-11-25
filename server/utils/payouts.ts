import Order from "../models/Order.js";
import { round2 } from "./http.js";
import { getSettings } from "./settings.js";
import { orderCommission } from "./money.js";

/** The commission rate that applies to a shop: its own override, else the platform default. */
export const effectiveRate = async (shop: any, override?: any) => {
  if (override !== undefined && override !== null && override !== "") return Number(override);
  if (shop?.commissionRate !== undefined && shop.commissionRate !== null) return Number(shop.commissionRate);
  return (await getSettings()).commissionRate;
};

/** Human readable "where to send the money" line, stored on the settlement when it is created. */
export const payoutLabel = (p: any) => {
  if (!p?.method) return undefined;
  if (p.method === "upi") return `UPI: ${p.upiId || "-"}`;
  return `Bank: ${p.accountHolder || "-"} · ${p.accountNumber || "-"} · ${p.ifsc || "-"}${p.bankName ? ` · ${p.bankName}` : ""}`;
};

/** Money figures for a shop's delivered + paid + not yet settled orders. */
export const unsettledFor = async (shop: any, opts: { to?: any; rate?: any } = {}) => {
  const query: any = {
    shop: shop._id,
    orderStatus: "delivered",
    paymentStatus: "paid",
    settlement: { $exists: false },
  };
  if (opts.to) query.deliveredAt = { $lte: new Date(opts.to) };
  const orders: any[] = await Order.find(query).select("orderNumber subtotal paymentMethod deliveredAt money");
  const hasOverride = opts.rate !== undefined && opts.rate !== null && opts.rate !== "";
  const rate = await effectiveRate(shop, opts.rate);
  const grossSales = round2(orders.reduce((s, o) => s + o.subtotal, 0));
  const codAmount = round2(orders.filter((o) => o.paymentMethod === "cod").reduce((s, o) => s + o.subtotal, 0));
  // each order brings the commission it was given at checkout; only older orders (no snapshot) use today's rate,
  // and an explicit rate typed by an admin overrides everything
  const perOrder = orders.map((o) => orderCommission(o, rate, hasOverride ? rate : null));
  const commission = round2(perOrder.reduce((s, c) => s + c.paise, 0) / 100);
  const snapshotted = perOrder.filter((c) => c.snapshotted).length;
  // the rate shown/stored on a settlement: today's rate if nothing was snapshotted, else what was actually charged
  const shownRate = snapshotted && grossSales > 0 ? Math.round((commission / grossSales) * 10000) / 10000 : rate;
  const dates = orders.map((o) => o.deliveredAt?.getTime()).filter(Boolean) as number[];
  return {
    orders,
    rate: shownRate,
    snapshotted, // how many of these orders carry a commission fixed at checkout
    ordersCount: orders.length,
    grossSales,
    codAmount,
    onlineAmount: round2(grossSales - codAmount),
    commission,
    net: round2(grossSales - commission),
    periodFrom: dates.length ? new Date(Math.min(...dates)) : undefined,
    periodTo: dates.length ? new Date(Math.max(...dates)) : undefined,
  };
};

export const csvEscape = (v: any) => {
  const s = v === undefined || v === null ? "" : v instanceof Date ? v.toISOString() : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const toCsv = (rows: Record<string, any>[]) => {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]);
  return [cols.join(","), ...rows.map((r) => cols.map((c) => csvEscape(r[c])).join(","))].join("\n");
};
