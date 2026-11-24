const BARCODE_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{2,31}$/;

/** A clean barcode (3-32 letters, numbers, dots, dashes or underscores), or null. */
export const normalizeBarcode = (v: unknown): string | null => {
  const s = String(v ?? "").trim();
  return BARCODE_RE.test(s) ? s : null;
};
