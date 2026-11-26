/** Pure helpers for location names (no database), so they can be unit tested. */
export const cleanLocationName = (raw: unknown): string => String(raw ?? "").replace(/\s+/g, " ").trim();
export const locationKey = (name: string) => cleanLocationName(name).toLowerCase();

/** Returns an error message, or "" when the name is fine. Commas and brackets are out: lists are sometimes sent as text. */
export const locationNameProblem = (name: string): string => {
  if (name.length < 2) return "Location name must be at least 2 characters";
  if (name.length > 40) return "Location name can be at most 40 characters";
  if (/[,<>"\[\]{}]/.test(name)) return "Location name can't contain commas, quotes or brackets";
  return "";
};

/**
 * Matches the names a client sent (any capitalisation, any duplicates) to the real ones, keeping the client's order
 * and dropping anything unknown. `known` is the list of valid names.
 */
export const matchLocations = (sent: unknown[], known: string[]): string[] => {
  const byKey = new Map(known.map((n) => [locationKey(n), n]));
  const out: string[] = [];
  for (const s of sent) {
    const real = byKey.get(locationKey(String(s ?? "")));
    if (real && !out.includes(real)) out.push(real);
  }
  return out;
};
