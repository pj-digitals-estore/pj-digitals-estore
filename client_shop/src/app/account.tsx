import { router } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '../AppearanceContext';
import { useAuth } from '../live/clerkHooks';
import ShopAccountSettings from '../live/ShopAccountSettings';
import ShopSignIn from '../live/ShopSignIn';

export default function AccountRoute() {
  const { colors: c } = useAppTheme();
  const { isLoaded, isSignedIn } = useAuth();
  return <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}><ScrollView contentContainerStyle={{ padding: 20, gap: 20, width: '100%', maxWidth: 1000, alignSelf: 'center' }}>
    <Pressable accessibilityRole="button" onPress={() => router.replace('/')} style={{ paddingVertical: 14 }}><Text style={{ color: c.primaryText }}>← Back to shop</Text></Pressable>
    <Text style={{ color: c.text, fontSize: 26, fontWeight: '800' }}>Clerk account settings</Text>
    {!isLoaded ? <ActivityIndicator color={c.primary} /> : isSignedIn ? <ShopAccountSettings /> : <ShopSignIn />}
  </ScrollView></SafeAreaView>;
}
