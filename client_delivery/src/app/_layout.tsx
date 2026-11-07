import { Stack } from 'expo-router';
import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import DeliveryClerkProvider from '../auth/DeliveryClerkProvider';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DeliveryAuthProvider } from '../context/DeliveryAuthContext';
import { DeliveryLoadingScreen } from '../components/DeliveryLoadingScreen';
import { ServerConnection } from '../components/ServerConnection';
import { AppThemeProvider, useAppTheme } from '../AppearanceContext';

export default function RootLayout() {
  return <SafeAreaProvider><AppThemeProvider><ConfiguredDelivery /></AppThemeProvider></SafeAreaProvider>;
}
function ConfiguredDelivery() {
  const { colors: c } = useAppTheme();
  const key = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (!key) return <View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: c.bg }}><Text style={{ color: c.text }}>Set EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY in client_delivery/.env.local, then restart Expo to enable sign-in.</Text></View>;
  return <DeliveryClerkProvider publishableKey={key}><DeliveryShell /></DeliveryClerkProvider>;
}
function DeliveryShell() {
  const { colors: C, mode } = useAppTheme();
  const [loading, setLoading] = useState(true);
  const finishLoading = useCallback(() => setLoading(false), []);
  return <DeliveryAuthProvider><StatusBar style={mode === 'dark' ? 'light' : 'dark'} /><View style={{ flex: 1, backgroundColor: C.bg }}>
    <View style={{ flex: 1 }} pointerEvents={loading ? 'none' : 'auto'} accessibilityElementsHidden={loading} importantForAccessibility={loading ? 'no-hide-descendants' : 'auto'}><ServerConnection><Stack screenOptions={{ headerShown: false, title: 'NearBy Delivery' }} /></ServerConnection></View>
    {loading ? <DeliveryLoadingScreen onFinish={finishLoading} /> : null}
  </View></DeliveryAuthProvider>;
}
