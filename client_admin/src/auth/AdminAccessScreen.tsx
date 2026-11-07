import { ActivityIndicator, Pressable, Text } from 'react-native';
import { useAppTheme } from '../AppearanceContext';
import { useAdminAccess } from './AdminAccessContext';
import AccessFrame from './AccessFrame';
import AdminSignIn from './AdminSignIn';

export default function AdminAccessScreen() {
  const access = useAdminAccess();
  const { colors: c } = useAppTheme();
  return <AccessFrame>
    {!access.ready ? <><ActivityIndicator color={c.primaryText} /><Text style={{ color: c.muted }}>Loading secure sign-in…</Text></> : !access.signedIn ? <AdminSignIn /> : <>
      {access.status === 'checking' || access.allowed ? <><ActivityIndicator color={c.primaryText} /><Text style={{ color: c.text }}>Verifying admin access…</Text></> : <>
        <Text style={{ color: c.text, fontSize: 20, fontWeight: '700' }}>{access.status === 'denied' ? 'Admin access required' : 'Access verification unavailable'}</Text>
        <Text accessibilityRole="alert" style={{ color: c.muted, fontSize: 13, lineHeight: 22 }}>{access.message}</Text>
        {access.email ? <Text style={{ color: c.primaryText, fontSize: 12 }}>Signed in as {access.email}</Text> : null}
        <Pressable accessibilityRole="button" onPress={access.retry} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={{ color: c.primaryText, fontWeight: '700' }}>Retry access check</Text></Pressable>
      </>}
      <Pressable accessibilityRole="button" onPress={() => void access.signOut()} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: c.red, fontWeight: '700' }}>Sign out / use another account</Text></Pressable>
    </>}
  </AccessFrame>;
}
