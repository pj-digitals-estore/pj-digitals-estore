import { apiRequest } from '../lib/api';

export type AdminProduct = { _id: string; name: string; description: string; price: number; stock: number; category: string; images: string[]; sizes: string[]; shopId: string; shopName: string; version?: number };
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown) => typeof value === 'string' ? value : '';
export function parseProduct(value: unknown): AdminProduct {
  if (!record(value) || !text(value._id) || !text(value.name) || typeof value.price !== 'number' || !Number.isFinite(value.price) || value.price < 0 || typeof value.stock !== 'number' || !Number.isSafeInteger(value.stock) || value.stock < 0) throw Error('The server returned an invalid product.');
  if (!Array.isArray(value.images) || !value.images.every(image => typeof image === 'string')) throw Error('The server returned invalid product images.');
  return {
    _id: text(value._id), name: text(value.name), description: text(value.description), price: value.price, stock: value.stock, category: text(value.category),
    images: [...new Set(value.images)], sizes: Array.isArray(value.sizes) ? value.sizes.filter((size): size is string => typeof size === 'string') : [],
    shopId: record(value.shop) ? text(value.shop._id) : text(value.shop), shopName: record(value.shop) ? text(value.shop.name) : '',
    version: typeof value.__v === 'number' && Number.isSafeInteger(value.__v) ? value.__v : undefined,
  };
}
export function createAdminProductsApi(getToken: () => Promise<string | null>) {
  async function request(path: string, options: RequestInit & { timeoutMs?: number } = {}) {
    const token = await getToken();
    if (!token) throw Error('Verified admin sign-in is required.');
    // Let fetch set the multipart boundary; never force application/json on images.
    const response = await apiRequest(path, { ...options, cache: 'no-store', headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', ...options.headers } });
    const body = await response.json();
    if (body?.success !== true) throw Error(typeof body?.message === 'string' ? body.message : 'Product request was not confirmed.');
    return body;
  }
  async function list(page = 1, signal?: AbortSignal) {
    const body = await request(`/api/products?page=${page}&limit=20`, { signal });
    if (!Array.isArray(body.data)) throw Error('Invalid product list response.');
    const products = [...new Map(body.data.map((item: unknown) => { const product = parseProduct(item); return [product._id, product] as const; })).values()] as AdminProduct[];
    const total = body.pagination?.total ?? products.length, pages = body.pagination?.pages ?? 1;
    if (!Number.isSafeInteger(total) || total < 0 || !Number.isSafeInteger(pages) || pages < 0) throw Error('Invalid product pagination response.');
    return { products, total: total as number, pages: pages as number, paginationKnown: typeof body.pagination?.pages === 'number' && typeof body.pagination?.total === 'number' };
  }
  async function get(id: string, signal?: AbortSignal) {
    if (!id) throw Error('A product ID is required.');
    const product = parseProduct((await request(`/api/products/${encodeURIComponent(id)}`, { signal })).data);
    if (product._id !== id) throw Error('The server returned a different product.');
    return product;
  }
  async function create(body: FormData) {
    return parseProduct((await request('/api/products', { method: 'POST', body, timeoutMs: 45000 })).data);
  }
  async function update(id: string, body: FormData) {
    const product = parseProduct((await request(`/api/products/${encodeURIComponent(id)}`, { method: 'PUT', body, timeoutMs: 45000 })).data);
    if (product._id !== id) throw Error('The server returned a different product. Refresh before trying again.');
    return product;
  }
  async function remove(id: string) { await request(`/api/products/${encodeURIComponent(id)}`, { method: 'DELETE', timeoutMs: 30000 }); }
  return { list, get, create, update, remove };
}
export type AdminProductsApi = ReturnType<typeof createAdminProductsApi>;
