import { StyleSheet, View } from 'react-native';

export default function PalmFrond() {
  return <View style={styles.frond} pointerEvents="none" accessible={false}>
    <View style={styles.stem} />
    {Array.from({ length: 7 }, (_, index) => <View key={index}>
      <View style={[styles.leaf, { top: index * 15 + 8, left: 49, width: 58 - index * 5, transform: [{ rotate: '-34deg' }] }]} />
      <View style={[styles.leaf, { top: index * 15 + 8, right: 49, width: 58 - index * 5, transform: [{ rotate: '34deg' }] }]} />
    </View>)}
  </View>;
}

const styles = StyleSheet.create({
  frond: { width: 110, height: 135, opacity: 0.3, transform: [{ rotate: '-30deg' }] },
  stem: { position: 'absolute', left: 53, top: 0, width: 1, height: 130, backgroundColor: '#E5C785' },
  leaf: { position: 'absolute', height: 9, borderTopLeftRadius: 18, borderBottomRightRadius: 18, backgroundColor: '#E5C785' },
});
