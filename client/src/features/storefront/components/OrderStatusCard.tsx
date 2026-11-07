import CancelCheckout from './CancelCheckout';
import { Pressable, View } from 'react-native';
import Text from './AppText';
import { useStoreTheme } from '../ThemeContext';
import type { Order } from '../data/types';
import { money } from '../data/catalog';

export const orderSteps = ['Placed', 'Confirmed', 'Processing', 'Dispatched', 'Delivered'] as const;

export default function OrderStatusCard({ order, onOpen, onPay, paying, onCancel }: { order: Order; onOpen?: () => void; onPay?: () => void; paying?: boolean; onCancel?: () => Promise<void> }) {
  const { palette: p } = useStoreTheme();
  const step = orderSteps.findIndex(value => value === order.status);
  const cancelled = order.status === 'Cancelled';
  const updated = order.statusUpdatedAt ? new Date(order.statusUpdatedAt) : null;
  return <View style={{ padding: 20, gap: 16, borderRadius: 20, borderWidth: 1, borderColor: p.border, backgroundColor: p.surface }}>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
      <View style={{ flexShrink: 1, gap: 5 }}><Text style={{ color: p.text, fontWeight: '800', fontSize: 16 }}>{order.orderNumber || order.id}</Text><Text style={{ color: p.muted, fontSize: 12 }}>{order.date}</Text></View>
      <View style={{ paddingVertical: 7, paddingHorizontal: 12, borderRadius: 20, backgroundColor: p.soft }}><Text style={{ color: cancelled ? p.terracotta : p.primaryText, fontWeight: '700', fontSize: 12 }}>{order.status || 'Status unavailable'}</Text></View>
    </View>
    {!cancelled && step >= 0 ? <View accessibilityLabel={`Order status: ${order.status}`} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{orderSteps.map((label, index) => <View key={label} style={{ flexGrow: 1, minWidth: 76, gap: 7 }}><View style={{ height: 4, borderRadius: 3, backgroundColor: index <= step ? p.primary : p.border }} /><Text style={{ fontSize: 11, color: index <= step ? p.primaryText : p.muted, fontWeight: index === step ? '800' : '400' }}>{label}</Text></View>)}</View> : null}
    <Text style={{ color: p.muted, lineHeight: 21 }}>{order.status === 'Awaiting payment' ? 'Payment has not been confirmed. If money was debited, refresh and wait for confirmation before retrying.' : cancelled ? 'This order has been cancelled.' : order.status === 'Delivered' ? 'Your order has been delivered.' : order.status === 'Dispatched' ? 'Your order is on its way.' : order.status === 'Processing' ? 'Your items are being prepared.' : order.status === 'Confirmed' ? 'Your order has been confirmed.' : order.status === 'Placed' ? 'Your order has been received.' : 'Waiting for an order status update.'}</Text>
    {order.needsReview ? <Text accessibilityRole="alert" style={{ color: p.terracotta, lineHeight: 21 }}>Payment reached a cancelled order. Contact support for a refund with this order number; do not pay again.</Text> : null}
    {updated && !Number.isNaN(updated.getTime()) ? <Text style={{ color: p.muted, fontSize: 11 }}>Updated {updated.toLocaleString()}</Text> : null}
    <View style={{ borderTopWidth: 1, borderColor: p.border, paddingTop: 12, gap: 8 }}>{order.items.map((item, index) => <Text key={`${item.id}-${index}`} style={{ color: p.text, fontSize: 13 }}>{item.name} × {item.quantity}{item.size ? ' · '+item.size : ''}</Text>)}<Text style={{ color: p.primaryText, fontWeight: '800' }}>Total {money(order.total)}</Text>{order.paymentMethod || order.paymentStatus ? <Text style={{ color: p.muted, fontSize: 12 }}>{[order.paymentMethod, order.paymentStatus].filter(Boolean).join(' · ')}</Text> : null}</View>
    {onPay && order.status === 'Awaiting payment' ? <Pressable disabled={paying} onPress={onPay} accessibilityRole="button" style={{ minHeight: 48, padding: 12, borderRadius: 12, backgroundColor: p.primary, justifyContent: 'center' }}><Text style={{ color: p.onPrimary, fontWeight: '700' }}>{paying ? 'Preparing checkout…' : 'Continue payment'}</Text></Pressable> : null}
    {onCancel && order.status === 'Awaiting payment' ? <CancelCheckout onCancel={onCancel} /> : null}
    {onOpen ? <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel={`View details for order ${order.orderNumber || order.id}`} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: p.primaryText, fontWeight: '700' }}>View order details →</Text></Pressable> : null}
  </View>;
}
