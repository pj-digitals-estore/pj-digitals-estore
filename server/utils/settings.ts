import Setting from "../models/Setting.js";

/**
 * Platform settings an admin can change without redeploying.
 * Stored in MongoDB; any key not set there falls back to the env variable.
 */
export type PlatformSettings = {
  commissionRate: number; // platform cut of shop sales, 0.05 = 5%
  driverFee: number; // paid to the driver per completed delivery
  shippingCost: number;
  freeShippingThreshold: number; // 0 = off
  taxRate: number; // 0.18 = 18%
  gstRegistered: boolean; // tax is only ever charged when this is true (legally: only once you have a GSTIN)
  gstin: string;
  codMaxAmount: number; // largest cash-on-delivery checkout total; 0 = no limit
  allowCod: boolean;
  shopsCanAssignDrivers: boolean; // can shop owners assign delivery partners to their own orders?
  lowStockLevel: number;
  announcement: string; // site-wide message shown on the storefront
  supportPhone: string;
  supportEmail: string;
};

const num = (v: any, fallback: number) => (v !== undefined && v !== "" && Number.isFinite(Number(v)) ? Number(v) : fallback);

const defaults = (): PlatformSettings => ({
  commissionRate: num(process.env.COMMISSION_RATE, 0),
  driverFee: num(process.env.DRIVER_FEE, 0),
  shippingCost: num(process.env.SHIPPING_COST, 2),
  freeShippingThreshold: num(process.env.FREE_SHIPPING_THRESHOLD, 0),
  taxRate: num(process.env.TAX_RATE, 0),
  gstRegistered: process.env.GST_REGISTERED === "true",
  gstin: process.env.GSTIN || "",
  codMaxAmount: num(process.env.COD_MAX_AMOUNT, 0),
  allowCod: process.env.ALLOW_COD !== "false",
  shopsCanAssignDrivers: process.env.SHOPS_CAN_ASSIGN_DRIVERS !== "false",
  lowStockLevel: num(process.env.LOW_STOCK_LEVEL, 5),
  announcement: "",
  supportPhone: "",
  supportEmail: "",
});

let cache: { at: number; value: PlatformSettings } | null = null;
const TTL_MS = 30_000;

export const getSettings = async (): Promise<PlatformSettings> => {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;
  const doc: any = await Setting.findOne({ key: "platform" }).lean();
  const stored = doc?.values || {};
  const base = defaults();
  const value = { ...base, ...Object.fromEntries(Object.entries(stored).filter(([k, v]) => k in base && v !== null && v !== undefined)) } as PlatformSettings;
  cache = { at: Date.now(), value };
  return value;
};

/** Validates and saves a partial update. Throws an Error with a user-facing message. */
export const saveSettings = async (patch: Record<string, any>, userId?: any) => {
  const base = defaults();
  const clean: Record<string, any> = {};
  const rate = (k: string) => {
    const n = Number(patch[k]);
    if (!Number.isFinite(n) || n < 0 || n > 1) throw new Error(`${k} must be between 0 and 1 (e.g. 0.05 for 5%)`);
    clean[k] = n;
  };
  const money = (k: string) => {
    const n = Number(patch[k]);
    if (!Number.isFinite(n) || n < 0) throw new Error(`${k} must be 0 or more`);
    clean[k] = n;
  };
  for (const k of Object.keys(patch)) {
    if (!(k in base)) continue;
    if (k === "commissionRate" || k === "taxRate") rate(k);
    else if (["driverFee", "shippingCost", "freeShippingThreshold", "lowStockLevel", "codMaxAmount"].includes(k)) money(k);
    else if (k === "gstin") {
      const g = String(patch[k] ?? "").trim().toUpperCase();
      if (g && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(g)) throw new Error("That GSTIN does not look right (15 characters, e.g. 32ABCDE1234F1Z5)");
      clean[k] = g;
    } else if (k === "allowCod" || k === "shopsCanAssignDrivers" || k === "gstRegistered") clean[k] = patch[k] === true || patch[k] === "true";
    else clean[k] = String(patch[k] ?? "").slice(0, 300);
  }
  const doc: any = await Setting.findOne({ key: "platform" });
  const values = { ...(doc?.values || {}), ...clean };
  if (values.gstRegistered === true && !(values.gstin || base.gstin)) throw new Error("Enter your GSTIN before switching GST on.");
  await Setting.findOneAndUpdate({ key: "platform" }, { values, updatedBy: userId }, { upsert: true });
  cache = null;
  return getSettings();
};
