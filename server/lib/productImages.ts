import cloudinary from '../config/cloudinary.js';
import { HttpError } from './trialValidation.js';

type File = { buffer: Buffer; size: number };
export function imagePlan(body: any, files: File[], current: string[] = []) {
  const existing = body.existingImages === undefined ? [] : Array.isArray(body.existingImages) ? body.existingImages : [body.existingImages];
  if (existing.some((url: unknown) => typeof url !== 'string' || !current.includes(url as string)) || new Set(existing).size !== existing.length) throw new HttpError(400, 'Retain only images already belonging to this product.');
  const count = existing.length + files.length;
  if (count < 1 || count > 5) throw new HttpError(400, 'A product must have between 1 and 5 images.');
  if (files.reduce((total, file) => total + file.size, 0) > 3 * 1024 * 1024) throw new HttpError(400, 'New images must be under 3 MB in total.');
  const keys: string[] = [...existing, ...files.map((_, index) => `new:${index}`)];
  let order: unknown = keys;
  if (body.imageOrder !== undefined) {
    try { order = JSON.parse(body.imageOrder); } catch { throw new HttpError(400, 'Invalid image order.'); }
  }
  if (!Array.isArray(order) || order.length !== count || new Set(order).size !== count || order.some(key => !keys.includes(key))) throw new HttpError(400, 'Invalid image order.');
  return { existing: existing as string[], order: order as string[] };
}
export async function productImages(body: any, files: File[], current: string[] = []): Promise<string[]> {
  const plan = imagePlan(body, files, current);
  const uploaded = await Promise.all(files.map(file => new Promise<string>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({ folder: 'pj-digitals-estore/products' }, (error, result) => {
      if (error || !result) { reject(error || new Error('Image upload failed.')); return; }
      resolve(result.secure_url);
    });
    stream.end(file.buffer);
  })));
  const urls = new Map([...plan.existing.map(url => [url, url] as const), ...uploaded.map((url, index) => [`new:${index}`, url] as const)]);
  return plan.order.map(key => urls.get(key)!);
}
