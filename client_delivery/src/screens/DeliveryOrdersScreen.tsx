import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Linking, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '../AppearanceContext';
import { useDeliveryAuth } from '../context/DeliveryAuthContext';
import DeliveryAccountSettings from '../auth/DeliveryAccountSettings';
import BrandLogo from '../components/BrandLogo';
import RightNavigation from '../components/RightNavigation';
import DeliveryOrderDetails from '../components/DeliveryOrderDetails';
import DeliveryGradient from '../components/DeliveryGradient';
import { apiRequest } from '../lib/api';
import { orderDate, parseOrders, type AccountOrder } from '../services/orderData';

const money = (amount: number) => '₹' + amount.toLocaleString('en-IN', { maximumFractionDigits: 2 });
export default function DeliveryOrdersScreen() {
  const { colors: c, mode, setMode } = useAppTheme();
  const { partner, getToken, logout } = useDeliveryAuth();
  const [section, setSection] = useState('Home');
  const [orders, setOrders] = useState<AccountOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const current = useRef<AbortController | null>(null);
  const scroll = useRef<ScrollView>(null);
  const request = useCallback(async (path: string, options: RequestInit = {}): Promise<unknown> => {
    const token = await getToken();
    if (!token) throw Error('Sign in again to view orders.');
    const response = await apiRequest('/api' + path, { ...options, cache: 'no-store', headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', ...options.headers } });
    const body = await response.json();
    if (body.success !== true) throw Error(body.message || 'The server did not confirm this request.');
    return body.data;
  }, [getToken]);
  const load = useCallback(async () => {
    current.current?.abort();
    const controller = new AbortController(); current.current = controller;
    setLoading(true); setError('');
    try {
      const records = parseOrders(await request('/orders', { signal: controller.signal }));
      if (!controller.signal.aborted) { setOrders(records); setLoaded(true); }
    } catch (cause) { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Unable to load orders.'); }
    finally { if (!controller.signal.aborted) setLoading(false); }
  }, [request]);
  useEffect(() => {
    const initial = setTimeout(() => void load(), 0);
    const timer = setInterval(() => { if (AppState.currentState === 'active' && !current.current?.signal.aborted) void load(); }, 30000);
    const listener = AppState.addEventListener('change', state => { if (state === 'active') void load(); });
    return () => { clearTimeout(initial); clearInterval(timer); listener.remove(); current.current?.abort(); };
  }, [load]);
  const card = { padding: 20, borderRadius: 18, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, gap: 12, marginBottom: 16 };
  const copy = { color: c.text, fontSize: 14, lineHeight: 22 };
  const small = { color: c.muted, fontSize: 12, lineHeight: 20 };
  function button(label: string, action: () => void, disabled = false) {
    return <Pressable accessibilityRole="button" disabled={disabled} accessibilityState={{ disabled }} onPress={action} style={{ minHeight: 44, padding: 12, borderRadius: 12, backgroundColor: c.soft, justifyContent: 'center', opacity: disabled ? 0.5 : 1 }}><Text style={{ color: c.primaryText, fontWeight: '700', textAlign: 'center' }}>{label}</Text></Pressable>;
  }
  const visible = section === 'Home' ? orders.slice(0, 3) : orders;
  return <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}><ScrollView ref={scroll} contentContainerStyle={{ width: '100%', maxWidth: 1120, alignSelf: 'center', padding: 20, paddingBottom: 40 }} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingRight: 60, marginBottom: 24 }}><BrandLogo size={48} /><View style={{ flex: 1 }}><Text style={{ ...copy, fontSize: 22, fontWeight: '800' }}>NearBy Delivery</Text><Text style={small}>{partner?.name}</Text></View></View>
    <Text style={{ ...copy, fontSize: 27, lineHeight: 34, fontWeight: '800', marginBottom: 18 }}>{section === 'Home' ? `Hello, ${partner?.name.split(' ')[0] || 'there'}.` : section === 'Orders' ? 'Account orders' : 'Clerk account settings'}</Text>
    {section === 'Profile' ? <DeliveryAccountSettings /> : <>
      {section === 'Home' ? <DeliveryGradient colors={c.gradient} style={{ padding: 24, borderRadius: 20, marginBottom: 18, gap: 12 }}><Text style={{ color: c.heroText, fontSize: 24, fontWeight: '800' }}>Your orders, in one place.</Text><Text style={{ color: c.heroMuted, lineHeight: 22 }}>Connected to your account. Open an order to see the latest details and status.</Text>{button('View all orders →', () => setSection('Orders'))}</DeliveryGradient> : button('← Back to overview', () => setSection('Home'))}
      <View style={{ ...card, marginTop: 16 }}><Text style={small}>These endpoints return orders belonging to this Clerk account. Driver assignments and pickup/delivery updates need separate delivery APIs.</Text></View>
      {error ? <View style={card}><Text accessibilityRole="alert" style={{ color: c.red }}>{error}</Text><Pressable accessibilityRole="button" disabled={loading} onPress={() => void load()} style={{padding:14,borderRadius:12,backgroundColor:c.soft,opacity:loading?0.5:1}}><Text style={{color:c.primaryText,fontWeight:'700'}}>Retry orders</Text></Pressable></View> : null}
      {loading ? <ActivityIndicator color={c.primary} style={{ marginBottom: 16 }} /> : null}
      {loaded && section === 'Home' ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>{[
        ['Account orders', orders.length], ['Delivered', orders.filter(order => order.orderStatus === 'delivered').length], ['Payment pending', orders.filter(order => order.paymentStatus === 'pending').length],
      ].map(([label, count]) => <View key={label} style={{ ...card, flexGrow: 1, flexBasis: 180 }}><Text style={small}>{label}</Text><Text style={{ ...copy, fontSize: 28, fontWeight: '800' }}>{count}</Text></View>)}</View> : null}
      {visible.map(order => <View key={order._id} style={card}>
        <Text style={{ ...copy, fontSize: 17, fontWeight: '800' }}>{order.orderNumber} · {money(order.totalAmount)}</Text><Text style={{ color: c.primaryText }}>Order: {order.orderStatus} · Payment: {order.paymentStatus}</Text>
        <Text style={small}>{orderDate(order.createdAt)}</Text>{order.customer ? <Text style={copy}>{order.customer}</Text> : null}
        {order.items.map((item, index) => <Text key={`${index}-${item.name}`} style={small}>{item.name} × {item.quantity}{item.size ? ` · ${item.size}` : ''}</Text>)}
        {order.address ? <Text style={small}>{order.address}</Text> : null}
        {button('View order details', () => setSelectedId(order._id))}
        {order.address ? button('Open GPS directions', () => { void Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(order.address)}`).catch(() => setNotice('Unable to open maps. Please try again.')); }) : null}
      </View>)}
      {!loading && !error && !orders.length ? <View style={card}><Text style={copy}>No orders found for this account.</Text><Text style={small}>This does not mean there are no delivery jobs across the marketplace.</Text></View> : null}
    </>}
    {notice ? <Text accessibilityRole="alert" style={{ color: c.red }}>{notice}</Text> : null}
  </ScrollView><RightNavigation title="NearBy Delivery" subtitle={partner?.name} brand={<BrandLogo size={48} />} mode={mode} onModeChange={setMode} active={section} items={['Home', 'Orders', 'Profile'].map(id => ({ id, label: id === 'Orders' ? 'Account orders' : id }))} colors={{ glass: c.glass, text: c.text, muted: c.muted, accent: c.accent, border: c.border, selected: c.primary, selectedText: c.onPrimary, warning: c.red }} onSelect={id => { setSection(id); scroll.current?.scrollTo({ y: 0, animated: false }); }} onLogout={() => { void logout().catch(() => setNotice('Unable to sign out. Please try again.')); }} />
    {selectedId ? <DeliveryOrderDetails key={selectedId} id={selectedId} request={request} onClose={() => setSelectedId(null)} /> : null}
  </SafeAreaView>;
}
