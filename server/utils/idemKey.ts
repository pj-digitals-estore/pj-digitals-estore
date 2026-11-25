/** The key the app sends with a checkout. Only plain, reasonably long tokens are accepted; anything else is ignored. */
export const normalizeKey = (raw: unknown): string | null => {
  if (typeof raw !== "string") return null;
  const k = raw.trim();
  return /^[A-Za-z0-9_-]{8,80}$/.test(k) ? k : null;
};

