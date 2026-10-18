import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { PropsWithChildren } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useShop } from '../context/ShopDataContext';

export const C = { bg: '#E9EDF2', panel: '#F4F6F8', raised: '#DCE3EB', line: '#CFD7E1', text: '#1E2938', muted: '#566476', blue: '#3677BD', cyan: '#277F8D', green: '#28734E', amber: '#93620F', red: '#AF3D52' };
export const S = StyleSheet.create({
 page: { flex: 1, backgroundColor: C.bg }, content: { padding: 16, paddingBottom: 24, width: '100%', maxWidth: 1120, alignSelf: 'center' },
 brand: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 }, mark: { width: 36, height: 36, borderRadius: 7, backgroundColor: '#DCE6F1', borderWidth: 1, borderColor: '#C5D1DE', alignItems: 'center', justifyContent: 'center', marginRight: 11 },
 markText: { color: C.blue, fontSize: 17, fontWeight: '800' }, brandTitle: { color: C.text, fontSize: 12, fontWeight: '800', letterSpacing: .5 }, brandSub: { color: C.muted, fontSize: 11, marginTop: 4 },
 online: { marginLeft: 'auto', backgroundColor: '#E2EFE7', paddingVertical: 5, paddingHorizontal: 10, borderRadius: 6 }, onlineText: { color: C.green, fontSize: 10, fontWeight: '800' },
 title: { color: C.text, fontSize: 23, fontWeight: '800', letterSpacing: -.5 }, subtitle: { color: C.muted, fontSize: 12, marginTop: 6, marginBottom: 15, lineHeight: 18 },
 section: { color: C.text, fontWeight: '800', fontSize: 16, marginTop: 18, marginBottom: 12 }, card: { backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, borderRadius: 10, padding: 12 },
 row: { flexDirection: 'row', alignItems: 'center' }, spread: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 11 },
 metric: { flexGrow: 1, flexBasis: 145, backgroundColor: C.panel, borderColor: C.line, borderWidth: 1, borderRadius: 10, padding: 12, minHeight: 92 },
 metricLabel: { color: C.muted, fontSize: 11, fontWeight: '700' }, metricValue: { color: C.text, fontSize: 22, fontWeight: '800', marginTop: 8 }, metricFoot: { color: C.green, fontSize: 10, marginTop: 4 },
 banner: { borderRadius: 8, padding: 16, marginBottom: 13 }, eyebrow: { color: '#C7E3FF', fontSize: 10, fontWeight: '800', letterSpacing: 1 }, bannerTitle: { color: '#FFF', fontSize: 22, fontWeight: '800', marginTop: 8 }, bannerCopy: { color: '#D8E9FF', fontSize: 12, lineHeight: 18, marginTop: 6 },
 btn: { backgroundColor: C.blue, paddingVertical: 9, paddingHorizontal: 12, borderRadius: 6, alignItems: 'center', justifyContent: 'center' }, btnText: { color: '#FFF', fontSize: 12, fontWeight: '800' }, secondary: { backgroundColor: C.raised, borderWidth: 1, borderColor: C.line, padding: 9, borderRadius: 6, alignItems: 'center' }, secondaryText: { color: C.text, fontWeight: '700', fontSize: 12 },
 dividerRow: { paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: C.line }, orderId: { color: C.text, fontSize: 12, fontWeight: '800' }, small: { color: C.muted, fontSize: 11, marginTop: 4 }, price: { color: C.text, fontWeight: '800', fontSize: 12 },
 badge: { paddingVertical: 5, paddingHorizontal: 9, borderRadius: 10, alignSelf: 'flex-start' }, badgeText: { fontSize: 10, fontWeight: '800' },
 chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }, chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, backgroundColor: C.panel, borderWidth: 1, borderColor: C.line }, chipOn: { backgroundColor: C.blue, borderColor: C.blue }, chipText: { color: C.muted, fontSize: 11, fontWeight: '700' }, chipTextOn: { color: '#FFF' },
 input: { backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, color: C.text, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 9, fontSize: 12, marginTop: 6, marginBottom: 13 }, label: { color: C.muted, fontSize: 10, fontWeight: '800', marginTop: 3 },
 productRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: C.line, gap: 10 }, glyph: { width: 36, height: 36, borderRadius: 7, backgroundColor: '#E4E8ED', alignItems: 'center', justifyContent: 'center' }, glyphText: { color: C.cyan, fontWeight: '800', fontSize: 17 }, name: { color: C.text, fontSize: 12, fontWeight: '800' }, stockNum: { color: C.text, fontSize: 15, minWidth: 25, textAlign: 'center', fontWeight: '800' }, adjust: { backgroundColor: C.raised, width: 29, height: 29, borderRadius: 5, alignItems: 'center', justifyContent: 'center' },
 avatar: { width: 34, height: 34, borderRadius: 7, backgroundColor: '#DCE3EB', alignItems: 'center', justifyContent: 'center' }, avatarText: { color: '#285B91', fontWeight: '800', fontSize: 11 },
 modalShade: { flex: 1, justifyContent: 'center', padding: 18, backgroundColor: 'rgba(18,33,59,.45)' }, modal: { backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, borderRadius: 8, padding: 16, width: '100%', maxWidth: 460, alignSelf: 'center' },
});

