import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { WalletCardShine } from '@/components/app/wallet-card-shine';
import { Brand } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';
import { maskBalance } from '@/lib/format';

type Props = {
  currency: string;
  balanceFormatted: string;
  holderName: string;
  countryCode: string;
  status?: string;
  hidden: boolean;
  onToggleHidden: () => void;
};

/** Matches website /wallet local (primary) card — Fund/Withdraw inside gradient. */
export function WalletLocalCard({
  currency,
  balanceFormatted,
  holderName,
  countryCode,
  status = 'healthy',
  hidden,
  onToggleHidden,
}: Props) {
  const { colors } = useAppTheme();
  const protectedLabel = status === 'healthy' ? 'Protected' : status;

  return (
    <View style={[styles.shell, { backgroundColor: colors.card }]}>
      <LinearGradient
        colors={['#FF8124', Brand.orange, '#E85D00']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}>
        <View style={styles.glow} />
        <WalletCardShine intensity="bright" />

        <View style={styles.top}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={styles.eyebrow}>
              <Text style={styles.eyebrowText}>PRIMARY · {currency}</Text>
            </View>
            <Animated.Text
              key={hidden ? 'h' : balanceFormatted}
              entering={FadeIn.duration(180)}
              exiting={FadeOut.duration(120)}
              style={styles.balance}
              numberOfLines={1}>
              {maskBalance(hidden, balanceFormatted)}
            </Animated.Text>
            <Text style={styles.holder} numberOfLines={1}>
              {countryCode} wallet
            </Text>
          </View>

          <View style={styles.topRight}>
            <View style={styles.badge}>
              <Ionicons name="shield-checkmark" size={13} color="#FFD29A" />
              <Text style={styles.badgeText}>{protectedLabel}</Text>
            </View>
            <Pressable
              onPress={onToggleHidden}
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
        </View>

        <View style={styles.actions}>
          <Pressable
            style={({ pressed }) => [styles.fundBtn, pressed && { opacity: 0.92 }]}
            onPress={() => router.push('/(app)/fund')}>
            <Ionicons name="add" size={18} color="#111" />
            <Text style={styles.fundText}>Fund</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.withdrawBtn, pressed && { opacity: 0.92 }]}
            onPress={() => router.push('/(app)/withdraw')}>
            <Ionicons name="arrow-up" size={16} color={Brand.white} />
            <Text style={styles.withdrawText}>Withdraw</Text>
          </Pressable>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: '#0F0F12',
    shadowOpacity: 0.1,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  card: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    overflow: 'hidden',
    minHeight: 168,
  },
  glow: {
    position: 'absolute',
    top: -48,
    right: -40,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  eyebrow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  eyebrowText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.6,
  },
  balance: {
    marginTop: 6,
    color: Brand.white,
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  holder: {
    marginTop: 4,
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    fontWeight: '500',
  },
  topRight: { alignItems: 'flex-end', gap: 8 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  badgeText: {
    color: '#FFD29A',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'capitalize',
  },
  eyeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  actions: { marginTop: 16, flexDirection: 'row', gap: 10 },
  fundBtn: {
    flex: 1,
    height: 50,
    borderRadius: 16,
    backgroundColor: Brand.white,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  fundText: { color: '#111', fontSize: 15, fontWeight: '800' },
  withdrawBtn: {
    flex: 1,
    height: 50,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.25)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  withdrawText: { color: Brand.white, fontSize: 15, fontWeight: '800' },
});
