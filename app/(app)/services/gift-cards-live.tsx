import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { GiftCardBrandLogo } from '@/components/app/gift-card-brand-logo';
import { PageHeader } from '@/components/app/page-header';
import { SelectSheet } from '@/components/app/picker-sheet';
import { Screen } from '@/components/ui/screen';
import { Brand, type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';
import { api } from '@/lib/api';
import { endpoints } from '@/lib/endpoints';
import { giftCardRateChangePercent } from '@/lib/gift-cards';

type Mode = 'sell' | 'buy';

type SellBrand = {
  slug: string;
  name: string;
  category: string;
  image: string;
  currencies: string[];
  denominations: number[];
  cardTypes: Array<'ecode' | 'physical'>;
  requiresPin: boolean;
  active: boolean;
};

type BuyProduct = {
  productId: number;
  name: string;
  brandName: string;
  countryCode: string;
  image: string;
  imageFallbacks?: string[];
  denominationType: string;
  recipientCurrency: string;
  denominations: number[];
  minAmount: number | null;
  maxAmount: number | null;
};

const FALLBACK_BUY_COUNTRIES = [
  { code: 'US', label: 'United States' },
  { code: 'GB', label: 'United Kingdom' },
  { code: 'NG', label: 'Nigeria' },
  { code: 'CA', label: 'Canada' },
  { code: 'AU', label: 'Australia' },
];

function formatNairaRate(rate: number) {
  return `₦${rate.toLocaleString('en-NG')}`;
}

export default function GiftCardsLiveScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [mode, setMode] = useState<Mode>('sell');

  const [sellBrands, setSellBrands] = useState<SellBrand[]>([]);
  const [rateMap, setRateMap] = useState<Record<string, number | null>>({});
  const [sellLoading, setSellLoading] = useState(true);
  const [sellDemo, setSellDemo] = useState(false);
  const [sellQuery, setSellQuery] = useState('');
  const [sellCategory, setSellCategory] = useState('All');
  const [sellError, setSellError] = useState<string | null>(null);

  const [buyProducts, setBuyProducts] = useState<BuyProduct[]>([]);
  const [buyCountries, setBuyCountries] = useState(FALLBACK_BUY_COUNTRIES);
  const [buyLoading, setBuyLoading] = useState(false);
  const [buyError, setBuyError] = useState<string | null>(null);
  const [buyDemo, setBuyDemo] = useState(false);
  const [buySandbox, setBuySandbox] = useState(false);
  const [buyQuery, setBuyQuery] = useState('');
  const [buyCountry, setBuyCountry] = useState('US');
  const [refreshing, setRefreshing] = useState(false);

  const sellCategories = useMemo(() => {
    const set = new Set(sellBrands.map((b) => b.category).filter(Boolean));
    return ['All', ...Array.from(set).sort()];
  }, [sellBrands]);

  const filteredSell = useMemo(() => {
    const q = sellQuery.trim().toLowerCase();
    return sellBrands.filter((b) => {
      if (sellCategory !== 'All' && b.category !== sellCategory) return false;
      if (!q) return true;
      return (
        b.name.toLowerCase().includes(q) ||
        b.slug.includes(q) ||
        b.category.toLowerCase().includes(q)
      );
    });
  }, [sellBrands, sellQuery, sellCategory]);

  const filteredBuy = useMemo(() => {
    const q = buyQuery.trim().toLowerCase();
    if (!q) return buyProducts;
    return buyProducts.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.brandName.toLowerCase().includes(q),
    );
  }, [buyProducts, buyQuery]);

  const loadSell = useCallback(async () => {
    setSellLoading(true);
    setSellError(null);
    try {
      const [catalog, ratesJson] = await Promise.all([
        api.get<{ brands?: SellBrand[]; demo?: boolean }>(
          endpoints.services.giftCardSellCatalog,
        ),
        api
          .get<{
            simplified?: Array<{ slug?: string; ratePerUnit?: number }>;
            demo?: boolean;
          }>(`${endpoints.services.giftCardSellRates}?currency=USD&cardType=ecode`)
          .catch(() => ({ simplified: [] as Array<{ slug?: string; ratePerUnit?: number }>, demo: false })),
      ]);
      setSellBrands((catalog.brands ?? []).filter((b) => b.active !== false));
      setSellDemo(Boolean(catalog.demo || ratesJson.demo));

      const map: Record<string, number | null> = {};
      const rows = Array.isArray(ratesJson.simplified) ? ratesJson.simplified : [];
      for (const row of rows) {
        if (row?.slug) {
          map[row.slug] =
            typeof row.ratePerUnit === 'number' ? row.ratePerUnit : null;
        }
      }
      setRateMap(map);
    } catch (e) {
      setSellBrands([]);
      setRateMap({});
      setSellError(e instanceof Error ? e.message : 'Failed to load sell rates');
    } finally {
      setSellLoading(false);
    }
  }, []);

  const loadBuyCountries = useCallback(async () => {
    try {
      const data = await api.get<{
        countries?: Array<{ code: string; label: string }>;
        demo?: boolean;
        sandbox?: boolean;
      }>(endpoints.services.giftCardCountries);
      const rows = Array.isArray(data.countries) ? data.countries : [];
      if (rows.length) {
        setBuyCountries(
          rows.map((c) => ({
            code: String(c.code).toUpperCase(),
            label: String(c.label),
          })),
        );
        setBuyCountry((prev) => {
          const codes = new Set(rows.map((c) => String(c.code).toUpperCase()));
          return codes.has(prev) ? prev : String(rows[0].code).toUpperCase();
        });
      }
      setBuyDemo(Boolean(data.demo));
      setBuySandbox(Boolean(data.sandbox));
    } catch {
      setBuyCountries(FALLBACK_BUY_COUNTRIES);
    }
  }, []);

  const loadBuy = useCallback(async () => {
    setBuyLoading(true);
    setBuyError(null);
    try {
      const data = await api.get<{
        products?: BuyProduct[];
        demo?: boolean;
        sandbox?: boolean;
      }>(
        `${endpoints.services.giftCardProducts}?countryCode=${encodeURIComponent(buyCountry)}`,
      );
      setBuyProducts(data.products ?? []);
      setBuyDemo(Boolean(data.demo));
      setBuySandbox(Boolean(data.sandbox));
    } catch (e) {
      setBuyProducts([]);
      setBuyError(e instanceof Error ? e.message : 'Failed to load gift cards');
    } finally {
      setBuyLoading(false);
    }
  }, [buyCountry]);

  useEffect(() => {
    void loadSell();
  }, [loadSell]);

  useEffect(() => {
    if (mode === 'buy') void loadBuyCountries();
  }, [mode, loadBuyCountries]);

  useEffect(() => {
    if (mode === 'buy') void loadBuy();
  }, [mode, loadBuy]);

  async function onRefresh() {
    setRefreshing(true);
    try {
      if (mode === 'sell') await loadSell();
      else {
        await loadBuyCountries();
        await loadBuy();
      }
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <Screen scroll refreshing={refreshing} onRefresh={() => void onRefresh()}>
      <PageHeader
        title="Gift Card Live"
        subtitle="Live rates · tap a card to trade"
        showBack
      />

      <View style={styles.modeTabs}>
        {(['sell', 'buy'] as const).map((tab) => {
          const active = mode === tab;
          return (
            <Pressable
              key={tab}
              onPress={() => setMode(tab)}
              style={[styles.modeTab, active && styles.modeTabActive]}>
              <Text style={[styles.modeTabText, active && styles.modeTabTextActive]}>
                {tab === 'sell' ? 'Sell' : 'Buy'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {mode === 'sell' ? (
        <View style={styles.stack}>
          <Animated.View entering={FadeInDown.duration(280)} style={styles.card}>
            <View style={styles.searchWrap}>
              <Ionicons name="search" size={16} color={colors.mutedForeground} />
              <TextInput
                value={sellQuery}
                onChangeText={setSellQuery}
                placeholder="Search Amazon, Apple, Steam…"
                placeholderTextColor={colors.mutedForeground}
                style={styles.searchInput}
                autoCorrect={false}
                autoCapitalize="none"
              />
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRow}>
              {sellCategories.map((c) => {
                const active = sellCategory === c;
                return (
                  <Pressable
                    key={c}
                    onPress={() => setSellCategory(c)}
                    style={[styles.chip, active && styles.chipActive]}>
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {c}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </Animated.View>

          <Animated.View
            entering={FadeInDown.delay(40).duration(280)}
            style={styles.listCard}>
            <View style={styles.listHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.listTitle}>Live sell rates</Text>
                <Text style={styles.listSub}>
                  {sellLoading
                    ? 'Loading…'
                    : `${filteredSell.length} brands · tap to sell`}
                  {sellDemo ? ' · demo rates' : ''}
                </Text>
              </View>
              <Ionicons name="trending-up" size={20} color={Brand.orange} />
            </View>

            {sellError ? (
              <View style={styles.errorBlock}>
                <Text style={styles.errorText}>{sellError}</Text>
                <Pressable onPress={() => void loadSell()}>
                  <Text style={styles.retry}>Retry</Text>
                </Pressable>
              </View>
            ) : null}

            {sellLoading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <View key={i} style={styles.skelRow}>
                    <View style={styles.skelLogo} />
                    <View style={styles.skelLine} />
                  </View>
                ))
              : filteredSell.map((brand) => {
                  const rate = rateMap[brand.slug];
                  const change = giftCardRateChangePercent(brand.slug, rate);
                  const up = change >= 0;
                  return (
                    <Pressable
                      key={brand.slug}
                      onPress={() =>
                        router.push({
                          pathname: '/(app)/services/gift-cards',
                          params: { mode: 'sell', slug: brand.slug },
                        })
                      }
                      style={({ pressed }) => [
                        styles.row,
                        pressed && { opacity: 0.92 },
                      ]}>
                      <GiftCardBrandLogo
                        brand={{
                          slug: brand.slug,
                          image: brand.image,
                          name: brand.name,
                        }}
                      />
                      <View style={styles.rowBody}>
                        <Text style={styles.rowTitle} numberOfLines={1}>
                          {brand.name}
                        </Text>
                        <Text style={styles.rowSub} numberOfLines={1}>
                          {brand.category}
                        </Text>
                      </View>
                      <View style={styles.rateCol}>
                        <Text style={styles.rateValue}>
                          {rate != null ? formatNairaRate(rate) : '—'}
                        </Text>
                        <Text style={styles.rateUnit}>/ $1</Text>
                      </View>
                      <View
                        style={[
                          styles.changeBadge,
                          up ? styles.changeUp : styles.changeDown,
                        ]}>
                        <Ionicons
                          name={up ? 'trending-up' : 'trending-down'}
                          size={12}
                          color={up ? Brand.success : Brand.error}
                        />
                        <Text
                          style={[
                            styles.changeText,
                            { color: up ? Brand.success : Brand.error },
                          ]}>
                          {up ? '+' : ''}
                          {change.toFixed(2)}%
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}

            {!sellLoading && !sellError && filteredSell.length === 0 ? (
              <Text style={styles.emptyText}>No brands match your search.</Text>
            ) : null}
          </Animated.View>
        </View>
      ) : (
        <View style={styles.stack}>
          <Animated.View entering={FadeInDown.duration(280)} style={styles.card}>
            <SelectSheet
              label="Card country"
              title="Card country"
              subtitle="Where the gift card can be redeemed"
              value={buyCountry}
              onChange={setBuyCountry}
              options={buyCountries.map((c) => ({
                id: c.code,
                title: c.label,
                subtitle: c.code,
              }))}
            />
            <View style={[styles.searchWrap, { marginTop: 12, marginBottom: 0 }]}>
              <Ionicons name="search" size={16} color={colors.mutedForeground} />
              <TextInput
                value={buyQuery}
                onChangeText={setBuyQuery}
                placeholder="Search brands to buy…"
                placeholderTextColor={colors.mutedForeground}
                style={styles.searchInput}
                autoCorrect={false}
                autoCapitalize="none"
              />
            </View>
          </Animated.View>

          <Animated.View
            entering={FadeInDown.delay(40).duration(280)}
            style={styles.listCard}>
            <View style={styles.listHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.listTitle}>Buy gift cards</Text>
                <Text style={styles.listSub}>
                  {buyLoading
                    ? 'Loading…'
                    : `${filteredBuy.length} products · tap to buy`}
                  {buyDemo ? ' · demo catalog' : buySandbox ? ' · sandbox' : ' · live'}
                </Text>
              </View>
              <Ionicons name="bag-handle-outline" size={20} color={Brand.orange} />
            </View>

            {buyError ? (
              <View style={styles.errorBlock}>
                <Text style={styles.errorText}>{buyError}</Text>
                <Pressable onPress={() => void loadBuy()}>
                  <Text style={styles.retry}>Retry</Text>
                </Pressable>
              </View>
            ) : null}

            {!buyLoading && !buyError && filteredBuy.length === 0 ? (
              <Text style={styles.emptyText}>
                No gift cards for this country yet. Try another country.
              </Text>
            ) : null}

            {buyLoading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <View key={i} style={styles.skelRow}>
                    <View style={styles.skelLogo} />
                    <View style={styles.skelLine} />
                  </View>
                ))
              : filteredBuy.map((product) => {
                  const from =
                    product.denominations[0] ?? product.minAmount ?? 10;
                  return (
                    <Pressable
                      key={product.productId}
                      onPress={() =>
                        router.push({
                          pathname: '/(app)/services/gift-cards',
                          params: {
                            mode: 'buy',
                            productId: String(product.productId),
                            country: buyCountry,
                          },
                        })
                      }
                      style={({ pressed }) => [
                        styles.row,
                        pressed && { opacity: 0.92 },
                      ]}>
                      <GiftCardBrandLogo
                        brand={{
                          image: product.image,
                          name: product.brandName,
                        }}
                        fallbacks={product.imageFallbacks}
                      />
                      <View style={styles.rowBody}>
                        <Text style={styles.rowTitle} numberOfLines={1}>
                          {product.brandName}
                        </Text>
                        <Text style={styles.rowSub} numberOfLines={1}>
                          {product.name}
                        </Text>
                      </View>
                      <View style={styles.rateCol}>
                        <Text style={styles.rateValue}>
                          from {product.recipientCurrency} {from}
                        </Text>
                        <Text style={styles.rateUnit}>{product.countryCode}</Text>
                      </View>
                    </Pressable>
                  );
                })}
          </Animated.View>
        </View>
      )}

      <Pressable
        onPress={() => router.push('/(app)/services/gift-cards')}
        style={styles.footerLink}>
        <Text style={styles.footerMuted}>Prefer the form directly? </Text>
        <Text style={styles.footerAction}>Open Gift Cards</Text>
      </Pressable>
    </Screen>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    modeTabs: {
      flexDirection: 'row',
      gap: 8,
      padding: 6,
      marginBottom: 10,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.grayDivider,
      backgroundColor: colors.card,
    },
    modeTab: {
      flex: 1,
      height: 44,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    modeTabActive: {
      backgroundColor: Brand.orange,
    },
    modeTabText: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.grayMedium,
      textTransform: 'capitalize',
    },
    modeTabTextActive: { color: Brand.white },
    stack: { gap: 10 },
    card: {
      borderRadius: 22,
      borderWidth: 1,
      borderColor: colors.grayDivider,
      backgroundColor: colors.card,
      padding: 12,
    },
    searchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      height: 44,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.grayDivider,
      backgroundColor: colors.card,
      paddingHorizontal: 12,
      marginBottom: 12,
    },
    searchInput: {
      flex: 1,
      fontSize: 14,
      fontWeight: '600',
      color: colors.charcoal,
      paddingVertical: 0,
    },
    chipRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 4 },
    chip: {
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: 99,
      backgroundColor: colors.grayLight,
    },
    chipActive: { backgroundColor: Brand.orange },
    chipText: { fontSize: 12, fontWeight: '700', color: colors.grayMedium },
    chipTextActive: { color: Brand.white },
    listCard: {
      borderRadius: 22,
      borderWidth: 1,
      borderColor: colors.grayDivider,
      backgroundColor: colors.card,
      overflow: 'hidden',
    },
    listHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.grayDivider,
    },
    listTitle: { fontSize: 16, fontWeight: '700', color: colors.charcoal },
    listSub: {
      marginTop: 2,
      fontSize: 12,
      fontWeight: '500',
      color: colors.grayMedium,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      minHeight: 68,
      paddingHorizontal: 12,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.grayDivider,
    },
    rowBody: { flex: 1, minWidth: 0 },
    rowTitle: { fontSize: 14, fontWeight: '700', color: colors.charcoal },
    rowSub: {
      marginTop: 2,
      fontSize: 11,
      fontWeight: '500',
      color: colors.grayMedium,
    },
    rateCol: { alignItems: 'flex-end' },
    rateValue: { fontSize: 13, fontWeight: '800', color: colors.charcoal },
    rateUnit: {
      marginTop: 2,
      fontSize: 10,
      fontWeight: '500',
      color: colors.grayMedium,
    },
    changeBadge: {
      minWidth: 68,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: 2,
      borderRadius: 99,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    changeUp: { backgroundColor: 'rgba(52,199,89,0.12)' },
    changeDown: { backgroundColor: 'rgba(255,59,48,0.12)' },
    changeText: { fontSize: 11, fontWeight: '700' },
    skelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      height: 72,
      paddingHorizontal: 12,
    },
    skelLogo: {
      width: 44,
      height: 44,
      borderRadius: 16,
      backgroundColor: colors.grayLight,
    },
    skelLine: {
      flex: 1,
      height: 14,
      borderRadius: 8,
      backgroundColor: colors.grayLight,
    },
    errorBlock: {
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.grayDivider,
      gap: 8,
    },
    errorText: { fontSize: 13, fontWeight: '600', color: Brand.error },
    retry: { fontSize: 13, fontWeight: '700', color: Brand.orange },
    emptyText: {
      paddingHorizontal: 12,
      paddingVertical: 10,
      textAlign: 'center',
      fontSize: 13,
      fontWeight: '600',
      color: colors.grayMedium,
    },
    footerLink: {
      marginTop: 14,
      marginBottom: 8,
      flexDirection: 'row',
      justifyContent: 'center',
      flexWrap: 'wrap',
    },
    footerMuted: { fontSize: 12, fontWeight: '500', color: colors.grayMedium },
    footerAction: { fontSize: 12, fontWeight: '700', color: Brand.orange },
  });
}
