import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useAppTheme } from '../AppearanceContext';
import ProductImagePicker, { appendProductImages, type ProductImage } from './ProductImagePicker';
import type { AdminProduct, AdminProductsApi } from '../services/adminProducts';

export type ProductMode = 'view' | 'edit' | 'create' | 'delete';
const categories = ['Electronics', 'Textiles', 'Home Appliances', 'Computer Items', 'Mobile', 'Tablet', 'Laptop', 'Accessories', 'Other'];
type Fields = { name: string; description: string; price: string; stock: string; category: string; sizes: string; shopId: string };

export default function AdminProductModal({ api, id, mode, onClose, onEdit, onSaved, onDeleted }: { api: AdminProductsApi; id?: string; mode: ProductMode; onClose: () => void; onEdit: (id: string) => void; onSaved: (product: AdminProduct) => void; onDeleted: () => void }) {
  const { colors: c } = useAppTheme();
  const [product, setProduct] = useState<AdminProduct | null>(null);
  const [loading, setLoading] = useState(mode !== 'create');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [photo, setPhoto] = useState(0);
  const mounted = useRef(true);
  const locked = useRef(false);
  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();
    const initial = id ? setTimeout(async () => {
      setLoading(true); setError('');
      try { const value = await api.get(id, controller.signal); if (!controller.signal.aborted) setProduct(value); }
      catch (cause) { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Unable to load this product.'); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }, 0) : undefined;
    return () => { mounted.current = false; if (initial) clearTimeout(initial); controller.abort(); };
  }, [api, id, attempt]);
  async function remove() {
    if (!product || locked.current) return;
    locked.current = true; setSaving(true); setError('');
    try { await api.remove(product._id); if (mounted.current) onDeleted(); }
    catch (cause) { if (mounted.current) setError(cause instanceof Error ? cause.message : 'Deletion was not confirmed. Refresh before retrying.'); }
    finally { locked.current = false; if (mounted.current) setSaving(false); }
  }
  const copy = { color: c.muted, fontSize: 13, lineHeight: 21 };
  return <Modal visible transparent animationType="fade" onRequestClose={() => { if (!saving) onClose(); }}><View style={{ flex: 1, justifyContent: 'center', padding: 20, backgroundColor: 'rgba(10,15,30,0.5)' }}><View accessibilityViewIsModal style={{ width: '100%', maxWidth: 640, maxHeight: '100%', alignSelf: 'center', borderRadius: 20, backgroundColor: c.surface, padding: 22, borderWidth: 1, borderColor: c.border }}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}><Text style={{ color: c.text, fontSize: 22, fontWeight: '800' }}>{mode === 'create' ? 'Add product' : mode === 'edit' ? 'Edit product' : mode === 'delete' ? 'Delete product?' : 'Product details'}</Text><Pressable accessibilityRole="button" disabled={saving} onPress={onClose} style={{ padding: 12 }}><Text style={{ color: c.primaryText }}>Close</Text></Pressable></View>
      {loading ? <ActivityIndicator color={c.primary} /> : error && !product && mode !== 'create' ? <><Text accessibilityRole="alert" style={{ color: c.red }}>{error}</Text><ProductAction label="Retry product" onPress={() => setAttempt(value => value + 1)} /></> : mode === 'create' || (mode === 'edit' && product) ? <ProductEditor product={product} api={api} onSaved={onSaved} onBusy={setSaving} /> : product ? <>
        <Text style={{ color: c.text, fontSize: 19, fontWeight: '700' }}>{product.name}</Text>
        {mode === 'delete' ? <>
          <Text style={copy}>Delete this product from the catalogue? The supplied delete route also removes its stored images. This action cannot be undone here.</Text><Text style={copy}>₹{product.price.toLocaleString('en-IN')} · {product.stock} units · {product.category}</Text>
          {error ? <Text accessibilityRole="alert" style={{ color: c.red }}>{error}</Text> : null}
          <ProductAction label={saving ? 'Deleting…' : 'Confirm product deletion'} disabled={saving} danger onPress={() => void remove()} /><ProductAction label="Cancel" disabled={saving} onPress={onClose} />
        </> : <>
          {product.images[photo] ? <Image source={{ uri: product.images[photo] }} accessibilityLabel={product.name} resizeMode="contain" style={{ height: 230, width: '100%', borderRadius: 16, backgroundColor: '#FFFFFF' }} /> : <Text style={copy}>No product image supplied.</Text>}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{product.images.map((uri, index) => <Pressable key={uri} accessibilityRole="button" accessibilityLabel={`View product image ${index + 1}`} accessibilityState={{ selected: photo === index }} onPress={() => setPhoto(index)} style={{ padding: 4, borderWidth: 2, borderColor: photo === index ? c.primary : c.border, borderRadius: 12 }}><Image source={{ uri }} resizeMode="contain" style={{ width: 64, height: 64, backgroundColor: '#FFFFFF', borderRadius: 8 }} /></Pressable>)}</View>
          <Text style={{ color: c.primaryText, fontSize: 23, fontWeight: '800' }}>₹{product.price.toLocaleString('en-IN')}</Text><Text style={copy}>{product.category} · {product.stock} in stock</Text><Text style={copy}>{product.description || 'No description supplied.'}</Text>
          {product.sizes.length ? <Text style={copy}>Sizes: {product.sizes.join(', ')}</Text> : null}<Text style={copy}>Shop: {product.shopName || product.shopId || 'Not linked to a shop'}</Text>
          <ProductAction label="Edit product and images" onPress={() => onEdit(product._id)} />
        </>}
      </> : null}
    </ScrollView>
  </View></View></Modal>;
}

