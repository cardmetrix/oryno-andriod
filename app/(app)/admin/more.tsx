import { useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { Screen } from '@/components/ui/screen';
import { Brand, Radius, type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';
import { adminNav } from '@/lib/admin/nav';

const PRIMARY = new Set([
  '/(app)/admin',
  '/(app)/admin/users',
  '/(app)/admin/kyc',
  '/(app)/admin/wallets',
  '/(app)/admin/more',
]);

export default function AdminMoreScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const items = adminNav.filter((item) => !PRIMARY.has(item.href));

  return (
    <Screen scroll>
      <AdminPageHeader
        title="More"
        subtitle="All admin modules and console tools"
      />

      <View style={styles.grid}>
        {items.map((item) => (
          <Pressable
            key={item.href}
            style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
            onPress={() => router.push(item.href as never)}>
            <View style={styles.icon}>
              <Ionicons name={item.icon} size={20} color={Brand.orange} />
            </View>
            <Text style={styles.label}>{item.label}</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
  grid: { gap: 8 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  itemPressed: {
    backgroundColor: colors.orangeMuted,
    borderColor: 'rgba(255,106,0,0.2)',
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.foreground },
});
}

