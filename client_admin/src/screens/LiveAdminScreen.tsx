import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Modal, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAdminAccess } from '../auth/AdminAccessContext';
import { useAppTheme } from '../AppearanceContext';
import BrandLogo from '../components/BrandLogo';
import AccessManagement from '../components/AccessManagement';
import RightNavigation from '../components/RightNavigation';
import CreateCartOrder from '../components/CreateCartOrder';
import AdminOrderDetails from '../components/AdminOrderDetails';
import AdminInsightsScreen from './AdminInsightsScreen';
import AdminProductsScreen from './AdminProductsScreen';
import { createAdminOrdersApi } from '../services/adminOrders';
import { orderDate, type AccountOrder } from '../services/orderData';

const money = (value: number) => '₹' + value.toLocaleString('en-IN', { maximumFractionDigits: 2 });
const nextStatus: Record<string, string> = { placed: 'processing', processing: 'shipping', shipping: 'delivered' };
const statuses = ['', 'awaiting_payment', 'placed', 'processing', 'shipping', 'delivered', 'cancelled'];
export default function LiveAdminScreen() {
  const { getToken, signOut } = useAdminAccess();
  const { colors: c, mode, setMode } = useAppTheme();
  const token = useCallback(() => getToken ? getToken() : Promise.resolve(null), [getToken]);
  const api = useMemo(() => createAdminOrdersApi(token), [token]);
  const [section, setSection] = useState('Orders');
  const [scope, setScope] = useState<'all' | 'mine'>('all');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ pages: 1, total: 0 });
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [orders, setOrders] = useState<AccountOrder[]>([]);
  const [stats, setStats] = useState<{ totalOrders: number; totalProducts: number; totalRevenue: number } | null>(null);
  const [statsError, setStatsError] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(true);
  const [statusError, setStatusError] = useState('');
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [transition, setTransition] = useState<{ order: AccountOrder; next: string } | null>(null);
  const request = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const locked = useRef(false);
  const load = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    setBusy(true); setError('');
    await Promise.allSettled([
      api.list(scope, page, scope === 'all' ? status : '', controller.signal).then(result => {
        if (!controller.signal.aborted) { setOrders(result.orders); setPagination({ pages: result.pages, total: result.total }); }
      }).catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Unable to load orders.'); }),
      api.stats(controller.signal).then(value => { if (!controller.signal.aborted) { setStats(value); setStatsError(''); } })
        .catch(cause => { if (!controller.signal.aborted) setStatsError(cause instanceof Error ? cause.message : 'Statistics unavailable.'); }),
    ]);
    if (!controller.signal.aborted) setBusy(false);
  }, [api, scope, page, status]);
  useEffect(() => {
    mounted.current = true;
    if (section === 'Insights' || section === 'Products') return () => { mounted.current = false; request.current?.abort(); };
    const initial = setTimeout(() => void load(), 0);
    const timer = setInterval(() => { if (AppState.currentState === 'active' && !locked.current) void load(); }, 15000);
    const listener = AppState.addEventListener('change', state => { if (state === 'active' && !locked.current) void load(); });
    return () => { mounted.current = false; clearTimeout(initial); clearInterval(timer); listener.remove(); request.current?.abort(); };
  }, [load, section]);
  async function advance() {
    if (!transition || locked.current) return;
    locked.current = true; setSaving(true); setStatusError('');
    try {
      const result = await api.updateStatus(transition.order._id, transition.next);
      if (!mounted.current) return;
      setNotice(`${result.orderNumber}: server confirmed ${result.orderStatus}.`); setTransition(null); await load();
    } catch (cause) { if (mounted.current) setStatusError(cause instanceof Error ? cause.message : 'Status update not confirmed.'); }
    finally { locked.current = false; if (mounted.current) setSaving(false); }
  }
  const card = { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 16, padding: 20, gap: 12, marginBottom: 16 };
  const copy = { color: c.text, fontSize: 14, lineHeight: 22 };
  const small = { color: c.muted, fontSize: 12, lineHeight: 20 };
  const visible = orders.filter(order => (!status || scope === 'all' || order.orderStatus === status) && `${order.orderNumber} ${order.customer} ${order._id}`.toLowerCase().includes(search.toLowerCase().trim()));
  if (section === 'Insights') return <AdminInsightsScreen onNavigate={setSection} />;
  if (section === 'Products') return <AdminProductsScreen onNavigate={setSection} onChanged={() => void load()} />;
  return <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}><ScrollView contentContainerStyle={{ maxWidth: 1100, width: '100%', alignSelf: 'center', padding: 20 }} refreshControl={<RefreshControl refreshing={busy} onRefresh={() => void load()} />}>
    <View style={{ flexDirection: 'row', gap: 14, paddingRight: 60, alignItems: 'center', marginBottom: 24 }}><BrandLogo size={50} /><Text style={{ color: c.text, fontSize: 23, fontWeight: '800' }}>NearBy Admin</Text></View>
    <Text style={{ color: c.primaryText, marginBottom: 12 }}>LIVE SERVER RECORDS · {section}</Text>
    {notice ? <Text accessibilityLiveRegion="polite" style={{ ...copy, marginBottom: 14, color: c.primaryText }}>{notice}</Text> : null}
    {section === 'Access & permissions' ? <AccessManagement /> : section === 'Overview' ? <View style={card}>{stats ? <><Text style={copy}>{stats.totalOrders} orders · {stats.totalProducts} products</Text><Text style={{ color: c.primaryText, fontSize: 22 }}>{money(stats.totalRevenue)} paid order revenue</Text></> : null}{statsError ? <Text accessibilityRole="alert" style={{ color: c.red }}>{statsError}</Text> : null}<Action label="Open insights" onPress={() => setSection('Insights')} /><Action label="Open orders" onPress={() => setSection('Orders')} /><Action label="Manage products" onPress={() => setSection('Products')} /></View> : <>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>{(['all', 'mine'] as const).map(value => <Action key={value} label={value === 'all' ? 'All orders' : 'My account orders'} selected={scope === value} onPress={() => { setScope(value); setPage(1); setOrders([]); }} />)}<Action label="Create from my cart" onPress={() => setCreating(true)} /></View>
      <Text style={{ ...small, marginBottom: 16 }}>{scope === 'all' ? 'Marketplace orders · Admin access required' : 'Orders belonging to the signed-in admin account, not a selected customer.'}</Text>
      <TextInput accessibilityLabel="Search this order page" value={search} onChangeText={setSearch} placeholder="Search this page by order ID or customer" placeholderTextColor={c.muted} style={{ padding: 14, minHeight: 48, color: c.text, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 12, marginBottom: 14 }} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>{statuses.map(value => <Action key={value} selected={status === value} label={value || 'All statuses'} onPress={() => { setStatus(value); setPage(1); setOrders([]); }} />)}</View>
      {error ? <View style={card}><Text accessibilityRole="alert" style={{ color: c.red }}>{error}</Text><Action label="Retry orders" disabled={busy} onPress={() => void load()} /></View> : null}
      {visible.map(order => <View key={order._id} style={card}>
        <Text style={{ ...copy, fontSize: 18, fontWeight: '700' }}>{order.orderNumber} · {money(order.totalAmount)}</Text>
        {order.manualReview ? <Text style={{ color: c.red, fontWeight: '800' }}>PAYMENT REVIEW REQUIRED · Check the payment provider before taking further action.</Text> : null}
        <Text style={{ color: c.primaryText }}>Order: {order.orderStatus} · Payment: {order.paymentStatus}{order.paymentMethod ? ` · ${order.paymentMethod}` : ''}</Text>
        <Text style={copy}>{order.customer}{order.phone ? ` · ${order.phone}` : ''}</Text>{order.address ? <Text style={small}>{order.address}</Text> : null}<Text style={small}>{orderDate(order.createdAt)}</Text>
        {order.items.map((item, index) => <Text key={index} style={copy}>{item.name} × {item.quantity}{item.size ? ` · ${item.size}` : ''}</Text>)}
        <Action label="View order details" onPress={() => setSelectedId(order._id)} />
        {(order.paymentStatus === 'paid' || ['cod', 'cash_on_delivery'].includes(order.paymentMethod)) && nextStatus[order.orderStatus] ? <Action label={`Mark ${nextStatus[order.orderStatus] === 'shipping' ? 'dispatched' : nextStatus[order.orderStatus]}`} disabled={saving} onPress={() => { setStatusError(''); setTransition({ order, next: nextStatus[order.orderStatus] }); }} /> : null}
      </View>)}
      {!busy && !error && !visible.length ? <Text style={small}>No matching orders.</Text> : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 14, marginVertical: 18 }}><Action label="Previous page" disabled={busy || page <= 1 || scope === 'mine'} onPress={() => setPage(value => value - 1)} /><Text style={small}>Page {page} of {Math.max(1, pagination.pages)} · {pagination.total} records</Text><Action label="Next page" disabled={busy || page >= pagination.pages || scope === 'mine'} onPress={() => setPage(value => value + 1)} /></View>
    </>}
    {busy ? <ActivityIndicator color={c.primary} /> : null}
  </ScrollView><RightNavigation title="NearBy Admin" subtitle="Live operations" brand={<BrandLogo size={48} />} mode={mode} onModeChange={setMode} active={section} items={['Overview', 'Insights', 'Orders', 'Products', 'Access & permissions'].map(id => ({ id, label: id }))} colors={{ glass: c.glass, text: c.text, muted: c.muted, accent: c.accent, border: c.border, selected: c.primary, selectedText: c.onPrimary, warning: c.red }} onSelect={setSection} onLogout={() => void signOut()} />
    {selectedId ? <AdminOrderDetails key={selectedId} id={selectedId} getOrder={api.get} onClose={() => setSelectedId(null)} /> : null}
    {creating ? <CreateCartOrder api={api} onClose={() => setCreating(false)} onCreated={id => { setCreating(false); setNotice('Order created. Payment and fulfilment status are shown in its server record.'); setSelectedId(id); void load(); }} onCheckOrders={() => { setCreating(false); setSection('Orders'); setScope('mine'); setPage(1); }} /> : null}
    <Modal visible={!!transition} transparent animationType="fade" onRequestClose={() => { if (!saving) setTransition(null); }}><View style={{ flex: 1, justifyContent: 'center', padding: 20, backgroundColor: 'rgba(10,15,30,0.5)' }}><View accessibilityViewIsModal style={{ ...card, width: '100%', maxWidth: 480, alignSelf: 'center' }}><Text style={{ ...copy, fontSize: 20, fontWeight: '800' }}>Confirm order status</Text><Text style={copy}>{transition?.order.orderNumber}: {transition?.order.orderStatus} → {transition?.next}</Text><Text style={small}>This updates fulfilment only. It does not confirm cash collection, mark a payment paid or assign a driver.</Text>{statusError ? <Text accessibilityRole="alert" style={{ color: c.red }}>{statusError}</Text> : null}<Action label={saving ? 'Updating…' : 'Confirm status update'} disabled={saving} onPress={() => void advance()} /><Action label="Cancel" disabled={saving} onPress={() => setTransition(null)} /></View></View></Modal>
  </SafeAreaView>;
}
function Action({ label, onPress, disabled = false, selected = false }: { label: string; onPress: () => void; disabled?: boolean; selected?: boolean }) {
  const { colors: c } = useAppTheme();
  return <Pressable accessibilityRole="button" disabled={disabled} accessibilityState={{ disabled, selected }} onPress={onPress} style={{ minHeight: 44, padding: 12, borderRadius: 12, justifyContent: 'center', backgroundColor: selected ? c.primary : c.soft, opacity: disabled ? 0.45 : 1 }}><Text style={{ color: selected ? c.onPrimary : c.primaryText, fontWeight: '700' }}>{label}</Text></Pressable>;
}
