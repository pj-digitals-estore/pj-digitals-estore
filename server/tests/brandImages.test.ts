import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { DEFAULT_BRAND, type Brand } from "../utils/brand.js";
import { ICON_FILES, isIconFile, renderIcon, sourceFor } from "../utils/brandImages.js";

const brand = (o: Partial<Brand["images"]> = {}, colors: Partial<Brand["colors"]> = {}): Brand =>
  ({ ...DEFAULT_BRAND, images: { ...DEFAULT_BRAND.images, ...o }, colors: { ...DEFAULT_BRAND.colors, ...colors } });

// a wide 400x200 red logo with a transparent border, to prove icons are fitted and not stretched
const source = () => sharp({ create: { width: 400, height: 200, channels: 4, background: { r: 200, g: 0, b: 0, alpha: 1 } } }).png().toBuffer();

test("only the known icon names are accepted", () => {
  assert.ok(ICON_FILES.every(isIconFile));
  assert.equal(isIconFile("../x.png"), false);
  assert.equal(isIconFile("icon-999.png"), false);
});

test("each icon comes from the right source, or none when nothing is configured", () => {
  assert.equal(sourceFor("icon-512.png", brand()), null);
  assert.equal(sourceFor("icon-512.png", brand({ icon: "i.png" })), "i.png");
  assert.equal(sourceFor("favicon-32.png", brand({ icon: "i.png", favicon: "f.png" })), "f.png");
  assert.equal(sourceFor("favicon-32.png", brand({ icon: "i.png" })), "i.png");
  assert.equal(sourceFor("og.png", brand({ icon: "i.png", shareImage: "s.jpg" })), "s.jpg");
  assert.equal(sourceFor("og.png", brand({ logo: "l.png" })), "l.png");
});

test("icons have exactly the sizes phones and browsers expect", async () => {
  const src = await source();
  const sizes: Record<string, [number, number]> = { "favicon-32.png": [32, 32], "apple-touch-icon.png": [180, 180], "icon-192.png": [192, 192], "icon-512.png": [512, 512], "maskable-512.png": [512, 512], "og.png": [1200, 630] };
  for (const [file, [w, h]] of Object.entries(sizes)) {
    const out = await renderIcon(file as any, src, brand({ icon: "i.png" }, { primary: "#1f6a49" }));
    const m = await sharp(out).metadata();
    assert.deepEqual([m.format, m.width, m.height], ["png", w, h], file);
  }
});

test("a wide logo is fitted inside the square, not stretched", async () => {
  const out = await renderIcon("icon-512.png", await source(), brand());
  const { data, info } = await sharp(out).raw().toBuffer({ resolveWithObject: true });
  const px = (x: number, y: number) => data[(y * info.width + x) * info.channels + 3]; // alpha
  assert.equal(px(256, 256), 255); // the logo is in the middle
  assert.equal(px(256, 20), 0); // above it is clear (letterbox), so nothing was stretched
});

test("the maskable icon is filled edge to edge with the brand colour", async () => {
  const out = await renderIcon("maskable-512.png", await source(), brand({ icon: "i.png" }, { primary: "#00ff00" }));
  const { data, info } = await sharp(out).raw().toBuffer({ resolveWithObject: true });
  assert.deepEqual([data[0], data[1], data[2]], [0, 255, 0]);
  assert.equal(data[3], 255);
  assert.equal(info.channels >= 4, true);
});

test("the Apple icon has no transparent corners (iPhones paint them black)", async () => {
  const out = await renderIcon("apple-touch-icon.png", await source(), brand({ icon: "i.png" }));
  const { data } = await sharp(out).raw().toBuffer({ resolveWithObject: true });
  assert.equal(data[3], 255);
});

test("a ready-made share image is cropped to cover 1200x630", async () => {
  const out = await renderIcon("og.png", await source(), brand({ shareImage: "s.png" }), true);
  const m = await sharp(out).metadata();
  assert.deepEqual([m.width, m.height], [1200, 630]);
});
