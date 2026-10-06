import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AdCarousel } from '@/components/app/ad-carousel';
import { PageHeader } from '@/components/app/page-header';
import { ServiceActionCard } from '@/components/app/service-action-card';
import { Screen } from '@/components/ui/screen';
import { Brand, Radius, type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';
import { useProfile } from '@/hooks/use-profile';
import {
  filterServices,
  getServicesDirectory,
  serviceCategories,
} from '@/lib/services-directory';

function chunkRows<T>(items: T[], size: number) {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) rows.push(items.slice(i, i + size));
  return rows;
}

export function AllServicesScreen({ showBack = false }: { showBack?: boolean }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { countryCode } = useProfile();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<(typeof serviceCategories)[number]>('All');
  const directory = useMemo(
    () => getServicesDirectory(countryCode),
    [countryCode],
  );

  const visible = useMemo(
    () => filterServices(directory, { query, category }),
    [directory, query, category],
  );
  const popularCount = directory.filter((s) => s.popular).length;
  const rows = chunkRows(visible, 3);

  return (
    <Screen
      scroll
      header={
        showBack ? (
          <PageHeader
            title="All Services"
            subtitle="Your Digital World, Simplified."
          />
        ) : (
          <View>
            <Text style={styles.title}>All Services</Text>
            <Text style={styles.sub}>Your Digital World, Simplified.</Text>
          </View>
        )
      }>
      <View style={styles.heroShell}>
        <LinearGradient
          colors={['#FF8124', Brand.orange, '#E85D00']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}>
          <View style={styles.heroGlow} />
          <View style={styles.heroTop}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.eyebrowText}>
                CATALOG · {directory.length} SERVICES
              </Text>
              <Text style={styles.heroSub} numberOfLines={1}>
                Airtime, data, electricity, TV, betting & more
              </Text>
            </View>
            <View style={styles.popularBadge}>
              <Text style={styles.popularText}>{popularCount} popular</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.heroBody}>
          <View style={styles.searchWrap}>
            <Ionicons name="search" size={14} color={colors.grayMedium} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search electricity, airtime, DStv…"
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
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {item}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </View>

      <View style={styles.gridWrap}>
        {visible.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ionicons name="search-outline" size={22} color={Brand.orange} />
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
          </View>
        ) : (
          <View style={styles.grid}>
            {rows.map((row, rowIndex) => (
              <View key={`row-${rowIndex}`} style={styles.gridRow}>
                {row.map((item, colIndex) => {
                  const index = rowIndex * 3 + colIndex;
                  return (
                    <ServiceActionCard
                      key={item.id}
                      label={item.label}
                      href={item.href}
                      index={index}
                      size="md">
                      {item.renderIcon(Brand.white, 24)}
                    </ServiceActionCard>
                  );
                })}
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

      <AdCarousel placement="services_carousel" reserveSpaceWhileLoading={false} />
    </Screen>
  );
}

export default function ServicesTabScreen() {
  return <AllServicesScreen />;
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    title: {
      fontSize: 24,
      fontWeight: '800',
      color: colors.charcoal,
      marginTop: 0,
      letterSpacing: -0.4,
    },
    sub: {
      color: colors.grayMedium,
      marginBottom: 0,
      marginTop: 2,
      fontSize: 13,
      fontWeight: '500',
    },
    heroShell: {
      borderRadius: 20,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.grayDivider,
      backgroundColor: colors.card,
      shadowColor: '#0F0F12',
      shadowOpacity: 0.05,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 2,
    },
    hero: {
      paddingHorizontal: 14,
      paddingVertical: 10,
      overflow: 'hidden',
    },
    heroGlow: {
      position: 'absolute',
      top: -32,
      right: -24,
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: 'rgba(255,255,255,0.15)',
    },
    heroTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    eyebrowText: {
      color: 'rgba(255,255,255,0.75)',
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 1.2,
    },
    heroSub: {
      marginTop: 2,
      color: 'rgba(255,255,255,0.85)',
      fontSize: 12,
      fontWeight: '500',
    },
    popularBadge: {
      borderRadius: 999,
      backgroundColor: 'rgba(0,0,0,0.2)',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(255,255,255,0.2)',
    },
    popularText: { color: '#FFD29A', fontSize: 10, fontWeight: '800' },
    heroBody: { padding: 12, gap: 8 },
    searchWrap: {
      height: 36,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.grayDivider,
      backgroundColor: colors.grayLight,
      paddingHorizontal: 10,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    searchInput: {
      flex: 1,
      fontSize: 13,
      fontWeight: '600',
      color: colors.charcoal,
      paddingVertical: 0,
    },
    chips: { gap: 6, paddingRight: 4 },
    chip: {
      borderRadius: 999,
      backgroundColor: colors.grayLight,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    chipActive: { backgroundColor: Brand.charcoal },
    chipText: { fontSize: 11, fontWeight: '600', color: colors.grayMedium },
    chipTextActive: { color: Brand.white },
    gridWrap: { marginTop: 12 },
    grid: { gap: 12 },
    gridRow: { flexDirection: 'row', gap: 12 },
    cardSpacer: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 },
    empty: {
      alignItems: 'center',
      borderRadius: Radius.card,
      borderWidth: 1,
      borderColor: colors.grayDivider,
      backgroundColor: colors.card,
      paddingHorizontal: 24,
      paddingVertical: 48,
    },
    emptyIcon: {
      width: 56,
      height: 56,
      borderRadius: 16,
      backgroundColor: Brand.orangeMuted,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
    },
    emptyTitle: { fontSize: 18, fontWeight: '800', color: colors.charcoal },
    emptySub: {
      marginTop: 6,
      fontSize: 14,
      lineHeight: 20,
      color: colors.grayMedium,
      textAlign: 'center',
      maxWidth: 320,
    },
    clearBtn: {
      marginTop: 20,
      height: 44,
      borderRadius: 14,
      backgroundColor: colors.grayLight,
      paddingHorizontal: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    clearText: { color: colors.charcoal, fontWeight: '700', fontSize: 14 },
  });
}
