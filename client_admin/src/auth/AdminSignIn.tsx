import { ActivityIndicator, Pressable, Text } from 'react-native';
import { useHostedSignIn } from '../lib/useHostedSignIn';
import { useAppTheme } from '../AppearanceContext';

export default function AdminSignIn() {
  const { colors: c } = useAppTheme();
  const { busy, error, signIn, ready } = useHostedSignIn();
  return <><Text style={{ color: c.text, fontSize: 20, fontWeight: '700' }}>Sign in securely</Text><Text style={{ color: c.muted, fontSize: 13, lineHeight: 21 }}>Continue with your Clerk account. The server will verify admin access before opening this workspace.</Text>
    {error ? <Text accessibilityRole="alert" style={{ color: c.red, lineHeight: 21 }}>{error}</Text> : null}
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy || !ready, busy }} disabled={busy || !ready} onPress={() => void signIn()} style={{ minHeight: 48, borderRadius: 12, padding: 14, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' }}>{busy || !ready ? <ActivityIndicator color={c.onPrimary} /> : <Text style={{ color: c.onPrimary, fontWeight: '700' }}>Continue with Clerk</Text>}</Pressable>
  </>;
}
