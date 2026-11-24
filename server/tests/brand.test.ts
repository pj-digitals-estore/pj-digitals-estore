import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DEFAULT_BRAND, loadBrand, manifestFor, publicBrand, resetBrandCache, sanitizeBrand, siteUrl } from "../utils/brand.js";

const has = (...names: string[]) => (n: string) => names.includes(n);

test("nothing configured = the built-in defaults, no warnings", () => {
  const { brand, warnings } = sanitizeBrand(undefined);
  assert.deepEqual(brand, DEFAULT_BRAND);
  assert.equal(warnings.length, 0);
});

test("good values are applied and tidied", () => {
  const { brand, warnings } = sanitizeBrand({
    name: "  Nbyme   Store ", tagline: "Local, delivered", domain: "https://Shop.Nbyme.com/x",
    colors: { primary: "#ABC", themeColor: "#112233" },
    contact: { phone: "+91 98765 43210" }, social: { instagram: "https://instagram.com/nbyme" },
    business: { operator: "Nbyme Retail", grievanceOfficer: { name: "A B" } },
    policies: { returnWindowHours: 24, acceptsChangeOfMind: true },
  });
  assert.equal(brand.name, "Nbyme Store");
  assert.equal(brand.shortName, "Nbyme Store"); // follows the name when not set
  assert.equal(brand.domain, "shop.nbyme.com");
  assert.equal(brand.colors.primary, "#aabbcc"); // 3-digit hex expanded
  assert.equal(brand.contact.phone, "+91 98765 43210");
  assert.equal(brand.business.grievanceOfficer.name, "A B");
  assert.equal(brand.business.grievanceOfficer.hours, DEFAULT_BRAND.business.grievanceOfficer.hours); // untouched fields keep defaults
  assert.equal(brand.policies.returnWindowHours, 24);
  assert.equal(brand.policies.acceptsChangeOfMind, true);
  assert.deepEqual(warnings, []);
});

test("mistakes are ignored with a plain warning, never thrown", () => {
  const { brand, warnings } = sanitizeBrand({
    name: 42, colors: { primary: "green", background: "#12" }, domain: "not a domain!", social: { facebook: "facebook.com/x" },
    policies: { refundDays: "soon", returnWindowHours: 99999, acceptsChangeOfMind: "yes" }, contact: "x",
  });
  assert.equal(brand.name, DEFAULT_BRAND.name);
  assert.equal(brand.colors.primary, "");
  assert.equal(brand.colors.background, DEFAULT_BRAND.colors.background);
  assert.equal(brand.domain, DEFAULT_BRAND.domain);
  assert.equal(brand.social.facebook, "");
  assert.equal(brand.policies.refundDays, DEFAULT_BRAND.policies.refundDays);
  assert.ok(warnings.length >= 8, warnings.join("\n"));
  assert.ok(warnings.some((w) => /colors\.primary/.test(w)));
  assert.ok(sanitizeBrand([1, 2]).warnings[0].includes("must be an object"));
});

test("image names must be plain files that exist: no folders, no odd types", () => {
  const ok = sanitizeBrand({ images: { logo: "logo.png", icon: "icon.svg" } }, has("logo.png", "icon.svg"));
  assert.equal(ok.brand.images.logo, "logo.png");
  assert.equal(ok.brand.images.icon, "icon.svg");
  const bad = sanitizeBrand({ images: { logo: "../../etc/passwd", icon: "icon.exe", favicon: "missing.png", logoDark: "a/b.png" } }, has("icon.exe"));
  assert.deepEqual(Object.values(bad.brand.images).filter(Boolean), []);
  assert.equal(bad.warnings.length, 4);
  assert.ok(bad.warnings.some((w) => /missing\.png.*not in the brand folder/.test(w)));
});

test("over-long text is shortened with a warning", () => {
  const { brand, warnings } = sanitizeBrand({ name: "x".repeat(60) });
  assert.equal(brand.name.length, 40);
  assert.match(warnings[0], /too long/);
});

test("loadBrand reads brand.json from a folder, reports a broken file, and notices edits", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "brand-"));
  resetBrandCache();
  assert.match(loadBrand(dir).warnings[0], /No brand\.json/);

  writeFileSync(path.join(dir, "brand.json"), "{ not json");
  resetBrandCache();
  const broken = loadBrand(dir);
  assert.match(broken.warnings[0], /can't be read/);
  assert.equal(broken.brand.name, DEFAULT_BRAND.name);

  writeFileSync(path.join(dir, "logo.png"), "x");
  writeFileSync(path.join(dir, "brand.json"), JSON.stringify({ name: "Shop A", images: { logo: "logo.png" } }));
  resetBrandCache();
  const a = loadBrand(dir);
  assert.equal(a.brand.name, "Shop A");
  assert.deepEqual(a.files, ["logo.png"]);

  writeFileSync(path.join(dir, "brand.json"), JSON.stringify({ name: "Shop B", images: { logo: "logo.png" } }));
  resetBrandCache();
  const b = loadBrand(dir);
  assert.equal(b.brand.name, "Shop B");
  assert.notEqual(a.version, b.version); // a change gets a new version, so browsers fetch the new logo
});

test("publicBrand gives the website ready-to-use image URLs with the version", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "brand-"));
  writeFileSync(path.join(dir, "logo.png"), "x");
  writeFileSync(path.join(dir, "icon.png"), "x");
  writeFileSync(path.join(dir, "brand.json"), JSON.stringify({ images: { logo: "logo.png", icon: "icon.png" } }));
  resetBrandCache();
  const p = publicBrand(loadBrand(dir));
  assert.match(p.logoUrl, /^\/brand\/file\/logo\.png\?v=[a-f0-9]{10}$/);
  assert.equal(p.logoDarkUrl, "");
  assert.equal(p.hasIcon, true);
});

test("the web manifest carries the brand's name and colours", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "brand-"));
  writeFileSync(path.join(dir, "brand.json"), JSON.stringify({ name: "Shop A", shortName: "A", colors: { themeColor: "#112233", background: "#ffffff" } }));
  resetBrandCache();
  const m = manifestFor(loadBrand(dir));
  assert.equal(m.name, "Shop A");
  assert.equal(m.short_name, "A");
  assert.equal(m.theme_color, "#112233");
  assert.equal(m.background_color, "#ffffff");
  assert.ok(m.icons.some((i) => i.purpose === "maskable"));
  assert.ok(!m.icons[0].src.includes("?v=")); // no custom icon: plain built-in icon paths
});

test("siteUrl: SITE_URL wins, then the brand's domain", () => {
  const old = process.env.SITE_URL;
  delete process.env.SITE_URL;
  assert.equal(siteUrl({ ...DEFAULT_BRAND, domain: "shop.example.com" }), "https://shop.example.com");
  process.env.SITE_URL = "https://other.example.org/";
  assert.equal(siteUrl({ ...DEFAULT_BRAND, domain: "shop.example.com" }), "https://other.example.org");
  if (old === undefined) delete process.env.SITE_URL; else process.env.SITE_URL = old;
});
