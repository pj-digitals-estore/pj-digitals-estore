import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

/**
 * ONE place for the store's identity: name, logo, icons, colours, contact and legal details.
 * It lives in a file on the server (BRAND_DIR/brand.json, plus the logo/icon image files beside it),
 * so changing it never needs a rebuild: edit the file and the website picks it up within seconds.
 * Anything missing or invalid falls back to the defaults below, and mistakes are reported (never crash).
 */

export const BRAND_DIR = path.resolve(process.env.BRAND_DIR || "brand");

export type Brand = {
  name: string;
  shortName: string;
  tagline: string;
  description: string;
  domain: string;
  colors: { primary: string; background: string; themeColor: string };
  images: { logo: string; logoDark: string; icon: string; favicon: string; shareImage: string };
  contact: { phone: string; whatsapp: string; email: string; address: string };
  social: { instagram: string; facebook: string; youtube: string };
  business: {
    operator: string;
    jurisdiction: string;
    grievanceOfficer: { name: string; phone: string; email: string; hours: string };
  };
  policies: {
    acceptsChangeOfMind: boolean;
    returnWindowHours: number;
    refundDays: number;
    deliveryEstimate: string;
    complaintAckHours: number;
    complaintResolveDays: number;
    lastUpdated: string;
  };
};

export const DEFAULT_BRAND: Brand = {
  name: "PJ Digitals",
  shortName: "PJ Digitals",
  tagline: "Shop from local stores",
  description: "Electronics, textiles and home appliances from local shops, delivered to your door.",
  domain: "nbyme.com",
  colors: { primary: "", background: "#f6f4ef", themeColor: "#f6f4ef" }, // primary "" = the built-in green
  images: { logo: "", logoDark: "", icon: "", favicon: "", shareImage: "" },
  contact: { phone: "", whatsapp: "", email: "", address: "" },
  social: { instagram: "", facebook: "", youtube: "" },
  business: {
    operator: "",
    jurisdiction: "",
    grievanceOfficer: { name: "", phone: "", email: "", hours: "Mon to Sat, 10am to 6pm" },
  },
  policies: {
    acceptsChangeOfMind: false,
    returnWindowHours: 48,
    refundDays: 7,
    deliveryEstimate: "the same day or the next day",
    complaintAckHours: 48,
    complaintResolveDays: 30,
    lastUpdated: "19 November 2026",
  },
};

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const isObj = (v: unknown): v is Record<string, any> => !!v && typeof v === "object" && !Array.isArray(v);

const IMAGE_FILE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}\.(png|jpe?g|webp|svg)$/i;
const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

export const expandHex = (h: string) => (h.length === 4 ? `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}` : h).toLowerCase();

/**
 * Turns whatever is in brand.json into a safe Brand. `fileExists` says whether an image file is really there.
 * Returns the cleaned brand and plain-language warnings for anything that was ignored.
 */
