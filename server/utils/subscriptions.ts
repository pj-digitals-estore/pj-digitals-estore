// Dates for repeat orders (pure, tested). Reminders go out at 8 in the morning, India time.
const IST_MS = 5.5 * 3600 * 1000;
const DAY_MS = 24 * 3600 * 1000;

export const validEvery = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 && n <= 90 ? n : null;
};

/** 8:00 India time, `days` calendar days after the India date of `from`. */
export const morningAfter = (from: Date, days: number): Date => {
  const ist = new Date(from.getTime() + IST_MS);
  const midnightUtc = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate() + days);
  return new Date(midnightUtc + 8 * 3600 * 1000 - IST_MS);
};

/** After a reminder: the next due time, one step at a time, until it is in the future. */
export const advancePast = (nextAt: Date, everyDays: number, now: Date): Date => {
  let t = new Date(nextAt);
  for (let i = 0; i < 400 && t <= now; i++) t = morningAfter(t, everyDays);
  return t;
};

export const reminderBody = (names: string[]) => {
  const shown = names.filter(Boolean).slice(0, 2).join(", ");
  const more = names.length - Math.min(2, names.filter(Boolean).length);
  return `${shown || "Your items"}${more > 0 ? ` and ${more} more` : ""}. Tap to order again.`;
};
