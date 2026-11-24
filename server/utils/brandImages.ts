import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import type { Brand, LoadedBrand } from "./brand.js";
import { MEDIA_DIR } from "./imageStore.js";

/** The icon files the website, phones and link previews ask for, all made from the one icon you provide. */
export const ICON_FILES = ["favicon-32.png", "apple-touch-icon.png", "icon-192.png", "icon-512.png", "maskable-512.png", "og.png"] as const;
export type IconFile = (typeof ICON_FILES)[number];
export const isIconFile = (n: string): n is IconFile => (ICON_FILES as readonly string[]).includes(n);

/** Which of the brand's image files feeds which icon (or null when the brand has nothing to make it from). */
export const sourceFor = (file: IconFile, b: Brand): string | null => {
  const i = b.images;
  const pick = file === "favicon-32.png" ? i.favicon || i.icon : file === "og.png" ? i.shareImage || i.icon || i.logo : i.icon || i.favicon;
  return pick || null;
};

const fill = (hex: string) => {
  const h = hex.replace("#", "");
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), alpha: 1 };
};
const CLEAR = { r: 0, g: 0, b: 0, alpha: 0 };

/** Draws one icon. Pure image work: no files except reading the source. */
export async function renderIcon(file: IconFile, source: Buffer, b: Brand, sourceIsShareImage = false): Promise<Buffer> {
  const bg = b.colors.primary || b.colors.background;
  const fit = (size: number) => sharp(source, { density: 300 }).resize(size, size, { fit: "contain", background: CLEAR }).png().toBuffer();
  switch (file) {
    case "favicon-32.png":
      return sharp(source, { density: 300 }).resize(32, 32, { fit: "contain", background: CLEAR }).png().toBuffer();
    case "icon-192.png": return fit(192);
    case "icon-512.png": return fit(512);
    case "apple-touch-icon.png": {
      // iPhones paint transparent corners black, so this one gets a solid background and some breathing room
      const inner = await fit(144);
      return sharp({ create: { width: 180, height: 180, channels: 4, background: fill(b.colors.background) } }).composite([{ input: inner, gravity: "center" }]).png().toBuffer();
    }
    case "maskable-512.png": {
      // Android crops this to a circle or squircle: keep the artwork inside the central safe area
      const inner = await fit(300);
      return sharp({ create: { width: 512, height: 512, channels: 4, background: fill(bg) } }).composite([{ input: inner, gravity: "center" }]).png().toBuffer();
    }
    case "og.png": {
      if (sourceIsShareImage) return sharp(source).resize(1200, 630, { fit: "cover" }).png().toBuffer();
      const inner = await fit(360);
      return sharp({ create: { width: 1200, height: 630, channels: 4, background: fill(b.colors.background) } }).composite([{ input: inner, gravity: "center" }]).png().toBuffer();
    }
  }
}

/** Cached on disk by brand version, so each icon is drawn once per change. */
export async function iconFor(file: IconFile, l: LoadedBrand): Promise<Buffer | null> {
  const name = sourceFor(file, l.brand);
  if (!name) return null;
  const cacheDir = path.join(MEDIA_DIR, "_brand");
  const cachePath = path.join(cacheDir, `${l.version}-${file}`);
  try { return await readFile(cachePath); } catch { /* not drawn yet */ }
  const source = await readFile(path.join(l.dir, name));
  const out = await renderIcon(file, source, l.brand, file === "og.png" && name === l.brand.images.shareImage);
  await mkdir(cacheDir, { recursive: true });
  const tmp = `${cachePath}.${process.pid}.tmp`;
  await writeFile(tmp, out);
  await rename(tmp, cachePath);
  return out;
}