export function sanitizeBrand(raw: unknown, fileExists: (name: string) => boolean = () => true): { brand: Brand; warnings: string[] } {
  const brand = clone(DEFAULT_BRAND);
  const warnings: string[] = [];
  if (raw === undefined || raw === null) return { brand, warnings };
  if (!isObj(raw)) return { brand, warnings: ["brand.json must be an object { ... }. Using the defaults."] };

  const str = (v: unknown, key: string, max: number, allowEmpty = true): string | undefined => {
    if (v === undefined) return undefined;
    if (typeof v !== "string") { warnings.push(`${key}: expected text`); return undefined; }
    const t = v.replace(/\s+/g, " ").trim();
    if (!t && !allowEmpty) { warnings.push(`${key}: can't be empty`); return undefined; }
    if (t.length > max) { warnings.push(`${key}: too long (max ${max} characters), shortened`); return t.slice(0, max).trim(); }
    return t;
  };
  const num = (v: unknown, key: string, lo: number, hi: number): number | undefined => {
    if (v === undefined) return undefined;
    const n = Number(v);
    if (!Number.isInteger(n) || n < lo || n > hi) { warnings.push(`${key}: should be a whole number from ${lo} to ${hi}`); return undefined; }
    return n;
  };

  const set = <T extends Record<string, any>>(target: T, key: keyof T & string, value: any) => { if (value !== undefined) (target as any)[key] = value; };

  set(brand, "name", str(raw.name, "name", 40, false));
  set(brand, "shortName", str(raw.shortName, "shortName", 24, false));
  if (raw.name !== undefined && raw.shortName === undefined) brand.shortName = brand.name.slice(0, 24);
  set(brand, "tagline", str(raw.tagline, "tagline", 80));
  set(brand, "description", str(raw.description, "description", 200));
  const domain = str(raw.domain, "domain", 100);
  if (domain !== undefined) {
    const d = domain.replace(/^https?:\/\//i, "").replace(/\/.*$/, "").toLowerCase();
    if (d === "" || /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?(:\d+)?$/.test(d)) brand.domain = d || brand.domain;
    else warnings.push(`domain: "${domain}" doesn't look like a website address (use e.g. nbyme.com)`);
  }

  if (raw.colors !== undefined) {
    if (!isObj(raw.colors)) warnings.push("colors: expected an object");
    else for (const k of ["primary", "background", "themeColor"] as const) {
      const v = raw.colors[k];
      if (v === undefined) continue;
      if (typeof v === "string" && (HEX.test(v.trim()) || (k === "primary" && v.trim() === ""))) brand.colors[k] = v.trim() ? expandHex(v.trim()) : "";
      else warnings.push(`colors.${k}: "${v}" is not a colour like #1f6a49`);
    }
  }

  if (raw.images !== undefined) {
    if (!isObj(raw.images)) warnings.push("images: expected an object");
    else for (const k of Object.keys(brand.images) as (keyof Brand["images"])[]) {
      const v = raw.images[k];
      if (v === undefined || v === "") continue;
      if (typeof v !== "string" || !IMAGE_FILE.test(v.trim())) { warnings.push(`images.${k}: "${v}" must be a file name like logo.png (png, jpg, webp or svg, no folders)`); continue; }
      if (!fileExists(v.trim())) { warnings.push(`images.${k}: the file "${v.trim()}" is not in the brand folder`); continue; }
      brand.images[k] = v.trim();
    }
  }

  const group = (name: "contact" | "social", max: number, url = false) => {
    const src = (raw as any)[name];
    if (src === undefined) return;
    if (!isObj(src)) return void warnings.push(`${name}: expected an object`);
    for (const k of Object.keys(brand[name])) {
      const v = str(src[k], `${name}.${k}`, max);
      if (v === undefined) continue;
      if (url && v && !/^https?:\/\/\S+$/i.test(v)) { warnings.push(`${name}.${k}: must start with https://`); continue; }
      (brand[name] as any)[k] = v;
    }
  };
  group("contact", 300);
  group("social", 200, true);

  if (raw.business !== undefined) {
    if (!isObj(raw.business)) warnings.push("business: expected an object");
    else {
      set(brand.business, "operator", str(raw.business.operator, "business.operator", 150));
      set(brand.business, "jurisdiction", str(raw.business.jurisdiction, "business.jurisdiction", 100));
      const g = raw.business.grievanceOfficer;
      if (g !== undefined) {
        if (!isObj(g)) warnings.push("business.grievanceOfficer: expected an object");
        else for (const k of ["name", "phone", "email", "hours"] as const) set(brand.business.grievanceOfficer, k, str(g[k], `business.grievanceOfficer.${k}`, 100));
      }
    }
  }

  if (raw.policies !== undefined) {
    if (!isObj(raw.policies)) warnings.push("policies: expected an object");
    else {
      const p = raw.policies;
      if (p.acceptsChangeOfMind !== undefined) {
        if (typeof p.acceptsChangeOfMind === "boolean") brand.policies.acceptsChangeOfMind = p.acceptsChangeOfMind;
        else warnings.push("policies.acceptsChangeOfMind: use true or false");
      }
      set(brand.policies, "returnWindowHours", num(p.returnWindowHours, "policies.returnWindowHours", 1, 720));
      set(brand.policies, "refundDays", num(p.refundDays, "policies.refundDays", 1, 90));
      set(brand.policies, "complaintAckHours", num(p.complaintAckHours, "policies.complaintAckHours", 1, 720));
      set(brand.policies, "complaintResolveDays", num(p.complaintResolveDays, "policies.complaintResolveDays", 1, 180));
      set(brand.policies, "deliveryEstimate", str(p.deliveryEstimate, "policies.deliveryEstimate", 100));
      set(brand.policies, "lastUpdated", str(p.lastUpdated, "policies.lastUpdated", 40));
    }
  }
  return { brand, warnings };
}

export type LoadedBrand = { brand: Brand; warnings: string[]; version: string; dir: string; files: string[] };

let cached: { at: number; value: LoadedBrand } | null = null;
const CHECK_EVERY_MS = 2000;

/** Reads brand.json (at most every couple of seconds, so edits show up almost at once). Never throws. */
export function loadBrand(dir = BRAND_DIR): LoadedBrand {
  const now = Date.now();
  if (cached && cached.value.dir === dir && now - cached.at < CHECK_EVERY_MS) return cached.value;

  const jsonPath = path.join(dir, "brand.json");
  const mtime = (p: string) => { try { return statSync(p).mtimeMs; } catch { return 0; } };
  let raw: unknown;
  const warnings: string[] = [];
  if (existsSync(jsonPath)) {
    try { raw = JSON.parse(readFileSync(jsonPath, "utf8")); } catch (e: any) { warnings.push(`brand.json can't be read (${e.message}). Using the defaults. Check for a missing comma or quote.`); }
  } else warnings.push(`No brand.json in ${dir}. Using the built-in defaults.`);

  const { brand, warnings: w } = sanitizeBrand(raw, (name) => existsSync(path.join(dir, name)));
  warnings.push(...w);
  const files = Object.values(brand.images).filter(Boolean);
  const stamp = [mtime(jsonPath), ...files.map((f) => mtime(path.join(dir, f)))].join(",");
  const version = createHash("sha1").update(stamp + JSON.stringify(brand)).digest("hex").slice(0, 10);
  const value: LoadedBrand = { brand, warnings, version, dir, files };
  cached = { at: now, value };
  return value;
}

export const resetBrandCache = () => { cached = null; };

/** The https://domain used in links and previews: SITE_URL if set, otherwise the brand's domain. */
export const siteUrl = (b: Brand = loadBrand().brand) => {
  const explicit = process.env.SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  if (b.domain) return `https://${b.domain}`;
  const fromClient = (process.env.CLIENT_URL || "").split(",").map((s) => s.trim()).find((u) => u && !/vercel\.app|localhost/.test(u));
  return (fromClient || "https://nbyme.com").replace(/\/+$/, "");
};

/** What the website receives: the brand plus ready-to-use image URLs (with ?v= so a change shows at once). */
export function publicBrand(l: LoadedBrand = loadBrand()) {
  const b = l.brand;
  const v = `?v=${l.version}`;
  const file = (n: string) => (n ? `/brand/file/${n}${v}` : "");
  return {
    ...b,
    version: l.version,
    logoUrl: file(b.images.logo),
    logoDarkUrl: file(b.images.logoDark || ""),
    hasIcon: !!(b.images.icon || b.images.favicon),
  };
}

export const manifestFor = (l: LoadedBrand = loadBrand()) => {
  const b = l.brand;
  const customIcons = !!(b.images.icon || b.images.favicon);
  const v = customIcons ? `?v=${l.version}` : "";
  return {
    id: "/",
    name: b.name,
    short_name: b.shortName,
    description: b.description,
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    lang: "en-IN",
    background_color: b.colors.background,
    theme_color: b.colors.themeColor,
    categories: ["shopping"],
    icons: [
      { src: `/icons/icon-192.png${v}`, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: `/icons/icon-512.png${v}`, sizes: "512x512", type: "image/png", purpose: "any" },
      { src: `/icons/maskable-512.png${v}`, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Products", url: "/shop?source=shortcut", icons: [{ src: `/icons/icon-192.png${v}`, sizes: "192x192" }] },
      { name: "Cart", url: "/cart?source=shortcut", icons: [{ src: `/icons/icon-192.png${v}`, sizes: "192x192" }] },
      { name: "My orders", url: "/orders?source=shortcut", icons: [{ src: `/icons/icon-192.png${v}`, sizes: "192x192" }] },
    ],
  };
};
