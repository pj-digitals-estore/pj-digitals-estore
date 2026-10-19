import { Stack } from 'expo-router';
import { useRef } from 'react';
import { Animated, useWindowDimensions, View } from 'react-native';
import LaunchIntro from '@/features/storefront/components/LaunchIntro';
import { StoreThemeProvider } from '@/features/storefront/ThemeContext';

export default function RootLayout() {
  const transition = useRef(new Animated.Value(0)).current;
  const { width } = useWindowDimensions();
  return <StoreThemeProvider><View style={{ flex: 1, overflow: 'hidden' }}>
    <Animated.View style={{ flex: 1, transform: [{ translateX: transition.interpolate({ inputRange: [0, 1], outputRange: [width, 0] }) }] }}>
      <Stack screenOptions={{ headerShown: false }} />
    </Animated.View>
    <LaunchIntro transition={transition} />
  </View></StoreThemeProvider>;
}
