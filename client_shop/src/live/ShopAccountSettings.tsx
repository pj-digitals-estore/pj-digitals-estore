import { useEffect, useRef, useState } from 'react';
import { AppState, Image, Pressable, Text, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useClerk, useUser } from './clerkHooks';
import { useAppTheme } from '../AppearanceContext';

export default function ShopAccountSettings() {
  const { user } = useUser();
  const clerk = useClerk();
  const { colors: c } = useAppTheme();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') void user?.reload().catch(() => {});
    });
    return () => { mounted.current = false; subscription.remove(); };
  }, [user]);
  async function manage() {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError('');
    try {
      const url = new URL(clerk.buildUserProfileUrl());
      if (url.protocol !== 'https:') throw Error('Clerk account settings are not configured.');
      await WebBrowser.openBrowserAsync(url.href);
      await user?.reload();
    } catch (cause) { if (mounted.current) setError(cause instanceof Error ? cause.message : 'Unable to open Clerk settings.'); }
    finally { pending.current = false; if (mounted.current) setBusy(false); }
  }
  return <View style={{ padding: 20, gap: 16, backgroundColor: c.surface, borderColor: c.border, borderWidth: 1, borderRadius: 18 }}>
    {user?.imageUrl ? <Image accessibilityLabel="Your Clerk profile photo" source={{ uri: user.imageUrl }} style={{ width: 72, height: 72, borderRadius: 36 }} /> : null}
    <Text style={{ color: c.text, fontSize: 20, fontWeight: '700' }}>{user?.fullName || user?.username || 'Your account'}</Text>
    <Text style={{ color: c.muted }}>{user?.primaryEmailAddress?.emailAddress}</Text>
    <Text style={{ color: c.muted, lineHeight: 22 }}>Manage your photo, name, email, password and security in Clerk. Settings open in Clerk’s browser portal; you may need to sign in there.</Text>
    <Pressable accessibilityRole="button" disabled={busy} accessibilityState={{ disabled: busy }} onPress={() => void manage()} style={{ padding: 16, borderRadius: 12, backgroundColor: c.primary, opacity: busy ? 0.5 : 1 }}><Text style={{ color: c.onPrimary, textAlign: 'center', fontWeight: '700' }}>{busy ? 'Opening settings…' : 'Manage Clerk account'}</Text></Pressable>
    {error ? <Text accessibilityRole="alert" style={{ color: c.red }}>{error}</Text> : null}
  </View>;
}
