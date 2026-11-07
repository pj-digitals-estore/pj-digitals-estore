import { ActivityIndicator, Pressable, Text } from 'react-native';
import { useAppTheme } from '../AppearanceContext';
import { useHostedSignIn } from '../lib/useHostedSignIn';

export default function DeliverySignIn() {
  const { colors: c } = useAppTheme();
  const { busy, error, signIn, ready } = useHostedSignIn();
  return <><Text style={{ color: c.text, fontSize: 22, fontWeight: '700' }}>Sign in to your delivery account</Text>
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy || !ready, busy }} disabled={busy || !ready} onPress={() => void signIn()} style={{ padding: 16, minHeight: 48, backgroundColor: c.primary, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}>
      {busy || !ready ? <ActivityIndicator color={c.onPrimary} /> : <Text style={{ color: c.onPrimary, fontWeight: '700' }}>Continue with Clerk</Text>}
    </Pressable>
    {error ? <Text accessibilityRole="alert" style={{ color: c.red, lineHeight: 21 }}>{error}</Text> : null}
  </>;
}
