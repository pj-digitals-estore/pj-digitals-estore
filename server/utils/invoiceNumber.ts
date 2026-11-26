// Invoice numbers: PREFIX/26-27/00123. Sequential inside each Indian financial year (1 April to 31 March),
// no gaps, never reused. Pure helpers here; the database part is in utils/invoices.ts.

/** "2026-27" for any date in April 2026 - March 2027, using India time. */
export const financialYear = (date: Date = new Date()) => {
  const ist = new Date(date.getTime() + 5.5 * 60 * 60 * 1000);
  const y = ist.getUTCFullYear();
  const start = ist.getUTCMonth() >= 3 ? y : y - 1; // month 3 = April
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
};

/** Letters, digits and dashes only, short (GST rules cap an invoice number at 16 characters in total). */
export const cleanPrefix = (raw: unknown) => {
  const p = String(raw ?? "").toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 4);
  return p || "INV";
};

/** PREFIX/26-27/00042: at most 16 characters (the GST limit) with a 4-letter prefix and up to 99,999 invoices a year. */
export const formatInvoiceNumber = (prefix: string, fy: string, seq: number) => `${cleanPrefix(prefix)}/${fy.slice(2)}/${String(seq).padStart(5, "0")}`;
