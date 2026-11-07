import { UserProfile } from '@clerk/react';
import { Text } from 'react-native';
import { useAppTheme } from '../AppearanceContext';

export default function DeliveryAccountSettings() {
  const { colors: c } = useAppTheme();
  return <UserProfile routing="hash" fallback={<Text style={{ color: c.muted }}>Loading Clerk account…</Text>} appearance={{
    variables: { colorPrimary: c.primary, colorBackground: c.surface, colorForeground: c.text, colorMutedForeground: c.muted, borderRadius: '14px' },
    elements: { rootBox: { width: '100%', minWidth: 0 }, cardBox: { width: '100%', maxWidth: '100%', minWidth: 0 }, formFieldInput: { fontSize: 16 } },
  }} />;
}
