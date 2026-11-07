import type { ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '../AppearanceContext';
import BrandLogo from '../components/BrandLogo';

export default function AccessFrame({ children, subtitle = 'Authorized administrators only' }: { children: ReactNode; subtitle?: string }) {
  const { colors: c } = useAppTheme();
  return <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}><ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 20 }} keyboardShouldPersistTaps="handled"><View style={{ width: '100%', maxWidth: 460, alignSelf: 'center', gap: 22 }}>
    <View style={{ alignItems: 'center', gap: 10 }}><BrandLogo size={72} /><Text style={{ color: c.text, fontSize: 26, fontWeight: '800' }}>NearBy Admin</Text><Text style={{ color: c.muted, fontSize: 13, textAlign: 'center' }}>{subtitle}</Text></View>
    <View style={{ backgroundColor: c.surface, padding: 22, borderRadius: 22, borderWidth: 1, borderColor: c.border, gap: 16 }}>{children}</View>
  </View></ScrollView></SafeAreaView>;
}
