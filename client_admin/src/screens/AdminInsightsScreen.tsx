import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '../AppearanceContext';
import { useAdminAccess } from '../auth/AdminAccessContext';
import BrandLogo from '../components/BrandLogo';
import RightNavigation from '../components/RightNavigation';
import { createAdminOrdersApi } from '../services/adminOrders';
import { createAdminProductsApi, type AdminProduct } from '../services/adminProducts';
import type { AccountOrder } from '../services/orderData';
import { analyzeOrders, analyzeStock, collectInsightPages, type Coverage } from '../services/adminInsights';

type Snapshot = { orders: Coverage<AccountOrder> | null; products: Coverage<AdminProduct> | null; orderError: string; productError: string; at: string };
const money = (value: number) => '₹' + value.toLocaleString('en-IN', { maximumFractionDigits: 2 });
const compact = (value: number) => value >= 100000 ? `₹${(value / 100000).toFixed(1)}L` : value >= 1000 ? `₹${(value / 1000).toFixed(1)}k` : `₹${Math.round(value)}`;

export default function AdminInsightsScreen({ onNavigate }: { onNavigate: (section: string) => void }) {
  const { colors: c, mode, setMode } = useAppTheme();
  const { getToken, signOut } = useAdminAccess();
  const { width } = useWindowDimensions();
  const token = useCallback(() => getToken ? getToken() : Promise.resolve(null), [getToken]);
  const orderApi = useMemo(() => createAdminOrdersApi(token), [token]);
  const productApi = useMemo(() => createAdminProductsApi(token), [token]);
  const [days, setDays] = useState(30);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState({ orders: 0, products: 0 });
  const [notice, setNotice] = useState('');
  const current = useRef<AbortController | null>(null);
  const load = useCallback(async () => {
    current.current?.abort();
    const controller = new AbortController(); current.current = controller;
    setLoading(true); setProgress({ orders: 0, products: 0 });
    const [orders, products] = await Promise.allSettled([
      collectInsightPages(async (page, signal) => { const result = await orderApi.list('all', page, '', signal); return { items: result.orders, pages: result.pages, total: result.total, coverageKnown: result.paginationKnown }; }, controller.signal, count => { if (!controller.signal.aborted) setProgress(value => ({ ...value, orders: count })); }),
      collectInsightPages(async (page, signal) => { const result = await productApi.list(page, signal); return { items: result.products, pages: result.pages, total: result.total, coverageKnown: result.paginationKnown }; }, controller.signal, count => { if (!controller.signal.aborted) setProgress(value => ({ ...value, products: count })); }),
    ]);
    if (controller.signal.aborted) return;
    setSnapshot({ orders: orders.status === 'fulfilled' ? orders.value : null, products: products.status === 'fulfilled' ? products.value : null, orderError: orders.status === 'rejected' ? String(orders.reason instanceof Error ? orders.reason.message : 'Orders unavailable.') : '', productError: products.status === 'rejected' ? String(products.reason instanceof Error ? products.reason.message : 'Products unavailable.') : '', at: new Date().toISOString() });
    setLoading(false);
  }, [orderApi, productApi]);
  useEffect(() => { const first = setTimeout(() => void load(), 0); return () => { clearTimeout(first); current.current?.abort(); }; }, [load]);
  const orders = useMemo(() => snapshot?.orders ? analyzeOrders(snapshot.orders.items, days, snapshot.at) : null, [snapshot, days]);
  const stock = useMemo(() => snapshot?.products ? analyzeStock(snapshot.products.items) : null, [snapshot]);
  const partial = snapshot && ((snapshot.orders && !snapshot.orders.complete) || (snapshot.products && !snapshot.products.complete));
  const chartWidth = Math.max(Math.min(width - 80, 1000), days * 28);
  const chartMax = Math.max(1, ...(orders?.trend.map(day => day.value) ?? []));
  const card = { padding: 20, backgroundColor: c.surface, borderRadius: 18, borderWidth: 1, borderColor: c.border, gap: 12, marginBottom: 18 };
  const copy = { color: c.muted, fontSize: 12, lineHeight: 20 };
  return <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}><ScrollView contentContainerStyle={{ width: '100%', maxWidth: 1100, alignSelf: 'center', padding: 20, paddingBottom: 40 }} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}>
    <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', paddingRight: 60, marginBottom: 24 }}><BrandLogo size={50} /><View style={{ flex: 1 }}><Text style={{ color: c.text, fontSize: 23, fontWeight: '800' }}>NearBy Admin</Text><Text style={copy}>Insights & analysis</Text></View></View>
    <Text style={{ color: c.text, fontSize: 29, fontWeight: '800', marginBottom: 10 }}>Your marketplace, measured.</Text>
    <Text style={{ ...copy, marginBottom: 18 }}>Analysis of saved orders and the current catalogue.</Text>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>{[7, 30, 90].map(value => <Pressable key={value} accessibilityRole="radio" accessibilityLabel={`Last ${value} days`} accessibilityState={{ checked: days === value }} onPress={() => setDays(value)} style={{ padding: 13, borderRadius: 12, backgroundColor: days === value ? c.primary : c.soft }}><Text style={{ color: days === value ? c.onPrimary : c.text }}>Last {value} days</Text></Pressable>)}<Pressable accessibilityRole="button" disabled={loading} onPress={() => void load()} style={{ padding: 13, borderRadius: 12, backgroundColor: c.soft, opacity: loading ? 0.5 : 1 }}><Text style={{ color: c.primaryText }}>Refresh analysis</Text></Pressable></View>
    {loading ? <View style={card}><ActivityIndicator color={c.primary} /><Text style={copy}>Loading {progress.orders} orders and {progress.products} products…{snapshot ? ' Previous snapshot remains below until refresh finishes.' : ''}</Text></View> : null}
    {snapshot ? <View style={card}><Text style={copy}>Refreshed {new Date(snapshot.at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST · Order periods include today.</Text><Text style={copy}>Loaded {snapshot.orders?.items.length ?? 'unavailable'} of {snapshot.orders?.totalKnown ? snapshot.orders.total : 'unknown'} reported orders · {snapshot.products?.items.length ?? 'unavailable'} of {snapshot.products?.totalKnown ? snapshot.products.total : 'unknown'} active products.</Text>
      {partial ? <Text accessibilityRole="alert" style={{ color: c.red, lineHeight: 21 }}>Partial or unverified snapshot. Analysis covers loaded records only; each source is limited to 100 pages. Refresh or use backend reporting for complete totals.</Text> : null}
      {snapshot.orderError ? <Text accessibilityRole="alert" style={{ color: c.red }}>Order analysis unavailable: {snapshot.orderError}</Text> : null}{snapshot.productError ? <Text accessibilityRole="alert" style={{ color: c.red }}>Stock analysis unavailable: {snapshot.productError}</Text> : null}
      {orders?.invalidDates ? <Text style={{ color: c.red }}>{orders.invalidDates} orders have no valid creation date and are excluded from period analysis.</Text> : null}
    </View> : null}
    {orders ? <>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
        <Metric label="PAID ORDER VALUE" value={money(orders.paidValue)} hint="Paid, non-cancelled orders created in this period; includes order charges." />
        <Metric label="ORDERS CREATED" value={String(orders.count)} hint={`${orders.paidCount} paid · ${orders.delivered} delivered`} />
        <Metric label="AVERAGE PAID ORDER" value={money(orders.average)} hint="Paid order value divided by the number of paid orders." />
        <Metric label="COD STILL DUE" value={money(orders.codDue)} hint={`${orders.codDueCount} non-cancelled COD orders not marked paid. Not collected revenue.`} />
        <Metric label="CANCELLED ORDERS" value={String(orders.cancelled)} hint={`${orders.cancelRate.toFixed(1)}% of orders created in the selected period.`} />
      </View>
      <View style={card}><Text style={{ color: c.text, fontSize: 20, fontWeight: '800' }}>Paid order trend</Text><Text style={copy}>{!snapshot?.orders?.complete || orders.invalidDates ? 'Previous-period comparison is unavailable for incomplete order history.' : orders.growth === null ? 'No previous-period paid value for comparison.' : `${orders.growth >= 0 ? '+' : ''}${orders.growth.toFixed(1)}% versus the previous ${days} days. Today is still in progress.`}</Text><Text style={copy}>Grouped by order creation date in India, rather than payment collection date.</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator><View style={{ width: chartWidth, height: 195, flexDirection: 'row', alignItems: 'flex-end', gap: 5 }}>
          {orders.trend.map(day => <View key={day.date} accessible accessibilityLabel={`${day.date}: paid order value ${money(day.value)}`} style={{ flex: 1, minWidth: 20, alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}><Text style={{ color: c.muted, fontSize: 9 }}>{day.value ? compact(day.value) : '0'}</Text><View style={{ width: '75%', height: day.value / chartMax * 125, borderTopLeftRadius: 6, borderTopRightRadius: 6, backgroundColor: c.primary }} /><Text style={{ color: c.muted, fontSize: 9 }}>{day.date.slice(8)}/{day.date.slice(5, 7)}</Text></View>)}
        </View></ScrollView>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}><View style={{ ...card, flexGrow: 1, flexBasis: 300 }}><Text style={{ color: c.text, fontSize: 18, fontWeight: '700' }}>Order status breakdown</Text>{orders.states.length ? orders.states.map(status => <Bar key={status.name} label={status.name.replace(/_/g, ' ')} value={status.count} max={Math.max(1, orders.count)} />) : <Text style={copy}>No orders in this period.</Text>}</View><View style={{ ...card, flexGrow: 1, flexBasis: 300 }}><Text style={{ color: c.text, fontSize: 18, fontWeight: '700' }}>Payment methods</Text>{orders.methods.length ? orders.methods.map(method => <Bar key={method.name} label={method.name.replace(/_/g, ' ')} value={method.count} max={Math.max(1, orders.count)} />) : <Text style={copy}>No payment methods reported.</Text>}<Text style={copy}>Order counts by method; a selected payment method does not prove payment.</Text></View></View>
      <View style={card}><Text style={{ color: c.text, fontSize: 20, fontWeight: '800' }}>Top products · paid units</Text><Text style={copy}>Paid, non-cancelled orders created in the selected period. Ranking uses product IDs, not matching names.</Text>{orders.topProducts.map(product => <Bar key={product.id} label={product.name} value={product.units} max={orders.topProducts[0]?.units || 1} />)}{!orders.topProducts.length ? <Text style={copy}>No linked paid products to rank.</Text> : null}{orders.unlinkedUnits ? <Text style={copy}>{orders.unlinkedUnits} units have no product reference and are excluded from this ranking.</Text> : null}</View>
    </> : null}
    {stock ? <>
      <Text style={{ color: c.text, fontSize: 23, fontWeight: '800', marginBottom: 10 }}>Current stock health</Text><Text style={{ ...copy, marginBottom: 18 }}>Current active catalogue snapshot. These figures do not change with the order-period filter.</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}><Metric label="UNITS IN STOCK" value={stock.units.toLocaleString('en-IN')} hint={`${stock.products} loaded active products`} /><Metric label="RETAIL STOCK VALUE" value={money(stock.retailValue)} hint="Current selling price × stock. This is not profit, cost or collected revenue." /><Metric label="SOLD OUT" value={String(stock.soldOut.length)} hint="Products with zero stock" /><Metric label="LOW STOCK" value={String(stock.lowStock.length)} hint="Products with 1–5 units remaining" /></View>
      <View style={card}><Text style={{ color: c.text, fontSize: 19, fontWeight: '700' }}>Catalogue by category</Text>{stock.categories.map(category => <View key={category.name} style={{ gap: 5 }}><Bar label={category.name} value={category.products} max={Math.max(1, stock.products)} /><Text style={copy}>{category.units} units in stock</Text></View>)}{!stock.categories.length ? <Text style={copy}>No products loaded.</Text> : null}</View>
      <View style={card}><Text style={{ color: c.text, fontSize: 19, fontWeight: '700' }}>Stock needing attention</Text>{[...stock.soldOut, ...stock.lowStock].slice(0, 10).map(product => <View key={product._id} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 14 }}><Text style={{ ...copy, flex: 1 }}>{product.name}</Text><Text style={{ color: product.stock === 0 ? c.red : c.primaryText, fontWeight: '700' }}>{product.stock === 0 ? 'Sold out' : `${product.stock} left`}</Text></View>)}{!stock.soldOut.length && !stock.lowStock.length ? <Text style={copy}>{stock.products ? 'All loaded products have more than five units available.' : 'No active products loaded.'}</Text> : null}<Pressable accessibilityRole="button" onPress={() => onNavigate('Products')} style={{ paddingVertical: 14 }}><Text style={{ color: c.primaryText, fontWeight: '700' }}>Manage products and stock →</Text></Pressable></View>
    </> : null}
    {notice ? <Text accessibilityRole="alert" style={{ color: c.red }}>{notice}</Text> : null}
  </ScrollView><RightNavigation title="NearBy Admin" subtitle="Insights & analysis" brand={<BrandLogo size={48} />} mode={mode} onModeChange={setMode} active="Insights" items={['Overview', 'Insights', 'Orders', 'Products', 'Access & permissions'].map(id => ({ id, label: id }))} colors={{ glass: c.glass, text: c.text, muted: c.muted, accent: c.accent, border: c.border, selected: c.primary, selectedText: c.onPrimary, warning: c.red }} onSelect={onNavigate} onLogout={() => { void signOut().catch(() => setNotice('Unable to sign out. Please try again.')); }} />
  </SafeAreaView>;
}

function Metric({ label, value, hint }: { label: string; value: string; hint: string }) {
  const { colors: c } = useAppTheme();
  return <View style={{ flexGrow: 1, flexBasis: 220, padding: 20, borderRadius: 18, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, gap: 10, marginBottom: 18 }}><Text style={{ color: c.muted, fontSize: 10, letterSpacing: 1, fontWeight: '700' }}>{label}</Text><Text style={{ color: c.primaryText, fontSize: 27, fontWeight: '800' }}>{value}</Text><Text style={{ color: c.muted, fontSize: 12, lineHeight: 20 }}>{hint}</Text></View>;
}
function Bar({ label, value, max }: { label: string; value: number; max: number }) {
  const { colors: c } = useAppTheme();
  return <View style={{ gap: 7, marginVertical: 5 }}><View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 14 }}><Text style={{ flex: 1, color: c.text, fontSize: 13 }}>{label}</Text><Text style={{ color: c.primaryText, fontWeight: '700' }}>{value}</Text></View><View style={{ height: 7, backgroundColor: c.soft, borderRadius: 4 }}><View style={{ height: 7, width: `${Math.min(100, value / Math.max(1, max) * 100)}%`, backgroundColor: c.primary, borderRadius: 4 }} /></View></View>;
}
