import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { useCustomerAuth } from '../../auth/CustomerAuthContext';
import { getUserOrder } from '@/services/orders';
import type { Order } from '../data/types';
import { useStoreTheme } from '../ThemeContext';
import OrderStatusCard from './OrderStatusCard';
import Text from './AppText';

export default function OrderDetails({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { customer, getToken } = useCustomerAuth();
  const owner = customer?.id;
  const token = useRef(getToken); token.current = getToken;
  const { palette: p } = useStoreTheme();
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ id: string; owner: string; order?: Order; error?: string; loading: boolean } | null>(null);
  useEffect(() => {
    if (!id || !owner) { setState(null); return; }
    const controller = new AbortController();
    setState({ id, owner, loading: true });
    void getUserOrder(id, () => token.current(), controller.signal).then(order => {
      if (!controller.signal.aborted) setState({ id, owner, order, loading: false });
    }).catch(cause => {
      if (!controller.signal.aborted) setState({ id, owner, error: cause instanceof Error ? cause.message : 'Unable to load this order.', loading: false });
    });
    return () => controller.abort();
  }, [id, owner, attempt]);
  const current = state?.id === id && state?.owner === owner ? state : null;
  return <Modal visible={!!id} animationType="slide" transparent onRequestClose={onClose}>
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 48 }}>
      <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close order details" style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(16,35,57,0.45)' }} />
      <View accessibilityViewIsModal style={{ width: '100%', maxWidth: 640, maxHeight: '100%', backgroundColor: p.surface, borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: p.border }}>
        <View style={{ padding: 20, borderBottomWidth: 1, borderColor: p.border, gap: 12 }}>
          <Pressable onPress={onClose} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' }}><Text style={{ color: p.primaryText, fontWeight: '700' }}>← Back to My orders</Text></Pressable>
          <Text style={{ color: p.text, fontSize: 24, fontWeight: '800' }}>Order details</Text>
        </View>
        <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ padding: 16, gap: 16 }}>
          {!owner ? <Text style={{ color: p.text }}>Please sign in to view this order.</Text> : <>
            {!current || current.loading ? <Text style={{ color: p.muted }} accessibilityLiveRegion="polite">Loading order details…</Text> : null}
            {current?.error ? <Text accessibilityRole="alert" style={{ color: p.terracotta }}>{current.error}</Text> : null}
            {current?.order ? <OrderStatusCard order={current.order} /> : null}
            <Pressable disabled={!current || current.loading} onPress={() => setAttempt(value => value + 1)} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center', opacity: !current || current.loading ? 0.5 : 1 }}><Text style={{ color: p.primaryText, fontWeight: '700' }}>{current?.error ? 'Retry order' : 'Refresh status'}</Text></Pressable>
          </>}
        </ScrollView>
      </View>
    </View>
  </Modal>;
}
