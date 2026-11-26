// Product search without a search engine: forgiving of word order, partial words and small typos, and it
// puts the best matches first. Pure functions (no database) so every rule is testable.
// The caller loads a few fields of the products that pass the filters and ranks them here.

export type SearchDoc = { _id: unknown; name?: string; brand?: string; category?: string; sku?: string; barcode?: string; description?: string };

/** lowercase, accents removed, everything that isn't a letter or digit becomes a space */
export const normalize = (s: unknown) =>
  String(s ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

const STOP = new Set(["the", "a", "an", "of", "for", "and", "with", "in", "to"]);

export const tokensOf = (q: unknown): string[] => {
  const all = normalize(q).split(" ").filter(Boolean);
  const kept = all.filter((t) => !STOP.has(t));
  return (kept.length ? kept : all).slice(0, 8);
};

/** Edit distance (insert, delete, change one letter, swap two neighbours), giving up above `max`. */
export const editDistance = (a: string, b: string, max = 2): number => {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const prev2: number[] = [];
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, (prev2[j - 2] ?? 99) + 1); // swapped letters
      cur[j] = v;
      if (v < best) best = v;
    }
    if (best > max) return max + 1;
    prev2.splice(0, prev2.length, ...prev);
    prev = cur;
  }
  return prev[b.length];
};

/** How many typos a word of this length may have: short words must be exact. */
const allowedTypos = (len: number) => (len <= 3 ? 0 : len <= 6 ? 1 : 2);

/** How well one search word matches one word of a product: exact 10, starts-with 8, contains 5, typo 3, none 0. */
export const wordScore = (token: string, word: string): number => {
  if (token === word) return 10;
  if (word.startsWith(token)) return 8;
  if (token.length >= 3 && word.includes(token)) return 5;
  const typos = allowedTypos(token.length);
  if (typos > 0) {
    if (editDistance(token, word, typos) <= typos) return 3;
    if (word.length > token.length && editDistance(token, word.slice(0, token.length), typos) <= typos) return 3; // typo in a partly typed word
  }
  return 0;
};

const best = (token: string, words: string[]) => words.reduce((m, w) => Math.max(m, wordScore(token, w)), 0);

const WEIGHTS = { name: 3, brand: 2, category: 1.5, description: 0.4 } as const;

/**
 * Score of a product for the search words: 0 means it doesn't match. EVERY word must match somewhere
 * (name, brand, category, description, or exactly the SKU/barcode); the sum of the best field per word is the score.
 */
export const scoreDoc = (tokens: string[], doc: SearchDoc): number => {
  if (tokens.length === 0) return 0;
  const name = normalize(doc.name);
  const fields = {
    name: name.split(" ").filter(Boolean),
    brand: normalize(doc.brand).split(" ").filter(Boolean),
    category: normalize(doc.category).split(" ").filter(Boolean),
    description: normalize(doc.description).split(" ").filter(Boolean),
  };
  const codes = [normalize(doc.sku).replace(/ /g, ""), normalize(doc.barcode).replace(/ /g, "")].filter(Boolean);
  let total = 0;
  for (const t of tokens) {
    let top = 0;
    if (codes.includes(t.replace(/ /g, ""))) top = 40; // exact SKU / barcode
    for (const f of ["name", "brand", "category", "description"] as const) {
      const s = best(t, fields[f]) * WEIGHTS[f];
      if (s > top) top = s;
    }
    if (top === 0) return 0;
    total += top;
  }
  const phrase = tokens.join(" ");
  if (name.includes(phrase)) total += 12; // the words appear together, in order
  if (name.startsWith(tokens[0])) total += 4;
  return total;
};

/** Best matches first (ties keep the caller's order). */
export const rankDocs = <T extends SearchDoc>(query: unknown, docs: T[], limit = Infinity): T[] => {
  const tokens = tokensOf(query);
  if (!tokens.length) return [];
  return docs
    .map((d, i) => ({ d, i, s: scoreDoc(tokens, d) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .slice(0, limit)
    .map((x) => x.d);
};
