import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ServerConnection } from '../components/ServerConnection';
import { AppThemeProvider, useAppTheme } from '../AppearanceContext';
import AdminClerkProvider from '../auth/AdminClerkProvider';
import { AdminAccessProvider, useAdminAccess } from '../auth/AdminAccessContext';
import AccessFrame from '../auth/AccessFrame';
import { Text } from 'react-native';

export default function RootLayout() {
  return <SafeAreaProvider><AppThemeProvider><ConfiguredAdmin /></AppThemeProvider></SafeAreaProvider>;
}
function ConfiguredAdmin() {
  const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const { colors } = useAppTheme();
  if (!publishableKey) return <AccessFrame><Text style={{ color: colors.text }}>Admin sign-in is not configured.</Text><Text style={{ color: colors.muted }}>Set EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY in the admin app and restart Expo.</Text></AccessFrame>;
  return <AdminClerkProvider publishableKey={publishableKey}><AdminAccessProvider><AdminShell /></AdminAccessProvider></AdminClerkProvider>;
}
function AdminShell() {
  const { colors, mode } = useAppTheme();
  const { allowed } = useAdminAccess();
  return <><StatusBar style={mode === 'dark' ? 'light' : 'dark'} /><ServerConnection><Stack screenOptions={{ headerShown: false, title: 'NearBy Admin', contentStyle: { backgroundColor: colors.bg } }}>
    <Stack.Protected guard={allowed}><Stack.Screen name="index" /></Stack.Protected>
    <Stack.Protected guard={!allowed}><Stack.Screen name="login" options={{ title: 'Sign in · NearBy Admin' }} /></Stack.Protected>
  </Stack></ServerConnection></>;
}
