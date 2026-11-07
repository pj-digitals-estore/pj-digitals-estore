import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useAppTheme } from '../AppearanceContext';
import { orderDate, parseOrder, type AccountOrder } from './orderData';

type Request = (path: string, options?: RequestInit & { timeoutMs?: number }) => Promise<unknown>;
const money = (amount: number) => '₹' + amount.toLocaleString('en-IN', { maximumFractionDigits: 2 });

export default function ShopOrderDetails({ id, request, onClose }: { id: string; request: Request; onClose: () => void }) {
  const { colors: c } = useAppTheme();
  const [order, setOrder] = useState<AccountOrder | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const start = setTimeout(async () => {
      setLoading(true); setError(''); setOrder(null);
      try {
        const latest = parseOrder(await request(`/orders/${encodeURIComponent(id)}`, { signal: controller.signal, cache: 'no-store' }));
        if (latest._id !== id) throw Error('The server returned a different order.');
        if (!controller.signal.aborted) setOrder(latest);
      } catch (cause) { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Unable to load this order.'); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }, 0);
    return () => { clearTimeout(start); controller.abort(); };
  }, [id, request, attempt]);
  const copy = { color: c.text, fontSize: 14, lineHeight: 22 };
  return <Modal visible transparent animationType="fade" onRequestClose={onClose}><View style={{ flex: 1, backgroundColor: 'rgba(10,15,30,0.5)', justifyContent: 'center', padding: 20 }}><View accessibilityViewIsModal style={{ width: '100%', maxWidth: 560, maxHeight: '100%', alignSelf: 'center', backgroundColor: c.surface, borderRadius: 18, padding: 20, borderColor: c.border, borderWidth: 1 }}>
    <ScrollView contentContainerStyle={{ gap: 16 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}><Text style={{ ...copy, fontSize: 22, fontWeight: '800' }}>Order details</Text><Pressable accessibilityRole="button" onPress={onClose} style={{ padding: 12 }}><Text style={{ color: c.primaryText }}>Close</Text></Pressable></View>
      {loading ? <ActivityIndicator color={c.primary} /> : error ? <><Text accessibilityRole="alert" style={{ color: c.red }}>{error}</Text><Pressable accessibilityRole="button" onPress={() => setAttempt(value => value + 1)} style={{ padding: 14 }}><Text style={{ color: c.primaryText }}>Retry order details</Text></Pressable></> : order ? <>
        <Text selectable style={{ ...copy, fontWeight: '800' }}>{order.orderNumber}</Text><Text style={copy}>{orderDate(order.createdAt)}</Text>
        <Text style={copy}>Order status: {order.orderStatus}</Text><Text style={copy}>Payment: {order.paymentStatus}{order.paymentMethod ? ` · ${order.paymentMethod}` : ''}</Text>
        <Text style={{ ...copy, fontWeight: '700' }}>Items</Text>{order.items.map((item, index) => <View key={`${index}-${item.name}`} style={{ gap: 5 }}><Text style={copy}>{item.name} × {item.quantity}{item.size ? ` · ${item.size}` : ''}</Text>{item.price !== undefined ? <Text style={{ color: c.muted }}>{money(item.price)} each · {money(item.price * item.quantity)}</Text> : null}</View>)}
        <Text style={{ ...copy, fontSize: 20, fontWeight: '800' }}>Order total: {money(order.totalAmount)}</Text>
        <Text style={{ ...copy, fontWeight: '700' }}>Delivery address</Text><Text style={copy}>{[order.customer, order.phone, order.address].filter(Boolean).join('\n') || 'Not supplied by the server'}</Text>
      </> : null}
    </ScrollView>
  </View></View></Modal>;
}
