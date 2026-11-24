import { Request, Response } from "express";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import sharp from "sharp";
import Product from "../models/Products.js";
import { MEDIA_DIR, keyFromUrl } from "../utils/imageStore.js";
import { loadBrand, siteUrl as brandSiteUrl } from "../utils/brand.js";

/**
 * Link previews. WhatsApp, Telegram, Facebook & co. read a page's <meta> tags WITHOUT running
 * JavaScript, so the single-page website can't describe a product to them. The website's nginx
 * hands those crawlers to /share/product/:id, which answers with a tiny page of Open Graph tags.
 * Real visitors never see it.
 */

const siteUrl = () => brandSiteUrl();

export const esc = (v: unknown) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
const rupees = (n: number) => `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

/** The picture used when a page has none of its own: the brand's share image/icon if set, else the built-in icon. */
const defaultImage = (site: string) => `${site}/icons/${loadBrand().brand.images.shareImage || loadBrand().brand.images.icon || loadBrand().brand.images.logo ? "og.png" : "icon-512.png"}`;

export const sharePage = ({ title, description, image, url, siteName = loadBrand().brand.name }: { title: string; description: string; image: string; url: string; siteName?: string }) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(url)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(siteName)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(url)}">
<meta property="og:image" content="${esc(image)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${esc(image)}">
<meta http-equiv="refresh" content="0;url=${esc(url)}">
</head><body><a href="${esc(url)}">${esc(title)}</a></body></html>`;

// GET /share/site   what a link to the home page looks like when pasted in WhatsApp & co.
export const shareSite = (_req: Request, res: Response) => {
  const { brand } = loadBrand();
  const site = siteUrl();
  res.status(200).type("html").set("Cache-Control", "public, max-age=300").send(sharePage({
    title: brand.tagline ? `${brand.name} · ${brand.tagline}` : brand.name,
    description: brand.description,
    image: defaultImage(site),
    url: site,
  }));
};

// GET /share/product/:id
export const shareProduct = async (req: Request, res: Response) => {
  const site = siteUrl();
  const send = (status: number, page: string) => {
    res.status(status).type("html").set("Cache-Control", "public, max-age=300").send(page);
  };
  try {
    const id = String(req.params.id);
    const p: any = /^[a-f0-9]{24}$/.test(id)
      ? await Product.findOne({ _id: id, isActive: true }).select("name description price comparePrice images brand unit shop").populate("shop", "name")
      : null;
    if (!p) {
      return send(404, sharePage({ title: loadBrand().brand.name, description: loadBrand().brand.description, image: defaultImage(site), url: site }));
    }
    const price = rupees(p.price);
    const off = p.comparePrice > p.price ? ` (MRP ${rupees(p.comparePrice)})` : "";
    const facts = [p.brand, p.unit, p.shop?.name && `Sold by ${p.shop.name}`].filter(Boolean).join(" · ");
    const body = String(p.description || "").replace(/\s+/g, " ").trim();
    send(200, sharePage({
      title: clip(`${p.name} - ${price}`, 90),
      description: clip(`${price}${off}. ${facts ? facts + ". " : ""}${body}`.trim(), 200),
      image: p.images?.[0] ? `${site}/share/og/${id}.jpg` : defaultImage(site),
      url: `${site}/product/${id}`,
    }));
  } catch (error) {
    console.error("share page failed:", (error as Error).message);
    send(500, sharePage({ title: loadBrand().brand.name, description: loadBrand().brand.description, image: defaultImage(site), url: site }));
  }
};

const OG_DIR = path.join(MEDIA_DIR, "_og");

// GET /share/og/:id.jpg   a 1200x630 JPEG of the product photo (crawlers want JPEG/PNG at about this size)
export const shareImage = async (req: Request, res: Response) => {
  try {
    const m = /^([a-f0-9]{24})\.jpg$/.exec(String(req.params.file));
    if (!m) return res.status(404).end();
    const p: any = await Product.findOne({ _id: m[1], isActive: true }).select("images");
    const src: string | undefined = p?.images?.[0];
    if (!src) return res.redirect(302, `${siteUrl()}/icons/icon-512.png`);

    // the cache file name includes a hash of the photo, so a changed photo gets a fresh preview
    const file = path.join(OG_DIR, `${m[1]}-${createHash("sha1").update(src).digest("hex").slice(0, 10)}.jpg`);
    const cached = await stat(file).then(() => true, () => false);
    if (!cached) {
      let input: Buffer;
      const key = keyFromUrl(src);
      if (key) input = await readFile(path.join(MEDIA_DIR, key)); // our own storage
      else {
        // an old Cloudinary photo not migrated yet
        const r = await fetch(src, { signal: AbortSignal.timeout(10_000) });
        if (!r.ok) return res.redirect(302, `${siteUrl()}/icons/icon-512.png`);
        input = Buffer.from(await r.arrayBuffer());
      }
      // "contain" on a paper-coloured canvas: the whole product is visible, nothing is cropped
      const jpg = await sharp(input, { limitInputPixels: 50_000_000 })
        .rotate()
        .resize(1200, 630, { fit: "contain", background: loadBrand().brand.colors.background })
        .jpeg({ quality: 82, mozjpeg: true })
        .toBuffer();
      await mkdir(OG_DIR, { recursive: true });
      await writeFile(file, jpg);
    }
    res.set("Cache-Control", "public, max-age=3600").type("image/jpeg");
    res.sendFile(file);
  } catch (error) {
    console.error("share image failed:", (error as Error).message);
    res.redirect(302, `${siteUrl()}/icons/icon-512.png`);
  }
};
