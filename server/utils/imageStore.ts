import "dotenv/config";
import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

/**
 * Own image storage (replaces Cloudinary).
 *
 * Every upload is auto-rotated, resized and saved as WebP in three sizes:
 *   <id>.webp      up to 1600px  (product page, lightbox)
 *   <id>-md.webp   up to 640px   (cards, lists)
 *   <id>-sm.webp   up to 240px   (thumbnails, cart rows)
 * Files live in MEDIA_DIR (a Docker volume) and are served by Express at /media.
 * Names are random and never reused, so they are cached "forever" by browsers and Cloudflare.
 */

export const MEDIA_DIR = path.resolve(process.env.MEDIA_DIR || "media");

const trimSlash = (s: string) => s.replace(/\/+$/, "");
const MEDIA_BASE = trimSlash(
  process.env.MEDIA_BASE_URL ||
    (process.env.PUBLIC_URL ? `${trimSlash(process.env.PUBLIC_URL)}/media` : "/media"),
);

const SIZES = [
  { suffix: "", width: 1600, quality: 82 },
  { suffix: "-md", width: 640, quality: 80 },
  { suffix: "-sm", width: 240, quality: 78 },
] as const;

// folder + name only ever contain these characters, so a stored URL can never point outside MEDIA_DIR
const KEY_RE = /^[a-z0-9-]+\/[a-z0-9-]+(?:-md|-sm)?\.webp$/;

export class ImageError extends Error {
  http_code = 400;
}

const cleanFolder = (folder: string) => {
  const last = folder.split("/").filter(Boolean).pop() || "misc";
  return last.toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 40) || "misc";
};

export type StoredImage = { secure_url: string; url: string; key: string };

/** Process an image buffer and store the 3 sizes. */
export const saveImageBuffer = async (
  input: Buffer,
  folder = "products",
): Promise<StoredImage> => {
  const dir = cleanFolder(folder);
  const id = randomUUID();
  const written: string[] = [];

  try {
    await mkdir(path.join(MEDIA_DIR, dir), { recursive: true });

    for (const s of SIZES) {
      // limitInputPixels stops decompression bombs; failOn "error" rejects corrupt files
      const buf = await sharp(input, { limitInputPixels: 50_000_000, failOn: "error" })
        .rotate()
        .resize({ width: s.width, height: s.width, fit: "inside", withoutEnlargement: true })
        .webp({ quality: s.quality })
        .toBuffer();
      const file = path.join(MEDIA_DIR, dir, `${id}${s.suffix}.webp`);
      await writeFile(file, buf);
      written.push(file);
    }
  } catch (err: any) {
    await Promise.all(written.map((f) => rm(f, { force: true })));
    // sharp errors mean "this file is not a usable image"; anything else (disk full...) is ours
    if (/Input|image|unsupported|corrupt|pixel|VipsJpeg|webp/i.test(String(err?.message)) && !err?.code) {
      throw new ImageError("That file could not be read as an image. Try a JPEG, PNG or WebP photo.");
    }
    throw err;
  }

  const key = `${dir}/${id}.webp`;
  const url = `${MEDIA_BASE}/${key}`;
  return { secure_url: url, url, key };
};

/** Drop-in for the old uploadToCloudinary(file, folder). */
export const uploadImage = (file: Express.Multer.File, folder = "products") =>
  saveImageBuffer(file.buffer, folder);

/** "https://api.nbyme.com/media/products/abc.webp" -> "products/abc.webp" (null if not our file) */
export const keyFromUrl = (image: unknown): string | null => {
  if (typeof image !== "string") return null;
  const i = image.indexOf("/media/");
  if (i === -1) return null;
  if (!/^(https?:\/\/[^/]+)?\/media\//.test(image)) return null;
  const key = image.slice(i + "/media/".length).split("?")[0];
  if (!KEY_RE.test(key)) return null;
  return key.replace(/-(md|sm)\.webp$/, ".webp");
};

export const isOwnImage = (image: unknown) => keyFromUrl(image) !== null;

/** Delete stored images (all 3 sizes). Old Cloudinary URLs are still cleaned up while you migrate. */
export const destroyImages = async (images: (string | undefined | null)[]) => {
  await Promise.allSettled(
    images.filter(Boolean).map(async (image) => {
      const key = keyFromUrl(image);
      if (key) {
        const base = key.replace(/\.webp$/, "");
        await Promise.all(
          SIZES.map((s) => rm(path.join(MEDIA_DIR, `${base}${s.suffix}.webp`), { force: true })),
        );
        return;
      }
      await destroyLegacyCloudinary(image as string);
    }),
  );
};

// ---- legacy Cloudinary clean-up (only runs for old URLs, only if credentials are still set) ----
const destroyLegacyCloudinary = async (url: string) => {
  if (!/res\.cloudinary\.com/.test(url) || !process.env.CLOUDINARY_API_SECRET) return;
  try {
    const { destroyImages: legacy } = await import("./cloudinaryUpload.js");
    await legacy([url]);
  } catch (e) {
    console.error("Legacy Cloudinary delete skipped:", (e as Error).message);
  }
};
