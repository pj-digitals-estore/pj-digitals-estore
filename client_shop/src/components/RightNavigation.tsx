import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Item = { id: string; label: string; icon?: string; badge?: number };
type Colors = { glass: string; text: string; muted: string; accent: string; border: string; selected: string; selectedText: string; warning: string };
type Props = { title: string; subtitle?: string; items: Item[]; active: string; colors: Colors; onSelect: (id: string) => void; onLogout?: () => void; children?: ReactNode; brand?: ReactNode; mode?: 'light' | 'dark'; onModeChange?: (mode: 'light' | 'dark') => void };

export default function RightNavigation({ title, subtitle, items, active, colors: c, onSelect, onLogout, children, brand, mode, onModeChange }: Props) {
  const { width } = useWindowDimensions();
  const panelWidth = Math.min(352, width - 24);
  const [visible, setVisible] = useState(false);
  const [progress] = useState(() => new Animated.Value(0));
  const closing = useRef(false);
  const trigger = useRef<View>(null);
  const close = useCallback((action?: () => void) => {
    if (closing.current) return;
    closing.current = true;
    Animated.timing(progress, { toValue: 0, duration: 180, useNativeDriver: true }).start(({ finished }) => {
      if (!finished) return;
      setVisible(false); closing.current = false;
      requestAnimationFrame(() => trigger.current?.focus());
      action?.();
    });
  }, [progress]);
  useEffect(() => {
    if (!visible || Platform.OS !== 'web') return;
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') close(); };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [visible, close]);
  useEffect(() => () => progress.stopAnimation(), [progress]);
  return <>
    <Pressable ref={trigger} accessibilityRole="button" accessibilityLabel="Open navigation menu" accessibilityState={{ expanded: visible }} onPress={() => { progress.setValue(0); closing.current = false; setVisible(true); }} style={[s.trigger, { backgroundColor: c.glass, borderColor: c.border }]}>
      {[0, 1, 2].map(line => <View key={line} style={{ width: line === 1 ? 14 : 21, height: 2, backgroundColor: c.accent, borderRadius: 2, alignSelf: 'flex-end' }} />)}
    </Pressable>
    <Modal visible={visible} transparent animationType="none" onRequestClose={() => close()} onShow={() => Animated.timing(progress, { toValue: 1, duration: 240, useNativeDriver: true }).start()}>
      <View style={s.overlay}>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(10,15,28,0.35)', opacity: progress }]} />
        <Pressable style={StyleSheet.absoluteFill} onPress={() => close()} accessibilityRole="button" accessibilityLabel="Close navigation menu" />
        <Animated.View accessibilityViewIsModal style={[s.panel, { width: panelWidth, backgroundColor: c.glass, borderColor: c.border, transform: [{ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [panelWidth + 24, 0] }) }] }]}>
          <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom', 'right']}>
            <View style={[s.heading, { borderColor: c.border }]}><View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}>{brand}<View style={{ flex: 1, gap: 6 }}><Text style={{ color: c.accent, fontSize: 10, letterSpacing: 2, fontWeight: '700' }}>NEARBY WORKSPACE</Text><Text style={{ color: c.text, fontSize: 20, fontWeight: '800' }}>{title}</Text>{subtitle ? <Text style={{ color: c.muted, fontSize: 12, lineHeight: 19 }}>{subtitle}</Text> : null}</View></View><Pressable onPress={() => close()} accessibilityRole="button" accessibilityLabel="Close navigation menu" style={s.close}><Text style={{ color: c.text, fontSize: 27 }}>×</Text></Pressable></View>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 8 }} keyboardShouldPersistTaps="handled">
              {children}
              {items.map(item => <Pressable key={item.id} accessibilityRole="button" accessibilityState={{ selected: active === item.id }} onPress={() => close(() => onSelect(item.id))} style={[s.item, { backgroundColor: active === item.id ? c.selected : 'transparent', borderColor: active === item.id ? c.border : 'transparent' }]}><Text accessible={false} style={{ color: active === item.id ? c.selectedText : c.accent, fontSize: 20, width: 26, textAlign: 'center' }}>{item.icon || '›'}</Text><Text style={{ flex: 1, color: active === item.id ? c.selectedText : c.text, fontSize: 14, fontWeight: '600' }}>{item.label}</Text>{item.badge ? <Text style={{ color: active === item.id ? c.selectedText : c.accent, fontSize: 12, fontWeight: '800' }}>{item.badge}</Text> : null}</Pressable>)}
            </ScrollView>
            {mode && onModeChange ? <View style={{ padding: 18, borderTopWidth: 1, borderColor: c.border, gap: 10 }}><Text style={{ color: c.muted, fontSize: 10, letterSpacing: 1.6, fontWeight: '700' }}>APPEARANCE</Text><View style={{ flexDirection: 'row', borderRadius: 14, padding: 4, backgroundColor: 'rgba(120,120,160,0.10)', gap: 4 }}>{(['light', 'dark'] as const).map(option => <Pressable key={option} onPress={() => onModeChange(option)} accessibilityRole="radio" accessibilityLabel={`Use ${option} mode`} accessibilityState={{ checked: option === mode }} style={{ flex: 1, minHeight: 44, borderRadius: 11, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, backgroundColor: option === mode ? c.selected : 'transparent' }}><Text style={{ color: option === mode ? c.selectedText : c.text, fontSize: 14 }}>{option === 'light' ? '☀  Light' : '◐  Dark'}</Text></Pressable>)}</View></View> : null}
            {onLogout ? <View style={{ paddingHorizontal: 18, paddingBottom: 12 }}><Pressable onPress={() => close(onLogout)} accessibilityRole="button" style={s.item}><Text style={{ color: c.warning, fontSize: 14, fontWeight: '700' }}>Log out</Text></Pressable></View> : null}
          </SafeAreaView>
        </Animated.View>
      </View>
    </Modal>
  </>;
}

const s = StyleSheet.create({
  trigger: { position: 'absolute', top: 12, right: 16, zIndex: 50, width: 48, height: 48, borderRadius: 16, borderWidth: 1, padding: 13, justifyContent: 'center', gap: 5, boxShadow: '0px 4px 18px rgba(20,25,50,0.14)' },
  overlay: { flex: 1, alignItems: 'flex-end' },
  panel: { height: '100%', borderLeftWidth: 1, borderTopLeftRadius: 30, borderBottomLeftRadius: 30, overflow: 'hidden', boxShadow: '-8px 0px 28px rgba(15,20,35,0.18)' },
  heading: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', padding: 22, borderBottomWidth: 1 },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingHorizontal: 14, paddingVertical: 13, borderRadius: 16, borderWidth: 1 },
});
