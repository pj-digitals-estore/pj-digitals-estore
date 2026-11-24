import { Request, Response } from "express";
import { BRAND_DIR, loadBrand, manifestFor, publicBrand } from "../utils/brand.js";
import { iconFor, isIconFile } from "../utils/brandImages.js";
import { sendError } from "../utils/http.js";

// GET /brand/manifest.webmanifest  (the website serves it at /manifest.webmanifest)
export const brandManifest = (_req: Request, res: Response) => {
  res.setHeader("Content-Type", "application/manifest+json; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=300");
  res.send(JSON.stringify(manifestFor(loadBrand())));
};

// GET /brand/icon/:file   (favicon-32.png, apple-touch-icon.png, icon-192.png, icon-512.png, maskable-512.png, og.png)
// 404 when no icon is configured, so the website falls back to its built-in one.
export const brandIcon = async (req: Request, res: Response) => {
  try {
    const file = String(req.params.file);
    if (!isIconFile(file)) return void res.status(404).end();
    const png = await iconFor(file, loadBrand());
    if (!png) return void res.status(404).end();
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=300");
    res.send(png);
  } catch (error) {
    console.error("brand icon failed:", (error as Error).message);
    res.status(404).end(); // a broken source image must never break the website: it falls back to the built-in icon
  }
};

// GET /brand/file/:name  - only the image files named in brand.json (never brand.json itself or anything else)
export const brandFile = (req: Request, res: Response) => {
  const l = loadBrand();
  const name = String(req.params.name);
  if (!l.files.includes(name)) return void res.status(404).end();
  // an uploaded SVG must never run scripts if someone opens it directly
  res.setHeader("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; sandbox");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", "public, max-age=86400"); // the URL carries ?v=<version>, so a change gets a new URL
  res.sendFile(name, { root: BRAND_DIR, dotfiles: "deny" }, (err) => { if (err && !res.headersSent) res.status(404).end(); });
};

// GET /api/admin/brand - what the server understood from brand.json, with plain-language warnings
export const adminBrand = (_req: Request, res: Response) => {
  try {
    const l = loadBrand();
    res.json({ success: true, data: { brand: publicBrand(l), warnings: l.warnings, dir: l.dir, files: l.files } });
  } catch (error) {
    sendError(res, error, "Failed to read the brand settings");
  }
};
