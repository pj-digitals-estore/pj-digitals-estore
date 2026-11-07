import { Stack, Tabs, usePathname, useRouter, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import ShopClerkProvider from '../live/ShopClerkProvider';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { PartnerLoadingScreen } from '../components/PartnerLoadingScreen';
import { ShopDataProvider } from '../context/ShopDataContext';
import { ShopAuthProvider, useShopAuth } from '../context/ShopAuthContext';
import { ShopLoginScreen } from '../screens/ShopLoginScreen';
import { ServerConnection } from '../components/ServerConnection';
import RightNavigation from '../components/RightNavigation';
import BrandLogo from '../components/BrandLogo';
import { StatusBar } from 'expo-status-bar';
import { AppThemeProvider, useAppTheme } from '../AppearanceContext';

const tabs = [
  { route: 'index', title: 'Home', icon: '⌂' },
  { route: 'orders', title: 'Orders', icon: '▤' },
  { route: 'deliveries', title: 'Deliveries', icon: '↗' },
  { route: 'products', title: 'Products', icon: '▦' },
  { route: 'advertisements', title: 'Advertisements', icon: '◈' },
  { route: 'inventory', title: 'Stock status', icon: '▣' },
  { route: 'store', title: 'Profile', icon: '○' },
];

export default function ShopLayout() {
  return <SafeAreaProvider><AppThemeProvider><ConfiguredShop /></AppThemeProvider></SafeAreaProvider>;
}
function ConfiguredShop() {
  const { colors: C } = useAppTheme();
  const key = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (!key) return <View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: C.bg }}><Text style={{ color: C.text }}>Set EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY in client_shop/.env.local, then restart Expo to enable sign-in.</Text></View>;
  return <ShopClerkProvider publishableKey={key}><ShopShell /></ShopClerkProvider>;
}
function ShopShell() {
  return process.env.EXPO_PUBLIC_SHOP_MODE !== 'demo' ? <Stack screenOptions={{ headerShown: false }}><Stack.Screen name="index" /><Stack.Screen name="account" /><Stack.Protected guard={false}>{tabs.filter(tab => tab.route !== 'index').map(tab => <Stack.Screen key={tab.route} name={tab.route} />)}</Stack.Protected></Stack> : <DemoShopShell />;
}
function DemoShopShell() {
  const { colors: C, mode } = useAppTheme();
  const [loading, setLoading] = useState(true);
  const finishLoading = useCallback(() => setLoading(false), []);
  return <ShopAuthProvider><StatusBar style={mode === 'dark' ? 'light' : 'dark'} /><View style={{ flex: 1, backgroundColor: C.bg }}>
    <View style={{ flex: 1 }} pointerEvents={loading ? 'none' : 'auto'} accessibilityElementsHidden={loading} importantForAccessibility={loading ? 'no-hide-descendants' : 'auto'}><ServerConnection><ShopNavigation /></ServerConnection></View>
    {loading ? <PartnerLoadingScreen onFinish={finishLoading} /> : null}
  </View></ShopAuthProvider>;
}

function ShopNavigation() {
  const { colors: C, mode, setMode } = useAppTheme();
  const menuColors = { glass: C.glass, text: C.text, muted: C.muted, accent: C.accent, border: C.border, selected: C.primary, selectedText: C.onPrimary, warning: C.red };
  const { account, logout } = useShopAuth();
  const router = useRouter();
  const pathname = usePathname();
  if (!account) return <ShopLoginScreen />;
  return <ShopDataProvider><SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top']}>
    <Tabs screenOptions={{ headerShown: false, tabBarStyle: { display: 'none' }, sceneStyle: { backgroundColor: C.bg } }}>
      <Tabs.Screen name="account" options={{ href: null, title: 'Account · NearBy Shop' }} />
      {tabs.map(({ route, title }) => <Tabs.Screen key={route} name={route} options={{ title: `${title} · NearBy Shop` }} />)}
    </Tabs>
    <RightNavigation brand={<BrandLogo size={48} />} mode={mode} onModeChange={setMode} title="NearBy Shop" subtitle={`${account.shopName} · Shop partner`} colors={menuColors} active={pathname.split('/').filter(Boolean).pop() || 'index'} items={tabs.map(tab => ({ id: tab.route, label: tab.title, icon: tab.icon }))} onSelect={route => router.navigate((route === 'index' ? '/' : `/${route}`) as Href)} onLogout={logout} />
  </SafeAreaView></ShopDataProvider>;
}
