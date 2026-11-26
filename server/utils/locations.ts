import Location from "../models/Location.js";
import Shop from "../models/Shop.js";
import Address from "../models/Address.js";
import DeliveryPartner from "../models/DeliveryPartner.js";
import { SERVICE_LOCATIONS } from "../types/index.js";
import { ruleFor } from "./deliveryPricing.js";
import { cleanLocationName, locationKey, matchLocations } from "./locationNames.js";

export { cleanLocationName, locationKey, locationNameProblem, matchLocations } from "./locationNames.js";

let cache: { at: number; names: string[] } | null = null;
const TTL_MS = 30_000;
export const invalidateLocations = () => { cache = null; };

const load = async () => {
  if (cache && Date.now() - cache.at < TTL_MS) return cache;
  const rows: any[] = await Location.find({ isActive: true }).sort({ order: 1, name: 1 }).lean();
  cache = { at: Date.now(), names: rows.map((r) => r.name) };
  return cache;
};

/** Locations offered right now, in the admin's order. Falls back to the original two if the database hiccups. */
export const activeLocationNames = async (): Promise<string[]> => {
  try {
    const c = await load();
    return c.names.length ? c.names : [...SERVICE_LOCATIONS];
  } catch {
    return [...SERVICE_LOCATIONS];
  }
};

/** The real name for something a client sent, or null if it isn't an active location. `current` (a value the record already has) is always accepted. */
export const resolveLocation = async (raw: unknown, current?: string): Promise<string | null> => {
  const key = locationKey(String(raw ?? ""));
  if (!key) return null;
  if (current && locationKey(current) === key) return current;
  return (await activeLocationNames()).find((n) => locationKey(n) === key) ?? null;
};

/** A list a client sent -> only the real, active names (duplicates and unknowns dropped). */
export const onlyKnownLocations = async (sent: unknown[]): Promise<string[]> => matchLocations(sent, await activeLocationNames());

/** The delivery rule that applies to a delivery location name (the platform default when it is empty or unknown). */
export const deliveryRuleFor = async (name: string | undefined | null, settings: { shippingCost: number; freeShippingThreshold: number }) => {
  let loc: any = null;
  if (name) {
    try { loc = await Location.findOne({ nameKey: locationKey(name) }).lean(); } catch { loc = null; }
  }
  return ruleFor(loc, settings);
};

/** Delivery rules of the offered locations, for the storefront ("minimum order ₹100", "not delivering to X"). */
export const activeDeliveryRules = async (settings: { shippingCost: number; freeShippingThreshold: number }) => {
  try {
    const rows: any[] = await Location.find({ isActive: true }).sort({ order: 1, name: 1 }).lean();
    return rows.map((l) => { const r = ruleFor(l, settings); return { name: l.name, enabled: r.enabled, fee: r.fee, freeAbove: r.freeAbove, minOrder: r.minOrder }; });
  } catch {
    return [];
  }
};

export const locationListText = async () => (await activeLocationNames()).join(", ");

/** Start-up: first run fills in the original two; any location a shop, address or driver already uses is kept. */
export const ensureLocations = async () => {
  try {
    const have: any[] = await Location.find().select("name").lean();
    const keys = new Set(have.map((l) => locationKey(l.name)));
    let order = have.length;
    const want = have.length === 0 ? [...SERVICE_LOCATIONS] : [];
    const used = new Set<string>();
    for (const list of await Promise.all([Shop.distinct("location"), Address.distinct("location"), DeliveryPartner.distinct("serviceLocations")])) {
      for (const v of list as any[]) if (v) used.add(String(v));
    }
    const add: any[] = [];
    for (const raw of [...want, ...used]) {
      const n = cleanLocationName(raw);
      if (!n || keys.has(locationKey(n))) continue;
      keys.add(locationKey(n));
      add.push({ name: n, nameKey: locationKey(n), order: order++, isActive: true });
    }
    if (add.length) await Location.insertMany(add, { ordered: false });
    invalidateLocations();
  } catch (error: any) {
    console.error("ensureLocations failed:", error.message);
  }
};
