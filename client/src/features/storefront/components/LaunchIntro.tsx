import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import PalmFrond from './PalmFrond';
import KasavuBorder from './KasavuBorder';

export default function LaunchIntro({ transition: exit }: { transition: Animated.Value }) {
  const { width } = useWindowDimensions();
  const [visible, setVisible] = useState(true);
  const entrance = useRef(new Animated.Value(0)).current;
  const loading = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let mounted = true;
    let animation: Animated.CompositeAnimation | undefined;
    const finish = () => { if (mounted) { exit.setValue(1); setVisible(false); } };
    void AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (!mounted) return;
      if (reduced) { finish(); return; }
      animation = Animated.parallel([
        Animated.timing(loading, { toValue: 1, duration: 3550, easing: Easing.linear, useNativeDriver: true, isInteraction: false }),
        Animated.sequence([
        Animated.timing(entrance, { toValue: 1, duration: 850, easing: Easing.out(Easing.cubic), useNativeDriver: true, isInteraction: false }),
        Animated.delay(2700),
        Animated.timing(exit, { toValue: 1, duration: 450, easing: Easing.inOut(Easing.quad), useNativeDriver: true, isInteraction: false }),
        ]),
      ]);
      animation.start(({ finished }) => { if (finished) finish(); });
    }).catch(finish);
    return () => { mounted = false; animation?.stop(); };
  }, [entrance, exit, loading]);

  if (!visible) return null;
  return <Animated.View style={[styles.overlay, { transform: [{ translateX: exit.interpolate({ inputRange: [0, 1], outputRange: [0, -width] }) }] }]} accessibilityViewIsModal accessibilityLabel="Welcome to TDP Store">
    <View style={styles.topTrim}><KasavuBorder /></View>
    <Animated.View pointerEvents="none" style={[styles.palmTop, { opacity: entrance, transform: [{ translateX: entrance.interpolate({ inputRange: [0, 1], outputRange: [45, 0] }) }] }]}><PalmFrond /></Animated.View>
    <Animated.View pointerEvents="none" style={[styles.palmBottom, { opacity: entrance, transform: [{ translateX: entrance.interpolate({ inputRange: [0, 1], outputRange: [-45, 0] }) }, { rotate: '180deg' }] }]}><PalmFrond /></Animated.View>
    <Animated.View style={[styles.center, { opacity: entrance, transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }] }]}>
      <View style={styles.halo}><View style={styles.logo}><Text style={styles.logoText}>TDP</Text></View></View>
      <Text style={styles.name}>TDP Store</Text>
      <View style={styles.ornament}><View style={styles.line} /><Text style={styles.flower}>✳</Text><View style={styles.line} /></View>
      <Text style={styles.local}>ROOTED IN THODUPUZHA</Text>
      <Text style={styles.tagline}>Your town. Your shops. Your doorstep.</Text>
    </Animated.View>
    <View style={styles.footer}>
      <Text style={styles.loadingLabel}>GETTING YOUR STORE READY</Text>
      <View style={styles.loadingTrack}><Animated.View style={[styles.loadingBar, { transform: [{ translateX: loading.interpolate({ inputRange: [0, 1], outputRange: [-220, 0] }) }] }]} /></View>
      <Text style={styles.footerText}>KERALA, WITH CARE</Text><Text style={styles.delivery}>Local favourites · Delivered within 12 hours</Text>
    </View>
    <View style={styles.bottomTrim}><KasavuBorder /></View>
  </Animated.View>;
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFill, zIndex: 1000, backgroundColor: '#10382A', alignItems: 'center', justifyContent: 'center' },
  topTrim: { position: 'absolute', top: 0, left: 0, right: 0 }, bottomTrim: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  palmTop: { position: 'absolute', right: 12, top: 85, transform: [{ scale: 1.6 }] }, palmBottom: { position: 'absolute', left: 8, bottom: 115 },
  center: { alignItems: 'center', paddingHorizontal: 24 }, halo: { borderWidth: 1, borderColor: 'rgba(229,199,133,0.35)', borderRadius: 50, padding: 9 },
  logo: { width: 80, height: 80, borderRadius: 40, borderWidth: 1, borderColor: '#E5C785', backgroundColor: '#194E3B', alignItems: 'center', justifyContent: 'center' }, logoText: { color: '#F0DDA8', fontSize: 24, fontWeight: '800', letterSpacing: 2 },
  name: { color: '#FFF8E8', fontSize: 36, fontWeight: '600', marginTop: 22, letterSpacing: -1 },
  ornament: { flexDirection: 'row', alignItems: 'center', gap: 15, marginTop: 17 }, line: { width: 43, height: 1, backgroundColor: '#A98A49' }, flower: { color: '#E5C785', fontSize: 18 },
  local: { color: '#E5C785', fontSize: 9, fontWeight: '800', letterSpacing: 2.3, marginTop: 18 }, tagline: { color: '#CFD8C7', fontSize: 12, marginTop: 10, textAlign: 'center' },
  loadingLabel: { color: '#CFD8C7', fontSize: 8, letterSpacing: 1.2, marginBottom: 10 },
  loadingTrack: { width: 220, height: 4, borderRadius: 4, backgroundColor: '#355646', marginBottom: 25, overflow: 'hidden' }, loadingBar: { width: '100%', height: 4, borderRadius: 4, backgroundColor: '#E5C785' },
  footer: { position: 'absolute', bottom: 45, alignItems: 'center', paddingHorizontal: 20 }, footerText: { color: '#E5C785', fontSize: 8, letterSpacing: 2, fontWeight: '700' }, delivery: { color: '#B7C9B6', fontSize: 10, marginTop: 8 },
});
