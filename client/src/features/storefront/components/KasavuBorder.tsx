import { StyleSheet, View } from 'react-native';

/** A woven kasavu-inspired gold trim built from native views. */
export default function KasavuBorder() {
  return <View pointerEvents="none" accessible={false} style={styles.trim}>
    {Array.from({ length: 60 }, (_, index) => <View key={index} style={styles.diamond} />)}
  </View>;
}

const styles = StyleSheet.create({
  trim: { height: 7, overflow: 'hidden', flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 6, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#BA9650', backgroundColor: '#F1E5C8' },
  diamond: { width: 3, height: 3, backgroundColor: '#A87E31', transform: [{ rotate: '45deg' }] },
});