export function Page({ title, subtitle, children }: PropsWithChildren<{ title: string; subtitle: string }>) {
 const { isOpen } = useShop();
 return <SafeAreaView style={S.page} edges={['top']}><ScrollView contentContainerStyle={S.content} keyboardShouldPersistTaps="handled">
  <View style={S.brand}><View style={S.mark}><Text style={S.markText}>T</Text></View><View><Text style={S.brandTitle}>TDP STORE PARTNER</Text><Text style={S.brandSub}>Tech Station · Colombo</Text></View><View style={[S.online, !isOpen && { backgroundColor: '#F5E6E9' }]}><Text style={[S.onlineText, !isOpen && { color: C.red }]}>{isOpen ? '● OPEN' : '● PAUSED'}</Text></View></View>
  <Text style={S.title}>{title}</Text><Text style={S.subtitle}>{subtitle}</Text>{children}
 </ScrollView></SafeAreaView>;
}
export function Card({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) { return <View style={[S.card, style]}>{children}</View>; }
export function Section({ children }: PropsWithChildren) { return <Text style={S.section}>{children}</Text>; }
export function Button({ label, onPress, secondary = false, style }: { label: string; onPress: () => void; secondary?: boolean; style?: StyleProp<ViewStyle> }) { return <Pressable onPress={onPress} style={[secondary ? S.secondary : S.btn, style]}><Text style={secondary ? S.secondaryText : S.btnText}>{label}</Text></Pressable>; }
const badgeTones: Record<string, [string, string]> = {
  New: [C.blue, '#E8F1FF'], Preparing: [C.amber, '#FFF3D9'], Ready: [C.cyan, '#E3F5F6'], Completed: [C.green, '#E8F5EE'],
  'Low stock': [C.red, '#FCE9ED'], 'Out of stock': [C.red, '#FCE9ED'], 'In stock': [C.green, '#E8F5EE'], Owner: [C.blue, '#E8F1FF'],
  'Ready for pickup': [C.cyan, '#E3F5F6'], 'Picked up': [C.blue, '#E8F1FF'], 'In transit': [C.amber, '#FFF3D9'], 'Out for delivery': [C.cyan, '#E3F5F6'], Delivered: [C.green, '#E8F5EE'],
 };
export function Badge({ value }: { value: string }) {
 const tone = badgeTones[value] ?? [C.muted, C.raised];
 return <View style={[S.badge, { backgroundColor: tone[1] }]}><Text style={[S.badgeText, { color: tone[0] }]}>{value}</Text></View>;
}
export function Metric({ label, value, foot }: { label: string; value: string; foot: string }) { return <View style={S.metric}><Text style={S.metricLabel}>{label}</Text><Text style={S.metricValue}>{value}</Text><Text style={S.metricFoot}>{foot}</Text></View>; }
