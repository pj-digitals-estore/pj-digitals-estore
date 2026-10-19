import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import type { Product } from '../data/types';
import { productImages } from '../data/product-images';

export default function ProductPhoto({ product }: { product: Product }) {
  const uri = productImages[product.id];
  const [failed, setFailed] = useState(false);
  return <View style={styles.frame}>
    {uri && !failed ? <Image source={{ uri }} resizeMode="contain" style={styles.image} accessibilityLabel={`${product.name} — illustrative demo photograph`} onError={() => setFailed(true)} /> : <Text style={styles.fallback}>Image unavailable</Text>}
  </View>;
}

const styles = StyleSheet.create({
  frame: { width: '100%', height: '100%', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: 10 },
  image: { width: '100%', height: '100%' }, fallback: { fontSize: 10, color: '#697568', textAlign: 'center' },
});
