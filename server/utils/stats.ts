// Every date from `since` to today in India time, so the chart has no gaps (days without sales show 0).
export const fillDays = (rows: { _id: string; orders: number; sales: number }[], days: number, now = new Date()) => {
  const fmt = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }); // YYYY-MM-DD
  const by = new Map(rows.map((r) => [r._id, r]));
  const out: { date: string; orders: number; sales: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = fmt(new Date(now.getTime() - i * 86_400_000));
    const r = by.get(date);
    out.push({ date, orders: r?.orders ?? 0, sales: r?.sales ?? 0 });
  }
  return out;
};

