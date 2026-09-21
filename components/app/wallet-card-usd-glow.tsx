import { StyleSheet, View } from 'react-native';

/**
 * Soft radial highlights for the USD card — View-based so we avoid
 * react-native-svg percentage Rect / rgba Stop quirks that paint white.
 */
export function WalletCardUsdGlow() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={styles.orange} />
      <View style={styles.ash} />
    </View>
  );
}

const styles = StyleSheet.create({
  orange: {
    position: 'absolute',
    top: -40,
    right: -28,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,106,0,0.1)',
  },
  ash: {
    position: 'absolute',
    bottom: -36,
    left: -24,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
});
