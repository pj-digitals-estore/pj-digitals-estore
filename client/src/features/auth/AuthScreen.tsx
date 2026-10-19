import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { router, type Href } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import KasavuBorder from '@/features/storefront/components/KasavuBorder';

import { useStoreTheme } from '@/features/storefront/ThemeContext';
import type { Palette } from '@/features/storefront/data/catalog';

type AuthMode = 'login' | 'signup';

export default function AuthScreen({ mode }: { mode: AuthMode }) {
  const { palette } = useStoreTheme();
  const styles = createStyles(palette);
  const isLogin = mode === 'login';
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [providerMessage, setProviderMessage] = useState('');

  function submit(): void {
    if (!email.trim() || !password.trim() || (!isLogin && !name.trim())) {
      setMessage('Complete the required fields to continue.');
      return;
    }
    if (!isLogin && password !== confirmPassword) {
      setMessage('Your passwords do not match.');
      return;
    }
    setMessage(isLogin ? 'You are signed in. Welcome back to TDP Store!' : 'Your TDP Store account is ready. Welcome!');
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.content}>
            <View style={styles.header}>
              <TouchableOpacity onPress={() => router.back()} style={styles.backButton} accessibilityRole="button"><Text style={styles.backArrow}>‹</Text><Text style={styles.backText}>Back</Text></TouchableOpacity>
              <View style={styles.brandRow}><View style={styles.brandMark}><Text style={styles.brandMarkText}>TDP</Text></View><View><Text style={styles.brandName}>TDP Store</Text><Text style={styles.brandSub}>THODUPUZHA · KERALA</Text></View></View>
            </View>

            <KasavuBorder />
            <View style={styles.intro}>
              <View style={styles.artCircle}><Text style={styles.artLeaf}>❧</Text><Text style={styles.artStar}>✳</Text><Text style={styles.artBag}>▱</Text></View>
              <Text style={styles.eyebrow}>{isLogin ? 'WELCOME BACK' : 'SHOP LOCAL WITH TDP STORE'}</Text>
              <Text style={styles.title}>{isLogin ? 'Sign in to shop\nlocal favourites.' : 'Create your\nTDP Store account.'}</Text>
              <Text style={styles.subtitle}>{isLogin ? 'Your favourite Thodupuzha shops are ready when you are.' : 'Save your favourites and get local delivery updates.'}</Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>{isLogin ? 'Sign in' : 'Create account'}</Text>
              <Text style={styles.cardSubtitle}>{isLogin ? 'Enter your details to continue.' : 'It only takes a minute to get started.'}</Text>
              <View style={styles.socialButtons}>
                <TouchableOpacity style={styles.googleButton} onPress={() => setProviderMessage('Google sign-in is not connected yet. Please use email for now.')} accessibilityRole="button" accessibilityLabel="Continue with Google">
                  <Text style={styles.googleMark}>G</Text><Text style={styles.googleText}>Continue with Google</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.facebookButton} onPress={() => setProviderMessage('Facebook sign-in is not connected yet. Please use email for now.')} accessibilityRole="button" accessibilityLabel="Continue with Facebook">
                  <Text style={styles.facebookMark}>f</Text><Text style={styles.facebookText}>Continue with Facebook</Text>
                </TouchableOpacity>
              </View>
              {providerMessage ? <Text style={styles.providerMessage} accessibilityLiveRegion="polite">{providerMessage}</Text> : null}
              <View style={styles.divider}><View style={styles.dividerLine} /><Text style={styles.dividerText}>OR CONTINUE WITH EMAIL</Text><View style={styles.dividerLine} /></View>
              {!isLogin ? <><Text style={styles.label}>FULL NAME</Text><TextInput value={name} onChangeText={(value) => { setName(value); setMessage(''); }} placeholder="Your name" placeholderTextColor="#97A195" autoComplete="name" style={styles.input} /></> : null}
              <Text style={styles.label}>EMAIL ADDRESS</Text><TextInput value={email} onChangeText={(value) => { setEmail(value); setMessage(''); }} placeholder="you@example.com" placeholderTextColor="#97A195" autoCapitalize="none" autoComplete="email" keyboardType="email-address" style={styles.input} />
              <Text style={styles.label}>PASSWORD</Text><TextInput value={password} onChangeText={(value) => { setPassword(value); setMessage(''); }} placeholder="Enter your password" placeholderTextColor="#97A195" secureTextEntry autoComplete={isLogin ? 'current-password' : 'new-password'} style={styles.input} />
              {!isLogin ? <><Text style={styles.label}>CONFIRM PASSWORD</Text><TextInput value={confirmPassword} onChangeText={(value) => { setConfirmPassword(value); setMessage(''); }} placeholder="Enter your password again" placeholderTextColor="#97A195" secureTextEntry autoComplete="new-password" style={styles.input} /></> : null}
              {isLogin ? <Pressable onPress={() => setMessage('Password recovery will be available with the account service.')}><Text style={styles.forgot}>Forgot password?</Text></Pressable> : <Text style={styles.terms}>By creating an account, you agree to receive order and delivery updates from TDP Store.</Text>}
              <TouchableOpacity onPress={submit} style={styles.primaryButton} accessibilityRole="button"><Text style={styles.primaryText}>{isLogin ? 'Sign in' : 'Create account'}</Text><Text style={styles.primaryArrow}>→</Text></TouchableOpacity>
              {message ? <View style={styles.message}><Text style={styles.messageText}>{message}</Text>{message.includes('Welcome') ? <Pressable onPress={() => router.replace('/' as Href)}><Text style={styles.continueText}>Continue shopping →</Text></Pressable> : null}</View> : null}
              <View style={styles.divider}><View style={styles.dividerLine} /><Text style={styles.dividerText}>{isLogin ? 'NEW TO TDP STORE?' : 'ALREADY HAVE AN ACCOUNT?'}</Text><View style={styles.dividerLine} /></View>
              <TouchableOpacity onPress={() => router.replace((isLogin ? '/signup' : '/login') as Href)} style={styles.secondaryButton} accessibilityRole="button"><Text style={styles.secondaryText}>{isLogin ? 'Create an account' : 'Sign in instead'}</Text></TouchableOpacity>
            </View>

            <View style={styles.delivery}><Text style={styles.deliveryIcon}>◷</Text><Text style={styles.deliveryText}>Shop local stores. Delivered within 12 hours.</Text></View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (palette: Palette) => StyleSheet.create({
  socialButtons: { gap: 10 },
  googleButton: { minHeight: 48, paddingHorizontal: 15, borderRadius: 11, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface, flexDirection: 'row', alignItems: 'center', gap: 12 },
  googleMark: { color: '#4285F4', fontSize: 22, fontWeight: '800', width: 25, textAlign: 'center' }, googleText: { color: palette.text, fontSize: 12, fontWeight: '700', flex: 1, textAlign: 'center', marginRight: 25 },
  facebookButton: { minHeight: 48, paddingHorizontal: 15, borderRadius: 11, backgroundColor: '#1877F2', flexDirection: 'row', alignItems: 'center', gap: 12 },
  facebookMark: { color: '#FFFFFF', fontSize: 26, fontWeight: '900', width: 25, textAlign: 'center' }, facebookText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700', flex: 1, textAlign: 'center', marginRight: 25 },
  providerMessage: { color: palette.muted, fontSize: 11, lineHeight: 17, marginTop: 12 },
  screen: { flex: 1, backgroundColor: palette.background }, keyboard: { flex: 1 }, scroll: { paddingBottom: 34 }, content: { width: '100%', maxWidth: 520, alignSelf: 'center', paddingHorizontal: 20 },
  header: { minHeight: 74, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: palette.border }, backButton: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingVertical: 8 }, backArrow: { color: palette.primaryText, fontSize: 28, lineHeight: 28 }, backText: { color: palette.primaryText, fontSize: 10, fontWeight: '800' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8 }, brandMark: { width: 36, height: 36, borderRadius: 13, backgroundColor: palette.primary, alignItems: 'center', justifyContent: 'center' }, brandMarkText: { color: '#FFFFFF', fontSize: 9, fontWeight: '900', letterSpacing: 0.2 }, brandName: { color: palette.text, fontSize: 14, fontWeight: '800' }, brandSub: { color: palette.gold, fontSize: 7, letterSpacing: 0.9, fontWeight: '900', marginTop: 2 },
  intro: { alignItems: 'center', paddingTop: 26, paddingBottom: 22 }, artCircle: { width: 76, height: 76, marginBottom: 15, borderRadius: 38, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.soft, overflow: 'hidden' }, artBag: { color: palette.primaryText, fontSize: 48, fontWeight: '700', transform: [{ rotate: '180deg' }] }, artLeaf: { position: 'absolute', color: '#6F906E', fontSize: 29, right: 5, top: 2, transform: [{ rotate: '36deg' }] }, artStar: { position: 'absolute', color: palette.gold, fontSize: 17, left: 11, top: 19 }, eyebrow: { color: palette.gold, fontSize: 8, fontWeight: '900', letterSpacing: 1.25 }, title: { color: palette.text, fontSize: 30, fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia, serif' }), lineHeight: 36, textAlign: 'center', fontWeight: '800', marginTop: 8 }, subtitle: { color: palette.muted, fontSize: 11, lineHeight: 16, textAlign: 'center', maxWidth: 300, marginTop: 8 },
  card: { padding: 22, borderRadius: 18, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border }, cardTitle: { color: palette.text, fontSize: 19, fontWeight: '800' }, cardSubtitle: { color: palette.muted, fontSize: 10, marginTop: 5, marginBottom: 18 }, label: { color: palette.gold, fontSize: 8, letterSpacing: 0.9, fontWeight: '900', marginBottom: 7 }, input: { height: 47, borderRadius: 11, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface, color: palette.text, paddingHorizontal: 12, fontSize: 12, marginBottom: 15 }, forgot: { marginTop: -7, color: palette.primaryText, fontSize: 10, fontWeight: '800', textAlign: 'right' }, terms: { color: palette.muted, fontSize: 9, lineHeight: 14, marginTop: -4 },
  primaryButton: { height: 48, marginTop: 19, paddingHorizontal: 15, borderRadius: 11, backgroundColor: palette.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, primaryText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' }, primaryArrow: { color: '#F1DFAF', fontSize: 18, fontWeight: '800' }, message: { marginTop: 12, paddingHorizontal: 11, paddingVertical: 10, borderRadius: 10, backgroundColor: palette.soft, alignItems: 'center' }, messageText: { color: palette.primaryText, fontSize: 10, lineHeight: 14, textAlign: 'center' }, continueText: { color: palette.primaryText, fontSize: 10, fontWeight: '900', marginTop: 7 },
  divider: { marginVertical: 18, flexDirection: 'row', alignItems: 'center', gap: 8 }, dividerLine: { height: 1, flex: 1, backgroundColor: palette.border }, dividerText: { color: '#8E968B', fontSize: 7, fontWeight: '900', letterSpacing: 0.6 }, secondaryButton: { height: 45, borderRadius: 11, borderWidth: 1, borderColor: '#93B39D', alignItems: 'center', justifyContent: 'center' }, secondaryText: { color: palette.primaryText, fontSize: 11, fontWeight: '900' },
  delivery: { marginTop: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }, deliveryIcon: { color: palette.gold, fontSize: 14 }, deliveryText: { color: palette.muted, fontSize: 9, fontWeight: '700' },
});
