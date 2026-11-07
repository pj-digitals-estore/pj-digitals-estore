import { Modal, Pressable, ScrollView, View } from 'react-native';
import Text from './AppText';
import { useStoreTheme } from '../ThemeContext';

export type CustomerNotification = { id: string; title: string; message: string; createdAt: number; read: boolean; target: 'Cart' | 'Favorites' | 'Orders' };

export function NotificationBell({ count, onPress }: { count: number; onPress: () => void }) {
  const { palette: p } = useStoreTheme();
  return <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`Notifications, ${count} unread`} style={{ minWidth: 40, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
    <View accessible={false} style={{ width: 18, height: 18, borderWidth: 1.6, borderColor: p.primaryText, borderTopLeftRadius: 10, borderTopRightRadius: 10, borderBottomLeftRadius: 3, borderBottomRightRadius: 3 }} />
    <View accessible={false} style={{ width: 5, height: 3, marginTop: 2, borderRadius: 3, backgroundColor: p.primaryText }} />
    {count > 0 ? <View style={{ position: 'absolute', top: 0, right: 0, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: p.primary, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: p.onPrimary, fontSize: 10, fontWeight: '800' }}>{count > 99 ? '99+' : count}</Text></View> : null}
  </Pressable>;
}

export default function CustomerNotifications({ open, items, onClose, onRead, onReadAll, onClear, onNavigate }: {
  open: boolean; items: CustomerNotification[]; onClose: () => void; onRead: (id: string) => void;
  onReadAll: () => void; onClear: () => void; onNavigate: (target: CustomerNotification['target']) => void;
}) {
  const { palette: p } = useStoreTheme();
  const unread = items.filter(item => !item.read).length;
  return <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 48 }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Close notifications" onPress={onClose} style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(16,35,57,0.45)' }} />
      <View accessibilityViewIsModal style={{ width: '100%', maxWidth: 520, maxHeight: '100%', backgroundColor: p.surface, borderRadius: 24, borderWidth: 1, borderColor: p.border, overflow: 'hidden' }}>
        <View style={{ padding: 22, gap: 14, borderBottomWidth: 1, borderColor: p.border }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}><View style={{ flex: 1 }}><Text style={{ color: p.text, fontSize: 23, fontWeight: '800' }}>Notifications</Text><Text style={{ color: p.muted, fontSize: 13, marginTop: 5 }}>{unread ? `${unread} unread updates` : 'You’re all caught up'}</Text></View><Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close notifications" style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: p.text, fontSize: 26 }}>×</Text></Pressable></View>
          {items.length ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 20 }}>{unread ? <Pressable onPress={onReadAll} accessibilityRole="button" style={{ paddingVertical: 8 }}><Text style={{ color: p.primaryText, fontWeight: '700' }}>Mark all as read</Text></Pressable> : null}<Pressable onPress={onClear} accessibilityRole="button" style={{ paddingVertical: 8 }}><Text style={{ color: p.muted }}>Clear all</Text></Pressable></View> : null}
        </View>
        <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ padding: 16, gap: 10 }}>
          {items.length ? items.map(item => <Pressable key={item.id} onPress={() => { onRead(item.id); onNavigate(item.target); onClose(); }} accessibilityRole="button" accessibilityLabel={`${item.read ? '' : 'Unread. '}${item.title}. ${item.message}`} style={{ padding: 16, gap: 8, backgroundColor: item.read ? p.surface : p.soft, borderWidth: 1, borderColor: p.border, borderRadius: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>{!item.read ? <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: p.primary }} /> : null}<Text style={{ color: p.text, fontWeight: '700', flex: 1 }}>{item.title}</Text></View>
            <Text style={{ color: p.muted, lineHeight: 21 }}>{item.message}</Text><Text style={{ color: p.muted, fontSize: 11 }}>{new Date(item.createdAt).toLocaleString()}</Text>
          </Pressable>) : <View style={{ paddingVertical: 36, paddingHorizontal: 16, alignItems: 'center', gap: 10 }}><Text style={{ color: p.text, fontSize: 18, fontWeight: '700' }}>No notifications yet</Text><Text style={{ color: p.muted, textAlign: 'center', lineHeight: 22 }}>Your shopping updates will appear here.</Text></View>}
        </ScrollView>
      </View>
    </View>
  </Modal>;
}
