import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { WalletCardShine } from '@/components/app/wallet-card-shine';
import { Brand, Radius } from '@/constants/theme';
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

/** Matches website /wallet local card: bg-background shell + orange gradient inner. */
export function WalletLocalCard({
  currency,
  balanceFormatted,
  holderName,
  countryCode,
  status = 'healthy',
  hidden,
  onToggleHidden,
}: Props) {
  const { colors, isDark } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);
  const protectedLabel = status === 'healthy' ? 'Protected' : status;

  return (
    <View style={styles.shell}>
      <LinearGradient
        colors={['#FF8124', Brand.orange, '#E85D00']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}>
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
            style={({ pressed }) => [styles.cardsBtn, pressed && { opacity: 0.92 }]}
            onPress={() => router.push('/(app)/(tabs)/cards')}>
            <Ionicons name="card-outline" size={16} color={Brand.white} />
            <Text style={styles.cardsText}>Cards</Text>
          </Pressable>
        </View>
      </LinearGradient>
    </View>
  );
}

function makeStyles(colors: { background: string }, isDark: boolean) {
  return StyleSheet.create({
    shell: {
      borderRadius: Radius.card,
      overflow: 'hidden',
      backgroundColor: colors.background,
      shadowColor: '#0F0F12',
      shadowOpacity: isDark ? 0.28 : 0.06,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 4 },
      elevation: 4,
    },
    card: {
      paddingHorizontal: 16,
      paddingVertical: 14,
      overflow: 'hidden',
      minHeight: 140,
    },
    top: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    eyebrow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    eyebrowText: {
      color: 'rgba(255,255,255,0.8)',
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 1.4,
    },
    balance: {
      marginTop: 4,
      color: Brand.white,
      fontSize: 28,
      fontWeight: '800',
      letterSpacing: -0.6,
    },
    holder: {
      marginTop: 2,
      color: 'rgba(255,255,255,0.85)',
      fontSize: 12,
      fontWeight: '500',
    },
    topRight: { alignItems: 'flex-end', gap: 6 },
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      borderRadius: 999,
      backgroundColor: 'rgba(0,0,0,0.2)',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(255,255,255,0.2)',
    },
    badgeText: {
      color: '#FFD29A',
      fontSize: 10,
      fontWeight: '800',
      textTransform: 'capitalize',
    },
    eyeBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.2)',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(255,255,255,0.2)',
    },
    actions: { marginTop: 12, flexDirection: 'row', gap: 8 },
    fundBtn: {
      flex: 1,
      height: 42,
      borderRadius: 14,
      backgroundColor: Brand.white,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      shadowColor: '#000',
      shadowOpacity: 0.12,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 10 },
      elevation: 3,
    },
    fundText: { color: '#111', fontSize: 14, fontWeight: '800' },
    cardsBtn: {
      flex: 1,
      height: 42,
      borderRadius: 14,
      backgroundColor: 'rgba(0,0,0,0.25)',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(255,255,255,0.25)',
    },
    cardsText: { color: Brand.white, fontSize: 14, fontWeight: '800' },
  });
}