function ProductEditor({ product, api, onSaved, onBusy }: { product: AdminProduct | null; api: AdminProductsApi; onSaved: (product: AdminProduct) => void; onBusy: (busy: boolean) => void }) {
  const { colors: c } = useAppTheme();
  const [fields, setFields] = useState<Fields>(() => ({ name: product?.name ?? '', description: product?.description ?? '', price: product ? String(product.price) : '', stock: product ? String(product.stock) : '0', category: product?.category || 'Electronics', sizes: product?.sizes.join(', ') ?? '', shopId: product?.shopId ?? '' }));
  const [images, setImages] = useState<ProductImage[]>(() => product?.images.map(uri => ({ uri })) ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const locked = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  async function save() {
    if (locked.current) return;
    const price = Number(fields.price), stock = Number(fields.stock);
    if (!fields.name.trim() || !fields.description.trim() || !fields.category.trim()) { setError('Enter a product name, description and category.'); return; }
    if (!fields.price.trim() || !Number.isFinite(price) || price < 0 || Math.abs(price * 100 - Math.round(price * 100)) > 0.00001) { setError('Enter a valid price with up to two decimal places.'); return; }
    if (!fields.stock.trim() || !Number.isSafeInteger(stock) || stock < 0) { setError('Stock must be a whole number of zero or more.'); return; }
    const shop = fields.shopId.trim();
    if ((shop && !/^[a-f\d]{24}$/i.test(shop)) || (product?.shopId && !shop)) { setError('Keep the existing shop link or enter a valid 24-character shop ID.'); return; }
    if (!images.length || images.length > 5) { setError('Choose between one and five product images.'); return; }
    const sizes = [...new Set(fields.sizes.split(',').map(value => value.trim()).filter(Boolean))];
    const body = new FormData();
    // Preserve stock and other fields that were not changed while the editor was open.
    const changes: Record<string, string> = {};
    if (!product || fields.name.trim() !== product.name) changes.name = fields.name.trim();
    if (!product || fields.description.trim() !== product.description) changes.description = fields.description.trim();
    if (!product || fields.category !== product.category) changes.category = fields.category;
    if (!product || price !== product.price) changes.price = String(price);
    if (!product || stock !== product.stock) changes.stock = String(stock);
    if (!product || JSON.stringify(sizes) !== JSON.stringify(product.sizes)) changes.sizes = JSON.stringify(sizes);
    if (shop && (!product || shop !== product.shopId)) changes.shop = shop;
    for (const [name, value] of Object.entries(changes)) body.append(name, value);
    const changingImages = !product || images.some(image => !!image.asset) || JSON.stringify(images.map(image => image.uri)) !== JSON.stringify(product.images);
    try { if (changingImages) appendProductImages(body, images); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Choose the photos again.'); return; }
    if (product?.version !== undefined) body.append('version', String(product.version));
    locked.current = true; setBusy(true); onBusy(true); setError('');
    try { const saved = product ? await api.update(product._id, body) : await api.create(body); if (mounted.current) onSaved(saved); }
    catch (cause) { if (mounted.current) setError((cause instanceof Error ? cause.message : 'Product save was not confirmed.') + (!product ? ' Check the catalogue before retrying if the request may have reached the server.' : '')); }
    finally { locked.current = false; if (mounted.current) { setBusy(false); onBusy(false); } }
  }
  const labels: Record<keyof Fields, string> = { name: 'Product name', description: 'Description', price: 'Price (₹)', stock: 'Stock quantity', category: 'Category', sizes: 'Sizes, separated by commas (optional)', shopId: 'Shop ID (optional for new products)' };
  return <View style={{ gap: 14 }}>
    {(['name', 'description', 'price', 'stock', 'sizes', 'shopId'] as const).map(field => <View key={field} style={{ gap: 6 }}><Text style={{ color: c.muted, fontSize: 12 }}>{labels[field]}</Text><TextInput accessibilityLabel={labels[field]} editable={!busy} value={fields[field]} onChangeText={value => setFields(current => ({ ...current, [field]: value }))} multiline={field === 'description'} autoCapitalize={field === 'shopId' ? 'none' : 'sentences'} keyboardType={field === 'price' ? 'decimal-pad' : field === 'stock' ? 'number-pad' : 'default'} style={{ color: c.text, backgroundColor: c.bg, padding: 12, minHeight: field === 'description' ? 90 : 46, borderWidth: 1, borderColor: c.border, borderRadius: 12 }} /></View>)}
    <Text style={{ color: c.muted, fontSize: 12, lineHeight: 20 }}>The shop link controls shop-specific browsing and may be required by your checkout API. Use the shop ID supplied by the backend.</Text>
    <Text style={{ color: c.text, fontWeight: '700' }}>Category</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{[...new Set([...categories, fields.category])].map(category => <Pressable key={category} accessibilityRole="radio" accessibilityState={{ checked: fields.category === category, disabled: busy }} disabled={busy} onPress={() => setFields(current => ({ ...current, category }))} style={{ padding: 12, borderRadius: 12, backgroundColor: fields.category === category ? c.primary : c.soft }}><Text style={{ color: fields.category === category ? c.onPrimary : c.text }}>{category}</Text></Pressable>)}</View>
    <ProductImagePicker images={images} onChange={setImages} disabled={busy} />
    {error ? <Text accessibilityRole="alert" style={{ color: c.red }}>{error}</Text> : null}
    <ProductAction label={busy ? 'Saving…' : product ? 'Save product changes' : 'Create product'} disabled={busy} onPress={() => void save()} />
  </View>;
}

export function ProductAction({ label, onPress, disabled = false, danger = false }: { label: string; onPress: () => void; disabled?: boolean; danger?: boolean }) {
  const { colors: c } = useAppTheme();
  return <Pressable accessibilityRole="button" disabled={disabled} accessibilityState={{ disabled }} onPress={onPress} style={{ minHeight: 44, padding: 12, borderRadius: 12, backgroundColor: c.soft, justifyContent: 'center', opacity: disabled ? 0.45 : 1 }}><Text style={{ color: danger ? c.red : c.primaryText, fontWeight: '700', textAlign: 'center' }}>{label}</Text></Pressable>;
}
