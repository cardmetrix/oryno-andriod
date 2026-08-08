import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { Screen } from '@/components/ui/screen';
import { Brand, Radius, type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';
import {
  filterServices,
  serviceCategories,
  servicesDirectory,
  type ServiceDirectoryItem,
} from '@/lib/services-directory';

function chunkRows<T>(items: T[], size: number) {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) rows.push(items.slice(i, i + size));
  return rows;
}

export default function ServicesScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<(typeof serviceCategories)[number]>('All');

  const visible = useMemo(
    () => filterServices(servicesDirectory, { query, category }),
    [query, category],
  );
  const popularCount = servicesDirectory.filter((s) => s.popular).length;
  const rows = chunkRows(visible, 3);

  return (
    <Screen scroll>
      <Text style={styles.title}>All Services</Text>
      <Text style={styles.sub}>One app. Endless possibilities.</Text>

      <Animated.View entering={FadeInDown.duration(320)} style={styles.heroShell}>
        <LinearGradient
          colors={['#FF8124', Brand.orange, '#E85D00']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}>
          <View style={styles.heroGlow} />
          <View style={styles.heroTop}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={styles.eyebrow}>
                <Ionicons name="sparkles" size={13} color="#FFD29A" />
                <Text style={styles.eyebrowText}>CATALOG</Text>
              </View>
              <Text style={styles.heroTitle}>{servicesDirectory.length} services ready</Text>
              <Text style={styles.heroSub}>
                Airtime, data, bills, boosting, numbers — search or filter to jump in fast.
              </Text>
            </View>
            <View style={styles.popularBadge}>
              <Text style={styles.popularText}>{popularCount} popular</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.heroBody}>
          <View style={styles.searchWrap}>
            <Ionicons name="search" size={16} color={colors.grayMedium} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search airtime, DStv, Instagram…"
              placeholderTextColor={colors.grayMedium}
              style={styles.searchInput}
              autoCorrect={false}
              clearButtonMode="while-editing"
            />
            {query ? (
              <Pressable onPress={() => setQuery('')} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color={colors.grayMedium} />
              </Pressable>
            ) : null}
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chips}>
            {serviceCategories.map((item) => {
              const active = category === item;
              return (
                <Pressable
                  key={item}
                  onPress={() => setCategory(item)}
                  style={[styles.chip, active && styles.chipActive]}>
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{item}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </Animated.View>

      <View style={styles.gridWrap}>
        {visible.length === 0 ? (
          <Animated.View entering={FadeIn.duration(220)} style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ionicons name="search-outline" size={26} color={Brand.orange} />
            </View>
            <Text style={styles.emptyTitle}>No services found</Text>
            <Text style={styles.emptySub}>
              Try another keyword or clear filters to browse the full catalog.
            </Text>
            <Pressable
              style={styles.clearBtn}
              onPress={() => {
                setQuery('');
                setCategory('All');
              }}>
              <Text style={styles.clearText}>Clear search</Text>
            </Pressable>
          </Animated.View>
        ) : (
          <View style={styles.grid}>
            {rows.map((row, rowIndex) => (
              <View key={`row-${rowIndex}`} style={styles.gridRow}>
                {row.map((item, colIndex) => (
                  <ServiceCard
                    key={item.id}
                    item={item}
                    index={rowIndex * 3 + colIndex}
                  />
                ))}
                {row.length < 3
                  ? Array.from({ length: 3 - row.length }).map((_, i) => (
                      <View key={`pad-${i}`} style={styles.cardSpacer} />
                    ))
                  : null}
              </View>
            ))}
          </View>
        )}
      </View>
    </Screen>
  );
}

function ServiceCard({
  item,
  index,
}: {
  item: ServiceDirectoryItem;
  index: number;
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <Animated.View
      entering={FadeInDown.delay(Math.min(index * 40, 280)).duration(280)}
      style={styles.cardWrap}>
      <Pressable
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
        onPress={() => router.push(item.href as never)}>
        <LinearGradient
          colors={[item.accent, '#E85D00']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.iconWell}>
          {item.renderIcon(Brand.white, 22)}
          {item.soon ? (
            <View style={styles.soonBadge}>
              <Text style={styles.soonText}>SOON</Text>
            </View>
          ) : null}
        </LinearGradient>
        <Text style={styles.cardLabel} numberOfLines={2}>
          {item.label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.charcoal,
    marginTop: 8,
    letterSpacing: -0.4,
  },
  sub: {
    color: colors.grayMedium,
    marginBottom: 16,
    marginTop: 4,
    fontSize: 14,
    fontWeight: '500',
  },
  heroShell: {
    borderRadius: Radius.card,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.grayDivider,
    backgroundColor: colors.card,
    shadowColor: '#0F0F12',
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  hero: {
    paddingHorizontal: 18,
    paddingVertical: 18,
    overflow: 'hidden',
  },
  heroGlow: {
    position: 'absolute',
    top: -40,
    right: -30,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  eyebrow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  eyebrowText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.6,
  },
  heroTitle: {
    marginTop: 6,
    color: Brand.white,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  heroSub: {
    marginTop: 6,
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  popularBadge: {
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  popularText: { color: '#FFD29A', fontSize: 11, fontWeight: '800' },
  heroBody: { padding: 14, gap: 12 },
  searchWrap: {
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.grayDivider,
    backgroundColor: colors.grayLight,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: colors.charcoal,
  },
  chips: { gap: 8, paddingRight: 4 },
  chip: {
    borderRadius: 999,
    backgroundColor: colors.grayLight,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  chipActive: { backgroundColor: Brand.orange },
  chipText: { fontSize: 12, fontWeight: '700', color: colors.grayMedium },
  chipTextActive: { color: Brand.white },
  gridWrap: { marginTop: 18 },
  grid: { gap: 10 },
  gridRow: { flexDirection: 'row', gap: 10 },
  cardWrap: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 },
  cardSpacer: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 },
  card: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.grayDivider,
    backgroundColor: colors.card,
    paddingHorizontal: 10,
    paddingVertical: 16,
    minHeight: 124,
    overflow: 'hidden',
  },
  cardPressed: {
    borderColor: 'rgba(255,106,0,0.3)',
    backgroundColor: Brand.orangeMuted,
    transform: [{ scale: 0.97 }],
  },
  iconWell: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  soonBadge: {
    position: 'absolute',
    top: -6,
    right: -8,
    borderRadius: 999,
    backgroundColor: colors.charcoal,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  soonText: { color: Brand.white, fontSize: 8, fontWeight: '800' },
  cardLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.charcoal,
    textAlign: 'center',
    lineHeight: 15,
  },
  empty: {
    alignItems: 'center',
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: colors.grayDivider,
    backgroundColor: colors.card,
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: Brand.orangeMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: colors.charcoal },
  emptySub: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 19,
    color: colors.grayMedium,
    textAlign: 'center',
  },
  clearBtn: {
    marginTop: 16,
    borderRadius: 14,
    backgroundColor: colors.grayLight,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  clearText: { color: colors.charcoal, fontWeight: '700', fontSize: 13 },
});
}

