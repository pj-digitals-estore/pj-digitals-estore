import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BrandLogo from '../components/BrandLogo';
import DeliverySignIn from '../auth/DeliverySignIn';
import { useAppTheme } from '../AppearanceContext';

export default function DeliveryLoginScreen() {
  const { colors: c } = useAppTheme();
  return <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}>
      <View style={{ width: '100%', maxWidth: 450, alignSelf: 'center', gap: 20 }}>
        <BrandLogo size={66} />
        <Text style={{ color: c.accent, fontSize: 11, fontWeight: '800', letterSpacing: 2 }}>NEARBY · DELIVERY</Text>
        <Text style={{ color: c.text, fontSize: 30, fontWeight: '800' }}>Welcome back.</Text>
        <Text style={{ color: c.muted, lineHeight: 22 }}>Sign in securely to your delivery workspace.</Text>
        <DeliverySignIn />
        <Text style={{ color: c.muted, fontSize: 12, lineHeight: 20 }}>Your session is managed by Clerk. Orders are loaded for your signed-in account.</Text>
      </View>
    </ScrollView>
  </SafeAreaView>;
}
