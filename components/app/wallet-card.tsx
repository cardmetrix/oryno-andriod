import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { WalletCardSkeleton } from '@/components/ui/skeletons';
import { Brand } from '@/constants/theme';
import { maskBalance } from '@/lib/format';

type Props = {
  balanceFormatted?: string;
  label?: string;
  loading?: boolean;
};

/** Matches oryno-website WalletCard: orange panel + Fund/Withdraw below. */
export function WalletCard({
  balanceFormatted = '₦0.00',
  label = 'NGN Wallet',
  loading,
}: Props) {
  const [hidden, setHidden] = useState(false);

  if (loading) return <WalletCardSkeleton />;

  return (
    <View style={styles.wrap}>
      <View style={styles.glow} />
      <View style={styles.shadowWrap}>
        <LinearGradient
          colors={['#FF8124', Brand.orange, '#E85D00']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.card}>
          <View pointerEvents="none" style={styles.overlayA} />
          <View pointerEvents="none" style={styles.overlayB} />

          <View style={styles.top}>
            <View style={styles.logoWell}>
              <Image
                source={require('@/assets/images/oryno-logo.png')}
                style={styles.logo}
                contentFit="cover"
              />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.brand}>ORYNO</Text>
              <Text style={styles.label}>{label}</Text>
            </View>
          </View>

          <View style={styles.balanceRow}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.available}>Available balance</Text>
              <Animated.Text
                key={hidden ? 'hidden' : balanceFormatted}
                entering={FadeIn.duration(180)}
                exiting={FadeOut.duration(120)}
                style={styles.balance}
                numberOfLines={1}>
                {maskBalance(hidden, balanceFormatted)}
              </Animated.Text>
            </View>
            <Pressable
              onPress={() => setHidden((v) => !v)}
              style={styles.eyeBtn}
              hitSlop={8}
              accessibilityLabel={hidden ? 'Show balance' : 'Hide balance'}>
              <Ionicons
                name={hidden ? 'eye-off' : 'eye'}
                size={16}
                color={Brand.white}
              />
            </Pressable>
          </View>
        </LinearGradient>
      </View>

      <View style={styles.actions}>
        <Pressable
          style={({ pressed }) => [styles.fundBtn, pressed && { opacity: 0.92, transform: [{ scale: 0.98 }] }]}
          onPress={() => router.push('/(app)/fund')}>
          <LinearGradient
            colors={['#FF8124', Brand.orange, '#E85D00']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.fundGradient}>
            <View style={styles.fundIcon}>
              <Ionicons name="add" size={18} color="#111" />
            </View>
            <Text style={styles.fundText}>Fund</Text>
          </LinearGradient>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.withdrawBtn, pressed && { opacity: 0.92, transform: [{ scale: 0.98 }] }]}
          onPress={() => router.push('/(app)/withdraw')}>
          <View style={styles.withdrawGlow} />
          <View style={styles.withdrawIcon}>
            <Ionicons name="arrow-up" size={16} color={Brand.white} />
          </View>
          <Text style={styles.withdrawText}>Withdraw</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  glow: {
    ...StyleSheet.absoluteFillObject,
    top: -8,
    bottom: 60,
    borderRadius: 32,
    backgroundColor: 'rgba(255,106,0,0.18)',
  },
  shadowWrap: {
    borderRadius: 24,
    shadowColor: Brand.orange,
    shadowOpacity: 0.3,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 14 },
    elevation: 8,
  },
  card: {
    borderRadius: 24,
    padding: 16,
    overflow: 'hidden',
    minHeight: 138,
  },
  overlayA: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  overlayB: {
    position: 'absolute',
    top: -40,
    right: -20,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,230,180,0.28)',
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    zIndex: 2,
  },
  logoWell: {
    width: 40,
    height: 40,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: Brand.orange,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  logo: {
    width: '100%',
    height: '100%',
    transform: [{ scale: 1.22 }],
  },
  brand: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2.2,
  },
  label: { color: Brand.white, fontSize: 14, fontWeight: '600', marginTop: 2 },
  balanceRow: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
  },
  available: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  balance: {
    color: Brand.white,
    fontSize: 28,
    fontWeight: '800',
    marginTop: 2,
    letterSpacing: -0.5,
  },
  eyeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  actions: { flexDirection: 'row', gap: 10 },
  fundBtn: {
    flex: 1,
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: Brand.orange,
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
  fundGradient: {
    height: 52,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 12,
  },
  fundIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fundText: { color: '#111', fontSize: 14, fontWeight: '800', letterSpacing: 0.2 },
  withdrawBtn: {
    flex: 1,
    height: 52,
    borderRadius: 18,
    backgroundColor: '#1A120C',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
  withdrawGlow: {
    position: 'absolute',
    right: -10,
    top: -20,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,106,0,0.22)',
  },
  withdrawIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  withdrawText: { color: Brand.white, fontSize: 14, fontWeight: '800', letterSpacing: 0.2 },
});
