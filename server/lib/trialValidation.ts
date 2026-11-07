export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export function quantity(value: unknown, allowZero = false): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < (allowZero ? 0 : 1) || value > 100000) throw new HttpError(400, 'Enter a valid whole-number quantity.');
  return value;
}
export function paise(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 10000000 || Math.abs(value * 100 - Math.round(value * 100)) > 0.00001) throw new HttpError(400, 'Enter a valid price with at most two decimal places.');
  return Math.round(value * 100);
}
export const categories = ['Mobile', 'Tablet', 'Laptop', 'Accessories', 'Electronics', 'Textiles', 'Home Appliances', 'Computer Items', 'Other'] as const;
export function shippingAddress(value: any) {
  if (!value || typeof value !== 'object') throw new HttpError(400, 'A delivery address is required.');
  const result: Record<string, string> = {};
  for (const field of ['name', 'phone', 'street', 'city', 'state', 'zipCode', 'country']) {
    if (typeof value[field] !== 'string' || !value[field].trim() || value[field].length > 300) throw new HttpError(400, `Invalid address ${field}.`);
    result[field] = value[field].trim();
  }
  if (!/^\d{10}$/.test(result.phone) || !/^\d{6}$/.test(result.zipCode)) throw new HttpError(400, 'A 10-digit phone and 6-digit PIN code are required.');
  if (!['Thodupuzha', 'Muttom'].includes(result.city) || result.state !== 'Kerala' || result.country !== 'India') throw new HttpError(400, 'Delivery is available in Thodupuzha and Muttom, Kerala only.');
  return result;
}
