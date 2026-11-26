// What a customer sees about refunds on their order (pure, so it is tested).
export type RefundRow = { status: string; amountPaise: number; reference?: string; completedAt?: Date | string | null };

export type RefundView = {
  state: "pending" | "partial" | "paid";
  paidPaise: number; // already back with the customer
  pendingPaise: number; // decided, not yet paid
  reference?: string; // the latest payment reference (UPI / bank)
  paidAt?: Date | string | null;
};

/** null when no refund has been started for the order. Cancelled refund rows are ignored. */
export function refundView(rows: RefundRow[], order: { totalAmount: number }): RefundView | null {
  const live = rows.filter((r) => r.status === "pending" || r.status === "completed");
  if (!live.length) return null;
  const done = live.filter((r) => r.status === "completed");
  const paidPaise = done.reduce((s, r) => s + r.amountPaise, 0);
  const pendingPaise = live.filter((r) => r.status === "pending").reduce((s, r) => s + r.amountPaise, 0);
  const last = [...done].sort((a, b) => +new Date(b.completedAt || 0) - +new Date(a.completedAt || 0))[0];
  const full = paidPaise >= Math.round(order.totalAmount * 100);
  return {
    state: pendingPaise > 0 ? (paidPaise > 0 ? "partial" : "pending") : full ? "paid" : "partial",
    paidPaise, pendingPaise, reference: last?.reference, paidAt: last?.completedAt,
  };
}
