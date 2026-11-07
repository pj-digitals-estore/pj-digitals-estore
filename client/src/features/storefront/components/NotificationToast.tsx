import { useEffect, useRef } from 'react';
import { Animated, Pressable, View } from 'react-native';
import Text from './AppText';
import { useStoreTheme } from '../ThemeContext';
import type { CustomerNotification } from './CustomerNotifications';

export default function NotificationToast({ item, onDismiss, onOpen }: {
  item: CustomerNotification; onDismiss: (id: string) => void; onOpen: (item: CustomerNotification) => void;
}) {
  const { palette: p } = useStoreTheme();
  const progress = useRef(new Animated.Value(0)).current;
  const closing = useRef(false);
  const dismissRef = useRef(onDismiss); dismissRef.current = onDismiss;
  function dismiss() {
    if (closing.current) return;
    closing.current = true;
    Animated.timing(progress, { toValue: 0, duration: 160, useNativeDriver: true }).start(({ finished }) => {
      if (finished) dismissRef.current(item.id);
    });
  }
  const dismissAction = useRef(dismiss); dismissAction.current = dismiss;
  useEffect(() => {
    Animated.timing(progress, { toValue: 1, duration: 220, useNativeDriver: true }).start();
    const timer = setTimeout(() => dismissAction.current(), 4500);
    return () => { clearTimeout(timer); progress.stopAnimation(); };
  }, [item.id, progress]);
  return <View pointerEvents="box-none" style={{ position: 'absolute', top: 16, left: 12, right: 12, alignItems: 'center', zIndex: 1000 }}>
    <Animated.View style={{ width: '100%', maxWidth: 440, flexDirection: 'row', alignItems: 'flex-start', backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, borderLeftWidth: 4, borderLeftColor: p.primary, borderRadius: 16, padding: 10, shadowColor: '#142D49', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.18, shadowRadius: 16, elevation: 10, opacity: progress, transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [-18, 0] }) }] }}>
      <Pressable onPress={() => { onOpen(item); dismissRef.current(item.id); }} accessibilityRole="button" accessibilityLabel={`${item.title}. ${item.message}. Open details`} style={{ flex: 1, padding: 6, gap: 5 }}>
        <View accessibilityRole="alert" accessibilityLiveRegion="polite"><Text style={{ color: p.text, fontSize: 14, fontWeight: '800' }}>{item.title}</Text><Text numberOfLines={3} style={{ color: p.muted, fontSize: 12, lineHeight: 19, marginTop: 5 }}>{item.message}</Text></View>
        <Text style={{ color: p.primaryText, fontSize: 11, fontWeight: '700' }}>View details →</Text>
      </Pressable>
      <Pressable onPress={dismiss} accessibilityRole="button" accessibilityLabel="Dismiss notification" style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: p.muted, fontSize: 24 }}>×</Text></Pressable>
    </Animated.View>
  </View>;
}
