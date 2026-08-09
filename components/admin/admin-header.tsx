import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Brand, Radius, type ThemeColors } from '@/constants/theme';
import { useAdmin } from '@/context/admin-context';
import { useAppTheme } from '@/context/theme-context';
import { adminLogout } from '@/lib/admin/api';

export function AdminHeader() {
  const insets = useSafeAreaInsets();
  const { admin } = useAdmin();
  const { colors, isDark } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);

  async function onLogout() {
    await adminLogout();
    router.replace('/(app)/(tabs)' as never);
  }

  return (
    <View style={[styles.wrap, { paddingTop: Math.max(insets.top, 8) }]}>
      <View style={styles.row}>
        <View style={styles.left}>
          <View style={styles.logoWell}>
            <Image
              source={require('@/assets/images/oryno-icon.png')}
              style={styles.logo}
              contentFit="cover"
            />
          </View>
          <View style={styles.copy}>
            <Text style={styles.title}>ORYNO Admin</Text>
            <Text style={styles.sub} numberOfLines={1}>
              {admin
                ? `${admin.name} · ${admin.role.replace(/_/g, ' ')}`
                : 'Country-configurable control center'}
            </Text>
          </View>
        </View>

        <View style={styles.actions}>
          <View style={styles.livePill}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>Live</Text>
          </View>
          <Pressable
            onPress={onLogout}
            style={({ pressed }) => [styles.logout, pressed && { opacity: 0.9 }]}
            accessibilityLabel="Log out of admin">
            <Ionicons name="log-out-outline" size={18} color={colors.foreground} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function makeStyles(colors: ThemeColors, isDark: boolean) {
  return StyleSheet.create({
    wrap: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      backgroundColor: isDark ? 'rgba(15,15,18,0.96)' : 'rgba(255,255,255,0.96)',
      paddingHorizontal: 12,
      paddingBottom: 10,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      minHeight: 48,
    },
    left: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 },
    logoWell: {
      width: 36,
      height: 36,
      borderRadius: 999,
      overflow: 'hidden',
    },
    logo: { width: '100%', height: '100%', borderRadius: 999 },
    copy: { flex: 1, minWidth: 0 },
    title: { fontSize: 14, fontWeight: '800', color: colors.foreground },
    sub: { marginTop: 1, fontSize: 11, color: colors.mutedForeground, fontWeight: '500' },
    actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    livePill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    liveDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: Brand.success,
    },
    liveText: { fontSize: 11, fontWeight: '700', color: colors.foreground },
    logout: {
      width: 40,
      height: 40,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
}
