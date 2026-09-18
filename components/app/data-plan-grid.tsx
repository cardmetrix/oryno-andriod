import { Ionicons } from '@expo/vector-icons';
import { useMemo, useRef } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Brand, type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';
import {
  buildDataPlanFilters,
  parseDataPlanMeta,
  planMatchesFilter,
} from '@/lib/data-plans';

export type DataPlanOption = {
  id: string;
  name: string;
  amount: number;
};

type Props = {
  plans: DataPlanOption[];
  value: string;
  onChange: (id: string) => void;
  filter: string;
  onFilterChange: (filter: string) => void;
  formatMoney: (amount: number) => string;
  loading?: boolean;
};

const GAP = 8;

/** Plan type chips + 3-column cards — matches website `DataPlanGrid`. */
export function DataPlanGrid({
  plans,
  value,
  onChange,
  filter,
  onFilterChange,
  formatMoney,
  loading,
}: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { width: windowWidth } = useWindowDimensions();
  const scrollerRef = useRef<ScrollView>(null);
  const contentWidth = Math.max(windowWidth - 40, 280);
  const tileWidth = (contentWidth - GAP * 2) / 3;

  const filters = useMemo(
    () => buildDataPlanFilters(plans.map((p) => p.name)),
    [plans],
  );

  const activeFilter =
    filter && filters.includes(filter) ? filter : filters[0] || 'Weekly';

  const filtered = useMemo(() => {
    if (!activeFilter) return plans;
    return plans.filter((p) => planMatchesFilter(p.name, activeFilter));
  }, [plans, activeFilter]);

  return (
    <View style={styles.root}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>Select Plan Type</Text>
        {filters.length > 3 ? (
          <Pressable
            onPress={() => scrollerRef.current?.scrollTo({ x: 120, animated: true })}
            style={({ pressed }) => [styles.moreBtn, pressed && { opacity: 0.7 }]}
            hitSlop={8}
            accessibilityLabel="More plan types">
            <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
          </Pressable>
        ) : null}
      </View>

      <ScrollView
        ref={scrollerRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}>
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <View key={i} style={styles.filterSkel} />
            ))
          : filters.map((f) => {
              const active = f === activeFilter;
              return (
                <Pressable
                  key={f}
                  onPress={() => onFilterChange(f)}
                  style={[styles.filterChip, active && styles.filterChipActive]}>
                  <Text
                    style={[styles.filterText, active && styles.filterTextActive]}>
                    {f}
                  </Text>
                </Pressable>
              );
            })}
      </ScrollView>

      {loading ? (
        <View style={styles.grid}>
          {Array.from({ length: 6 }).map((_, i) => (
            <View key={i} style={[styles.skelTile, { width: tileWidth }]} />
          ))}
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No plans for this type</Text>
        </View>
      ) : (
        <View style={styles.grid}>
          {filtered.map((plan, index) => {
            const meta = parseDataPlanMeta(plan.name);
            const selected = value === plan.id;
            return (
              <Animated.View
                key={plan.id}
                entering={FadeInDown.delay(Math.min(index * 20, 180)).duration(240)}
                style={{ width: tileWidth }}>
                <Pressable
                  onPress={() => onChange(plan.id)}
                  style={({ pressed }) => [
                    styles.tile,
                    selected && styles.tileSelected,
                    pressed && { opacity: 0.92, transform: [{ scale: 0.98 }] },
                  ]}>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText} numberOfLines={1}>
                      {meta.badge}
                    </Text>
                  </View>
                  <Text style={styles.size} numberOfLines={1}>
                    {meta.size}
                  </Text>
                  <Text style={styles.price} numberOfLines={1}>
                    {formatMoney(plan.amount)}
                  </Text>
                  <Text style={styles.validity} numberOfLines={1}>
                    {meta.validity}
                  </Text>
                </Pressable>
              </Animated.View>
            );
          })}
        </View>
      )}
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: { gap: 12 },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    sectionTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.foreground,
    },
    moreBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    filterRow: {
      flexDirection: 'row',
      gap: 8,
      paddingBottom: 2,
    },
    filterSkel: {
      width: 80,
      height: 36,
      borderRadius: 999,
      backgroundColor: colors.muted,
    },
    filterChip: {
      borderRadius: 999,
      backgroundColor: colors.muted,
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    filterChipActive: { backgroundColor: Brand.orange },
    filterText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.foreground,
    },
    filterTextActive: { color: Brand.white },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: GAP,
    },
    skelTile: {
      height: 110,
      borderRadius: 16,
      backgroundColor: colors.muted,
    },
    empty: {
      borderRadius: 16,
      backgroundColor: colors.muted,
      paddingHorizontal: 16,
      paddingVertical: 36,
      alignItems: 'center',
    },
    emptyText: {
      fontSize: 13,
      fontWeight: '500',
      color: colors.mutedForeground,
    },
    tile: {
      borderRadius: 16,
      backgroundColor: colors.muted,
      paddingHorizontal: 10,
      paddingVertical: 12,
      gap: 4,
      borderWidth: 2,
      borderColor: 'transparent',
    },
    tileSelected: {
      borderColor: Brand.orange,
      backgroundColor: 'rgba(255,106,0,0.08)',
    },
    badge: {
      alignSelf: 'flex-start',
      borderRadius: 999,
      backgroundColor: Brand.orangeMuted,
      paddingHorizontal: 8,
      paddingVertical: 2,
      maxWidth: '100%',
    },
    badgeText: {
      fontSize: 10,
      fontWeight: '600',
      color: Brand.orange,
    },
    size: {
      marginTop: 4,
      fontSize: 16,
      fontWeight: '800',
      letterSpacing: -0.2,
      color: colors.foreground,
    },
    price: {
      fontSize: 14,
      fontWeight: '700',
      color: Brand.orange,
    },
    validity: {
      fontSize: 11,
      fontWeight: '500',
      color: colors.mutedForeground,
    },
  });
}
