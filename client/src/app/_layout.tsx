import { Stack } from 'expo-router';
import { useState } from 'react';
import { Animated, useWindowDimensions, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView, initialWindowMetrics } from 'react-native-safe-area-context';
import LaunchIntro from '@/features/storefront/components/LaunchIntro';
import { StoreThemeProvider, useStoreTheme } from '@/features/storefront/ThemeContext';
import { ServerConnection } from '../components/ServerConnection';
import { CustomerAuthProvider } from '../features/auth/CustomerAuthContext';

export default function RootLayout() {
  return <SafeAreaProvider initialMetrics={initialWindowMetrics}><StoreThemeProvider><CustomerAuthProvider><AppShell /></CustomerAuthProvider></StoreThemeProvider></SafeAreaProvider>;
}

function AppShell() {
  const [transition] = useState(() => new Animated.Value(0));
  const { width } = useWindowDimensions();
  const { palette, mode } = useStoreTheme();
  return <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={{ flex: 1, backgroundColor: palette.background }}>
    <StatusBar hidden={false} style={mode === 'dark' ? 'light' : 'dark'} />
    <View style={{ flex: 1, overflow: 'hidden' }}>
    <Animated.View style={{ flex: 1, transform: [{ translateX: transition.interpolate({ inputRange: [0, 1], outputRange: [width, 0] }) }] }}>
      <ServerConnection><Stack screenOptions={{ headerShown: false }} /></ServerConnection>
    </Animated.View>
    <LaunchIntro transition={transition} />
  </View></SafeAreaView>;
}
