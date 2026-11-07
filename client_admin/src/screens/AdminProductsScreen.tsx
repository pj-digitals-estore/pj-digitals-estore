import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Image, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '../AppearanceContext';
import { useAdminAccess } from '../auth/AdminAccessContext';
import BrandLogo from '../components/BrandLogo';
import RightNavigation from '../components/RightNavigation';
import AdminProductModal, { ProductAction, type ProductMode } from '../components/AdminProductModal';
import { createAdminProductsApi, type AdminProduct } from '../services/adminProducts';

export default function AdminProductsScreen({ onNavigate, onChanged }: { onNavigate: (section: string) => void; onChanged: () => void }) {
  const { colors: c, mode, setMode } = useAppTheme();
  const { getToken, signOut } = useAdminAccess();
  const token = useCallback(() => getToken ? getToken() : Promise.resolve(null), [getToken]);
  const api = useMemo(() => createAdminProductsApi(token), [token]);
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ pages: 1, total: 0 });
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ mode: ProductMode; id?: string } | null>(null);
  const current = useRef<AbortController | null>(null);
  const load = useCallback(async () => {
    current.current?.abort();
    const controller = new AbortController(); current.current = controller;
    setLoading(true); setError('');
    try {
      const result = await api.list(page, controller.signal);
      if (!controller.signal.aborted) {
        const last = Math.max(1, result.pages);
        if (page > last) { setPage(last); setProducts([]); }
        else { setProducts(result.products); setPagination({ pages: last, total: result.total }); }
      }
    } catch (cause) { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Unable to load products.'); }
    finally { if (!controller.signal.aborted) setLoading(false); }
  }, [api, page]);
  useEffect(() => {
    const initial = setTimeout(() => void load(), 0);
    const timer = setInterval(() => { if (AppState.currentState === 'active') void load(); }, 30000);
    const listener = AppState.addEventListener('change', state => { if (state === 'active') void load(); });
    return () => { clearTimeout(initial); clearInterval(timer); listener.remove(); current.current?.abort(); };
  }, [load]);
  const visible = products.filter(product => `${product.name} ${product.category} ${product.shopName}`.toLowerCase().includes(query.trim().toLowerCase()));
  const card = { borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, borderRadius: 18, padding: 18, gap: 12, marginBottom: 16 };
  const copy = { color: c.muted, fontSize: 12, lineHeight: 20 };
  return <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}><ScrollView contentContainerStyle={{ width: '100%', maxWidth: 1100, alignSelf: 'center', padding: 20, paddingBottom: 40 }} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}>
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingRight: 60, gap: 12, marginBottom: 22 }}><BrandLogo size={50} /><View><Text style={{ color: c.text, fontSize: 23, fontWeight: '800' }}>NearBy Admin</Text><Text style={copy}>Live catalogue management</Text></View></View>
    <Text style={{ color: c.text, fontSize: 28, fontWeight: '800', marginBottom: 16 }}>Products</Text>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 14, marginBottom: 16 }}><ProductAction label="Add product" onPress={() => setModal({ mode: 'create' })} /><Text style={copy}>{pagination.total} products · Page {page} of {pagination.pages}</Text></View>
    <TextInput accessibilityLabel="Search this product page" value={query} onChangeText={setQuery} placeholder="Search this page by product, category or shop" placeholderTextColor={c.muted} style={{ minHeight: 48, padding: 14, backgroundColor: c.surface, color: c.text, borderWidth: 1, borderColor: c.border, borderRadius: 12, marginBottom: 16 }} />
    {notice ? <Text accessibilityLiveRegion="polite" style={{ ...copy, color: c.primaryText, marginBottom: 16 }}>{notice}</Text> : null}
    {error ? <View style={card}><Text accessibilityRole="alert" style={{ color: c.red }}>{error}</Text><ProductAction label="Retry products" disabled={loading} onPress={() => void load()} /></View> : null}
    {loading ? <ActivityIndicator color={c.primary} style={{ marginBottom: 16 }} /> : null}
    {visible.map(product => <View key={product._id} style={card}>
      <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>{product.images[0] ? <Image source={{ uri: product.images[0] }} resizeMode="contain" style={{ width: 76, height: 76, borderRadius: 12, backgroundColor: '#FFFFFF' }} /> : null}<View style={{ flex: 1, gap: 6 }}><Text style={{ color: c.text, fontSize: 18, fontWeight: '700' }}>{product.name}</Text><Text style={copy}>{product.category} · {product.stock} in stock</Text><Text style={{ color: c.primaryText, fontWeight: '800' }}>₹{product.price.toLocaleString('en-IN')}</Text><Text style={copy}>{product.shopName || (product.shopId ? 'Linked to a shop' : 'Not linked to a shop')}</Text></View></View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}><ProductAction label="View details" onPress={() => setModal({ mode: 'view', id: product._id })} /><ProductAction label="Edit product / images" onPress={() => setModal({ mode: 'edit', id: product._id })} /><ProductAction label="Delete" danger onPress={() => setModal({ mode: 'delete', id: product._id })} /></View>
    </View>)}
    {!loading && !error && !visible.length ? <Text style={copy}>{products.length ? 'No products match this page search.' : 'No products found. Add your first product.'}</Text> : null}
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginVertical: 16 }}><ProductAction label="Previous page" disabled={loading || page <= 1} onPress={() => { setProducts([]); setPage(value => value - 1); }} /><ProductAction label="Next page" disabled={loading || page >= pagination.pages} onPress={() => { setProducts([]); setPage(value => value + 1); }} /></View>
  </ScrollView><RightNavigation title="NearBy Admin" subtitle="Catalogue operations" brand={<BrandLogo size={48} />} mode={mode} onModeChange={setMode} active="Products" items={['Overview', 'Insights', 'Orders', 'Products', 'Access & permissions'].map(id => ({ id, label: id }))} colors={{ glass: c.glass, text: c.text, muted: c.muted, accent: c.accent, border: c.border, selected: c.primary, selectedText: c.onPrimary, warning: c.red }} onSelect={onNavigate} onLogout={() => { void signOut().catch(() => setError('Unable to sign out. Please try again.')); }} />
    {modal ? <AdminProductModal key={`${modal.mode}:${modal.id || 'new'}`} api={api} mode={modal.mode} id={modal.id} onClose={() => setModal(null)} onEdit={id => setModal({ mode: 'edit', id })} onSaved={product => { setNotice(`${product.name}: saved by the server.`); setModal(null); void load(); onChanged(); }} onDeleted={() => { setNotice('Product deletion confirmed by the server.'); setModal(null); void load(); onChanged(); }} /> : null}
  </SafeAreaView>;
}
