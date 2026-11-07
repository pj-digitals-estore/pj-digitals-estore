import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ShopSignIn from './ShopSignIn';
import { useAuth, useClerk } from './clerkHooks';
import BrandLogo from '../components/BrandLogo';
import { useAppTheme } from '../AppearanceContext';
import LiveShopScreen from './LiveShopScreen';

export default function LiveShopRoot() {
  const { colors: c } = useAppTheme();
  const { isLoaded, isSignedIn, userId, getToken } = useAuth();
  const clerk = useClerk();
  // Clerk controls entry. Business APIs still enforce permissions on the server.
  if (isLoaded && isSignedIn && userId) return <LiveShopScreen key={userId} getToken={getToken} logout={() => clerk.signOut()} />;
  return <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
    <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}>
      <View style={{ maxWidth: 450, width: '100%', alignSelf: 'center', gap: 20 }}>
        <BrandLogo size={64} /><Text style={{ color: c.text, fontSize: 25, fontWeight: '800' }}>NearBy Shop</Text>
        {!isLoaded ? <ActivityIndicator color={c.primary} /> : <ShopSignIn />}
      </View>
    </ScrollView>
  </SafeAreaView>;
}
