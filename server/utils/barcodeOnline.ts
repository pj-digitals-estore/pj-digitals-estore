// Optional online lookup for a barcode that is not in the shared catalogue yet. Uses Open Food Facts
// (free, no key; mostly packaged food and everyday goods). Only the barcode number is sent. Anything that
// goes wrong (offline, slow, unknown barcode) just means "no suggestion". Turn it off with BARCODE_LOOKUP=off.

export type OnlineProduct = { name: string; brand?: string; unit?: string; source: string };

const clean = (v: unknown, max: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);

/** Reads an Open Food Facts v2 answer; null when it has no usable product name. */
export const parseOpenFoodFacts = (json: any): OnlineProduct | null => {
  if (!json || json.status === 0 || !json.product) return null;
  const p = json.product;
  const name = clean(p.product_name_en || p.product_name || p.generic_name, 120);
  if (!name) return null;
  // "Tata, Tata Consumer" -> the first brand
  const brand = clean(String(p.brands ?? "").split(",")[0], 60) || undefined;
  const unit = clean(p.quantity, 30) || undefined;
  return { name, brand, unit, source: "Open Food Facts" };
};

const cache = new Map<string, { at: number; value: OnlineProduct | null }>();
const TTL = 10 * 60 * 1000;

export const onlineLookupEnabled = () => (process.env.BARCODE_LOOKUP || "on").toLowerCase() !== "off";

export const lookupOnline = async (barcode: string, fetcher: typeof fetch = fetch): Promise<OnlineProduct | null> => {
  if (!onlineLookupEnabled() || !/^\d{6,14}$/.test(barcode)) return null;
  const hit = cache.get(barcode);
  if (hit && Date.now() - hit.at < TTL) return hit.value;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 3000);
  try {
    const res = await fetcher(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=product_name,product_name_en,generic_name,brands,quantity`, {
      signal: ctrl.signal,
      headers: { "User-Agent": "nbyme-estore/1.0 (shop barcode lookup)" },
    });
    const value = res.ok ? parseOpenFoodFacts(await res.json()) : null;
    if (cache.size > 500) cache.clear();
    cache.set(barcode, { at: Date.now(), value });
    return value;
  } catch {
    return null; // not cached: a network blip shouldn't hide a product for 10 minutes
  } finally {
    clearTimeout(timer);
  }
};
