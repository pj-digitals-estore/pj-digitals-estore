import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import Text from './AppText';
import { type Palette } from '../data/catalog';
import { useStoreTheme } from '../ThemeContext';
import type { Product, Store, StoreId } from '../data/types';



function ShopTile({ shop, index, count, onSelect }: { shop: Store; index: number; count: number; onSelect: (id: StoreId) => void }) {
  const { palette: colors } = useStoreTheme();
  const styles = createStyles(colors);
  const scale = useRef(new Animated.Value(1)).current;

  const press = (toValue: number) => Animated.spring(scale, { toValue, speed: 30, bounciness: 2, useNativeDriver: true }).start();

  return (
    <Animated.View style={[styles.tile, { transform: [{ scale }] }]}>
      <Pressable onPress={() => onSelect(shop.id)} onPressIn={() => press(0.98)} onPressOut={() => press(1)} accessibilityRole="button" accessibilityLabel={`Browse ${shop.name}, ${count} products`} style={styles.button}>
        <View style={styles.top}><View style={[styles.icon, index === 1 && styles.goldIcon]}><Text style={styles.symbol}>{shop.icon}</Text></View><Text style={styles.arrow}>↗</Text></View>
        <Text style={styles.name}>{shop.name}</Text>
        <Text style={styles.category}>{shop.id === 'textiles' ? 'Textiles & clothing' : 'Electronics'}</Text>
        <View style={styles.bottom}><View style={styles.dot} /><Text style={styles.count}>{count} items to explore</Text></View>
      </Pressable>
    </Animated.View>
  );
}

export default function HomeShops({ products, onSelect, shops: localShops }: { products: Product[]; onSelect: (id: StoreId) => void; shops: Store[] }) {
  const { palette: colors } = useStoreTheme();
  const styles = createStyles(colors);
  const translateX = useRef(new Animated.Value(0)).current;
  const [viewportWidth, setViewportWidth] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(true);
  const [paused, setPaused] = useState(false);
  // Each repeated group fills at least the viewport, including on desktop.
  const repeatCount = Math.max(1, Math.ceil(viewportWidth / (Math.max(1, localShops.length) * 242)));
  const groupWidth = localShops.length * 242 * repeatCount;

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => { if (mounted) setReducedMotion(value); }).catch(() => {});
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducedMotion);
    return () => { mounted = false; subscription.remove(); };
  }, []);

  useEffect(() => {
    if (reducedMotion || paused || !viewportWidth) return;
    // Finish the current pass before looping, so pausing never causes a jump.
    let active = true;
    let animation: Animated.CompositeAnimation | undefined;
    translateX.stopAnimation((position) => {
      if (!active) return;
      const offset = ((-position % groupWidth) + groupWidth) % groupWidth;
      translateX.setValue(-offset);
      animation = Animated.sequence([
        Animated.timing(translateX, { toValue: -groupWidth, duration: (groupWidth - offset) * 24, easing: Easing.linear, useNativeDriver: true, isInteraction: false }),
        Animated.loop(Animated.sequence([
          Animated.timing(translateX, { toValue: 0, duration: 0, useNativeDriver: true, isInteraction: false }),
          Animated.timing(translateX, { toValue: -groupWidth, duration: groupWidth * 24, easing: Easing.linear, useNativeDriver: true, isInteraction: false }),
        ])),
      ]);
      animation.start();
    });
    return () => { active = false; animation?.stop(); };
  }, [groupWidth, paused, reducedMotion, translateX, viewportWidth]);

  const renderGroup = (copy: number) => Array.from({ length: repeatCount }, (_, repetition) => localShops.map((shop, index) => <ShopTile key={`${copy}-${repetition}-${shop.id}`} shop={shop} index={index} count={products.filter((product) => product.store === shop.id).length} onSelect={onSelect} />));

  return <View style={styles.section}>
    <Text style={styles.eyebrow}>OUR TOWN. OUR SHOPS.</Text>
    <View style={styles.heading}><Text style={styles.title}>Discover local shops</Text><Pressable onPress={() => setPaused((value) => !value)} accessibilityRole="button" accessibilityLabel={paused ? 'Resume shop animation' : 'Pause shop animation'}><Text style={styles.total}>{paused ? '▶ PLAY' : 'Ⅱ PAUSE'}</Text></Pressable></View>
    {reducedMotion ? <View style={styles.staticGrid}>{localShops.map((shop, index) => <ShopTile key={shop.id} shop={shop} index={index} count={products.filter((product) => product.store === shop.id).length} onSelect={onSelect} />)}</View> :
      <View style={styles.viewport} onLayout={(event) => setViewportWidth(event.nativeEvent.layout.width)}>
        <Animated.View style={[styles.track, { width: groupWidth * 2, transform: [{ translateX }] }]}>
          <View style={[styles.group, { width: groupWidth }]}>{renderGroup(0)}</View>
          <View style={[styles.group, { width: groupWidth }]}>{renderGroup(1)}</View>
        </Animated.View>
      </View>}
  </View>;
}

const createStyles = (colors: Palette) => StyleSheet.create({
  section: { marginTop: 30, paddingTop: 22, borderTopWidth: 2, borderTopColor: colors.gold },
  eyebrow: { color: colors.gold, fontSize: 8, letterSpacing: 1, fontWeight: '900' },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 7, marginBottom: 14, gap: 8 },
  title: { color: colors.text, fontSize: 19, fontWeight: '800', flexShrink: 1 }, total: { color: colors.muted, fontSize: 8, fontWeight: '800', letterSpacing: 1 },
  viewport: { overflow: 'hidden', paddingVertical: 3 }, track: { flexDirection: 'row' }, group: { flexDirection: 'row', gap: 12, paddingRight: 12 }, staticGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tile: { width: 230, flexShrink: 0, borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  button: { padding: 17 }, top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  icon: { width: 45, height: 45, borderRadius: 14, backgroundColor: colors.soft, alignItems: 'center', justifyContent: 'center' }, goldIcon: { backgroundColor: colors.tint },
  symbol: { color: colors.primaryText, fontSize: 25 }, arrow: { color: colors.gold, fontSize: 22 },
  name: { color: colors.text, fontSize: 16, fontWeight: '800', marginTop: 15 }, category: { color: colors.muted, fontSize: 11, marginTop: 4 },
  bottom: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 18 }, dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.primary }, count: { color: colors.primaryText, fontSize: 10, fontWeight: '700' },
});
