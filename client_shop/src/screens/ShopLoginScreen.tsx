import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BrandLogo from '../components/BrandLogo';
import { useShopStyles } from '../components/ShopUI';
import ShopSignIn from '../live/ShopSignIn';

export function ShopLoginScreen() {
  const { C, S } = useShopStyles();
  return <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}>
      <View style={{ width: '100%', maxWidth: 450, alignSelf: 'center', gap: 20 }}>
        <BrandLogo size={66} />
        <Text style={[S.title, { fontSize: 30 }]}>NearBy Shop</Text>
        <Text style={S.subtitle}>Sign in securely to your shop workspace.</Text>
        <ShopSignIn />
        <Text style={S.small}>Preview mode · Sample shop data only. Live mode verifies shop approval with the server.</Text>
      </View>
    </ScrollView>
  </SafeAreaView>;
}
