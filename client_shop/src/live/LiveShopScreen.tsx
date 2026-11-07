import ShopOrderDetails from './ShopOrderDetails';
import { parseOrders, orderDate, type AccountOrder as Order } from './orderData';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Image, Modal, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ProductImagePicker, { appendProductImages, type ProductImage } from '../components/ProductImagePicker';
import { useUser } from './clerkHooks';
import ShopAccountSettings from './ShopAccountSettings';
import BrandLogo from '../components/BrandLogo';
import RightNavigation from '../components/RightNavigation';
import { useAppTheme } from '../AppearanceContext';
import { ApiError, apiRequest } from '../lib/api';
type Product = {
    _id: string;
    name: string;
    description: string;
    category: string;
    price: number;
    stock: number;
    images: string[];
    sizes: string[];
    __v: number;
};
const categories = ['Electronics', 'Textiles', 'Home Appliances', 'Computer Items', 'Mobile', 'Tablet', 'Laptop', 'Accessories', 'Other'];
const money = (n: number) => '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 2 });
export default function LiveShopScreen({ getToken, logout }: {
    getToken: () => Promise<string | null>;
    logout: () => Promise<void>;
}) {
    const { colors: c, mode, setMode } = useAppTheme();
    const { user } = useUser();
    const ownerName = user?.fullName || user?.username || 'Shop workspace';
    const [section, setSection] = useState('Home'), [products, setProducts] = useState<Product[]>([]), [orders, setOrders] = useState<Order[]>([]), [error, setError] = useState(''), [busy, setBusy] = useState(false), [saving, setSaving] = useState(false), [adding, setAdding] = useState(false), [editing, setEditing] = useState<Product | null>(null), [removing, setRemoving] = useState<Product | null>(null), [stock, setStock] = useState(''), [query, setQuery] = useState('');
    const [fields, setFields] = useState({ name: '', description: '', price: '', stock: '0', category: 'Electronics', sizes: '' }), [images, setImages] = useState<ProductImage[]>([]), [formError, setFormError] = useState('');
    const [updating, setUpdating] = useState<Product | null>(null);
    const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
    const [orderError, setOrderError] = useState('');
    const [imageProduct, setImageProduct] = useState<Product | null>(null);
    const [editImages, setEditImages] = useState<ProductImage[]>([]);
    const locked = useRef(false);
    const mounted = useRef(true);
    const requests = useRef<AbortController | null>(null);
    const requestEnvelope = useCallback(async (path: string, options: RequestInit & { timeoutMs?: number } = {}) => {
        const token = await getToken();
        if (!token) throw Error('Sign in again.');
        const target = '/api' + path;
        try {
            const response = await apiRequest(target, { ...options, headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', ...options.headers } });
            const body = await response.json();
            if (body.success !== true) throw Error(body.message || 'The server did not confirm this change.');
            return body;
        } catch (cause) {
            if (cause instanceof ApiError && cause.status === 403 && target.startsWith('/api/products') && options.method && options.method !== 'GET')
                throw Error('The product API requires an admin account to add, update or delete products. Your server has not granted this account that permission.');
            throw cause;
        }
    }, [getToken]);
    const request = useCallback(async (path: string, options: RequestInit & { timeoutMs?: number } = {}) => (await requestEnvelope(path, options)).data, [requestEnvelope]);
    const load = useCallback(async () => {
        await Promise.resolve();
        if (!mounted.current) return;
        requests.current?.abort();
        const abort = new AbortController(); requests.current = abort; setBusy(true);
        const catalogue = async () => {
            const all: Product[] = [];
            let page = 1;
            while (true) {
                const body = await requestEnvelope(`/products?page=${page}&limit=100`, { signal: abort.signal });
                if (!Array.isArray(body.data)) throw Error('Invalid product list response.');
                all.push(...body.data);
                const pages = body.pagination?.pages;
                if (typeof pages !== 'number' || page >= pages || !body.data.length) break;
                page++;
                if (page > 1000) throw Error('The catalogue is too large. Contact the server developer to add catalogue filtering.');
            }
            return [...new Map(all.map(item => [item._id, { ...item, images: item.images ?? [], sizes: item.sizes ?? [] }])).values()];
        };
        await Promise.allSettled([
            catalogue().then(items => { if (!abort.signal.aborted && mounted.current) { setProducts(items); setError(''); } })
                .catch(cause => { if (!abort.signal.aborted && mounted.current) setError(cause instanceof Error ? cause.message : 'Could not load products.'); }),
            request('/orders', { signal: abort.signal, cache: 'no-store' }).then(data => {
                const items = parseOrders(data);
                if (!abort.signal.aborted && mounted.current) { setOrders(items); setOrderError(''); }
            }).catch(cause => { if (!abort.signal.aborted && mounted.current) setOrderError(cause instanceof Error ? cause.message : 'Could not load orders.'); }),
        ]);
        if (!abort.signal.aborted && mounted.current) setBusy(false);
    }, [request, requestEnvelope]);
    async function openEditor(id: string, mode: 'product' | 'stock' | 'images') {
        if (locked.current) return;
        locked.current = true; setSaving(true); setError(''); setFormError('');
        try {
            const latest = await request(`/products/${encodeURIComponent(id)}`) as Product;
            if (!latest?._id) throw Error('Invalid product response.');
            if (!mounted.current) return;
            const product = { ...latest, images: latest.images ?? [], sizes: latest.sizes ?? [] };
            if (mode === 'product') {
                setUpdating(product);
                setFields({ name: product.name, description: product.description, price: String(product.price), stock: String(product.stock), category: product.category, sizes: product.sizes.join(', ') });
                setImages(product.images.slice(0, 5).map(uri => ({ uri })));
            } else if (mode === 'stock') { setEditing(product); setStock(String(product.stock)); }
            else { setImageProduct(product); setEditImages(product.images.slice(0, 5).map(uri => ({ uri }))); }
        } catch (cause) { if (mounted.current) setError(cause instanceof Error ? cause.message : 'Could not load product details.'); }
        finally { locked.current = false; if (mounted.current) setSaving(false); }
    }
    useEffect(() => { mounted.current = true; const first=setTimeout(()=>void load(),0); const t = setInterval(() => { if (AppState.currentState === 'active' && !locked.current)
        void load(); }, 30000); const sub = AppState.addEventListener('change', s => { if (s === 'active' && !locked.current)
        void load(); }); return () => { mounted.current = false; clearTimeout(first); requests.current?.abort(); clearInterval(t); sub.remove(); }; }, [load]);
    const mutate = async (action: () => Promise<unknown>, done: () => void) => { if (locked.current)
        return; locked.current = true; setSaving(true); setFormError(''); try {
        await action();
        if (mounted.current) {
            done();
            await load();
        }
    }
    catch (e) {
        if (mounted.current)
            setFormError(e instanceof Error ? e.message : 'Change could not be confirmed. Refresh before trying again.');
    }
    finally {
        locked.current = false;
        if (mounted.current)
            setSaving(false);
    } };
    const add = async () => { const price = Number(fields.price), quantity = Number(fields.stock); if (!fields.name.trim() || !fields.description.trim() || !images.length)
        return setFormError('A name, description and at least one product image are required.'); if (!fields.price.trim() || !Number.isFinite(price) || price < 0 || Math.abs(price * 100 - Math.round(price * 100)) > 0.00001)
        return setFormError('Enter a valid price with up to two decimal places.'); if (!fields.stock.trim() || !Number.isSafeInteger(quantity) || quantity < 0)
        return setFormError('Enter a whole-number stock quantity.'); const body = new FormData(); for (const [key, value] of Object.entries(fields))
        body.append(key, key === 'sizes' ? JSON.stringify(value.split(',').map(s => s.trim()).filter(Boolean)) : value.trim()); try { appendProductImages(body, images); } catch (e) { setFormError(e instanceof Error ? e.message : 'Choose the images again.'); return; } await mutate(() => request(updating ? `/products/${encodeURIComponent(updating._id)}` : '/products', { method: updating ? 'PUT' : 'POST', body, timeoutMs: 45000 }), () => { setAdding(false); setUpdating(null); setFields({ name: '', description: '', price: '', stock: '0', category: 'Electronics', sizes: '' }); setImages([]); }); };
    const card = { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 16, padding: 18, gap: 12, marginBottom: 14 };
    const text = { color: c.text, fontSize: 15 };
    const small = { color: c.muted, fontSize: 12, lineHeight: 20 };
    const input = (label: string, value: string, onChange: (s: string) => void, numeric = false) => <View style={{ gap: 6 }}><Text style={small}>{label}</Text><TextInput accessibilityLabel={label} editable={!saving} value={value} onChangeText={onChange} keyboardType={numeric ? 'decimal-pad' : 'default'} style={{ minHeight: 46, padding: 12, borderWidth: 1, borderColor: c.border, borderRadius: 10, color: c.text, backgroundColor: c.bg }}/></View>;
    const productList = products.filter(p => `${p.name} ${p.category}`.toLowerCase().includes(query.trim().toLowerCase()));
    return <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}><ScrollView contentContainerStyle={{ width: '100%', maxWidth: 1100, alignSelf: 'center', padding: 20, paddingBottom: 40 }} refreshControl={<RefreshControl refreshing={busy} onRefresh={() => void load()}/>} keyboardShouldPersistTaps="handled">
 <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', paddingRight: 60, marginBottom: 22 }}><BrandLogo size={48}/><View style={{ flex: 1 }}><Text style={{ ...text, fontSize: 21, fontWeight: '800' }}>NearBy Shop</Text><Text style={small}>{ownerName}</Text></View></View>
 <Text style={{ color: c.primaryText, fontSize: 11, fontWeight: '800', marginBottom: 10 }}>LIVE CATALOGUE · SERVER RECORDS</Text><Text style={{ ...text, fontSize: 27, fontWeight: '800', marginBottom: 20 }}>{section}</Text>
 {error ? <View style={card}><Text accessibilityRole="alert" style={{ color: c.red }}>{error}</Text>{<LiveButton label={'Retry loading'} onPress={() => void load()} disabled={saving} secondary={true}/>}</View> : null}
 {section === 'Home' ? <><View style={card}><Text style={text}>{products.length} catalogue products</Text><Text style={small}>Shared product API · Add, update and delete require server admin access.</Text><Text style={text}>{orderError ? 'Orders unavailable' : `${orders.length} orders for this account`}</Text><Text style={text}>{orderError ? 'Order value unavailable' : `${money(orders.filter(o => o.paymentStatus === 'paid').reduce((n, o) => n + o.totalAmount, 0))} paid account order value`}</Text><Text style={small}>Orders belong to the signed-in account. These user-order routes do not list every customer purchase from your shop. Totals include the charges returned by the server.</Text></View>{<LiveButton label={'Add product'} onPress={() => { setFormError(''); setUpdating(null); setFields({ name: '', description: '', price: '', stock: '0', category: 'Electronics', sizes: '' }); setImages([]); setAdding(true); }} disabled={saving}/>}<View style={{ height: 12 }}/>{<LiveButton label={'Update stock'} onPress={() => setSection('Products')} disabled={saving} secondary={true}/>}</> : null}
 {section === 'Products' ? <>{<LiveButton label={'Add product'} onPress={() => { setFormError(''); setUpdating(null); setFields({ name: '', description: '', price: '', stock: '0', category: 'Electronics', sizes: '' }); setImages([]); setAdding(true); }} disabled={saving}/>}<View style={{ height: 12 }}/>{input('Search products', query, setQuery)}<View style={{ height: 12 }}/>{productList.map(p => <View key={p._id} style={card}><View style={{ flexDirection: 'row', gap: 14 }}>{p.images[0] ? <Image source={{ uri: p.images[0] }} style={{ width: 72, height: 72, borderRadius: 12 }}/> : null}<View style={{ flex: 1, gap: 6 }}><Text style={{ ...text, fontWeight: '700' }}>{p.name}</Text><Text style={small}>{p.category} · {money(p.price)}</Text><Text style={text}>{p.stock} in stock</Text></View></View>{<LiveButton label={'View / edit product'} onPress={() => void openEditor(p._id, 'product')} disabled={saving} secondary={true}/>}{<LiveButton label={`Edit product images (${p.images.length} / 5)`} onPress={() => { void openEditor(p._id, 'images'); }} disabled={saving} secondary={true}/>}{<LiveButton label={'Edit stock'} onPress={() => { void openEditor(p._id, 'stock'); }} disabled={saving} secondary={true}/>}{<LiveButton label={'Remove product'} onPress={() => { setRemoving(p); setFormError(''); }} disabled={saving} secondary={true}/>}</View>)}{!productList.length && !busy && !error ? <Text style={small}>No products yet. Add the shop’s first product.</Text> : null}</> : null}
 {section === 'Orders' ? <><Text style={{...small,marginBottom:14}}>Orders for the signed-in account · Read-only</Text>{orderError ? <View style={{gap:10,marginBottom:14}}><Text accessibilityRole="alert" style={{color:c.red}}>{orderError}</Text><LiveButton label="Retry orders" disabled={busy} onPress={() => void load()} secondary /></View> : null}{orders.map(o => <View key={o._id} style={card}><Text style={{ ...text, fontWeight: '800' }}>{o.orderNumber}</Text><Text style={text}>{o.customer} · {money(o.totalAmount)}</Text><Text style={{ color: c.primaryText }}>{o.orderStatus} · Payment: {o.paymentStatus}</Text>{o.items.map((i, n) => <Text key={n} style={small}>{i.name} × {i.quantity}{i.size ? ' · '+i.size : ''}</Text>)}<Text style={small}>{orderDate(o.createdAt)}</Text><LiveButton label="View order details" onPress={() => setSelectedOrderId(o._id)} secondary /></View>)}{!orders.length && !busy ? <Text style={small}>{orderError ? 'Orders could not be loaded.' : 'No orders found for this signed-in account.'}</Text> : null}</> : null}
 {section === 'Profile' ? <ShopAccountSettings /> : null}
 {busy ? <ActivityIndicator color={c.primary}/> : null}
 </ScrollView><RightNavigation title="NearBy Shop" subtitle={ownerName} brand={<BrandLogo size={48}/>} mode={mode} onModeChange={setMode} active={section} colors={{ glass: c.glass, text: c.text, muted: c.muted, accent: c.accent, border: c.border, selected: c.primary, selectedText: c.onPrimary, warning: c.red }} items={['Home', 'Products', 'Orders', 'Profile'].map(id => ({ id, label: id, icon: id === 'Home' ? '⌂' : '◈' }))} onSelect={setSection} onLogout={() => { void logout().catch(() => setError('Could not sign out. Try again.')); }}/>
 {selectedOrderId ? <ShopOrderDetails key={selectedOrderId} id={selectedOrderId} request={request} onClose={() => setSelectedOrderId(null)} /> : null}
 <Modal visible={adding || !!updating || !!imageProduct || !!editing || !!removing} transparent animationType="fade" onRequestClose={() => { if (!saving) {
        setAdding(false);
        setUpdating(null);
        setImageProduct(null);
        setEditing(null);
        setRemoving(null);
    } }}><View style={{ flex: 1, backgroundColor: 'rgba(10,15,30,0.5)', justifyContent: 'center', padding: 20 }}><ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }} keyboardShouldPersistTaps="handled"><View style={{ ...card, width: '100%', maxWidth: 520, alignSelf: 'center' }}><Text style={{ ...text, fontSize: 22, fontWeight: '800' }}>{adding ? 'Add product' : updating ? 'Edit product' : imageProduct ? 'Edit product images' : editing ? 'Update stock' : 'Remove product?'}</Text>
 {adding || updating ? <>{input('Product name', fields.name, v => setFields({ ...fields, name: v }))}{input('Description', fields.description, v => setFields({ ...fields, description: v }))}{input('Price in rupees', fields.price, v => setFields({ ...fields, price: v }), true)}{input('Starting stock', fields.stock, v => setFields({ ...fields, stock: v }), true)}<Text style={small}>Category</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{categories.map(category => <Pressable key={category} onPress={() => setFields({ ...fields, category })} style={{ padding: 10, borderRadius: 10, backgroundColor: fields.category === category ? c.primary : c.soft }}><Text style={{ color: fields.category === category ? c.onPrimary : c.text }}>{category}</Text></Pressable>)}</View>{input('Sizes, separated by commas (optional)', fields.sizes, v => setFields({ ...fields, sizes: v }))}<ProductImagePicker images={images} onChange={setImages} disabled={saving} />{<LiveButton label={saving ? 'Saving…' : updating ? 'Save product changes' : 'Save and publish product'} onPress={() => void add()} disabled={saving}/>}</> : imageProduct ? <><Text style={text}>{imageProduct.name}</Text><ProductImagePicker images={editImages} onChange={setEditImages} disabled={saving}/><LiveButton label={saving ? 'Saving…' : 'Save product images'} disabled={saving} onPress={() => { const body = new FormData(); body.append('version',String(imageProduct.__v)); try { appendProductImages(body,editImages); } catch(e) { setFormError(e instanceof Error ? e.message : 'Choose the images again.'); return; } void mutate(() => request('/products/'+encodeURIComponent(imageProduct._id),{method:'PUT',body,timeoutMs:45000}), () => setImageProduct(null)); }}/></> : editing ? <><Text style={text}>{editing.name}</Text>{input('Stock quantity', stock, setStock, true)}{<LiveButton label={saving ? 'Saving…' : 'Save stock'} onPress={() => { const n = Number(stock); if (!stock.trim() || !Number.isSafeInteger(n) || n < 0)
        return setFormError('Enter a whole number of zero or more.'); void mutate(() => request(`/products/${encodeURIComponent(editing._id)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stock: n, version: editing.__v }) }), () => setEditing(null)); }} disabled={saving}/>}</> : <><Text style={small}>{removing?.name} will be deleted from the catalogue by the server. This cannot be undone here.</Text>{<LiveButton label={'Confirm removal'} onPress={() => void mutate(() => request(`/products/${encodeURIComponent(removing!._id)}`, { method: 'DELETE' }), () => setRemoving(null))} disabled={saving}/>}</>}
 {formError ? <Text accessibilityRole="alert" style={{ color: c.red, lineHeight: 21 }}>{formError}</Text> : null}{<LiveButton label={'Close'} onPress={() => { setAdding(false); setUpdating(null); setImageProduct(null); setEditing(null); setRemoving(null); }} disabled={saving} secondary={true}/>}</View></ScrollView></View></Modal></SafeAreaView>;
}

function LiveButton({label,onPress,disabled,secondary=false}:{label:string;onPress:()=>void;disabled?:boolean;secondary?:boolean}){const {colors:c}=useAppTheme();return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={{minHeight:44,borderRadius:10,padding:12,justifyContent:'center',alignItems:'center',backgroundColor:secondary?c.soft:c.primary,opacity:disabled?0.6:1}}><Text style={{color:secondary?c.primaryText:c.onPrimary,fontWeight:'700'}}>{label}</Text></Pressable>;}
