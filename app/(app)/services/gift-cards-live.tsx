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
import Animated from 'react-native-reanimated';

import { cardEntering } from '@/lib/motion';

import { GiftCardBrandLogo } from '@/components/app/gift-card-brand-logo';
import { ErrorAlertModal } from '@/components/app/error-alert-modal';
import { PageHeader } from '@/components/app/page-header';
import { SelectSheet } from '@/components/app/picker-sheet';
import { Screen } from '@/components/ui/screen';
import { GiftCardLiveListSkeleton } from '@/components/ui/skeletons';
import { Skeleton } from '@/components/ui/skeleton';
import { Brand, type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';
import { api } from '@/lib/api';
import { endpoints } from '@/lib/endpoints';

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

export default function GiftCardsLiveScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [buyProducts, setBuyProducts] = useState<BuyProduct[]>([]);
  const [buyCountries, setBuyCountries] = useState(FALLBACK_BUY_COUNTRIES);
  const [buyLoading, setBuyLoading] = useState(false);
  const [buyError, setBuyError] = useState<string | null>(null);
  const [buyDemo, setBuyDemo] = useState(false);
  const [buySandbox, setBuySandbox] = useState(false);
  const [buyQuery, setBuyQuery] = useState('');
  const [buyCountry, setBuyCountry] = useState('US');
  const [refreshing, setRefreshing] = useState(false);

  const filteredBuy = useMemo(() => {
    const q = buyQuery.trim().toLowerCase();
    if (!q) return buyProducts;
    return buyProducts.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.brandName.toLowerCase().includes(q),
    );
  }, [buyProducts, buyQuery]);

  const loadBuyCountries = useCallback(async () => {
    try {
      const data = await api.get<{
        countries?: Array<{ code: string; name: string }>;
        demo?: boolean;
        sandbox?: boolean;
      }>(endpoints.services.giftCardCountries);
      if (data.countries?.length) {
        setBuyCountries(
          data.countries.map((c) => ({
            code: c.code,
            label: c.name || c.code,
          })),
        );
        setBuyCountry((prev) => {
          const codes = data.countries!.map((c) => c.code);
          return codes.includes(prev) ? prev : codes[0] || 'US';
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
    void loadBuyCountries();
  }, [loadBuyCountries]);

  useEffect(() => {
    void loadBuy();
  }, [loadBuy]);

  async function onRefresh() {
    setRefreshing(true);
    try {
      await loadBuyCountries();
      await loadBuy();
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <Screen
      scroll
      refreshing={refreshing}
      onRefresh={() => void onRefresh()}
      header={
        <PageHeader
          title="Gift Card Live"
          subtitle="Live buy rates · paid from USD balance"
          showBack
        />
      }>
      <View style={styles.stack}>
        <Animated.View entering={cardEntering(0)} style={styles.card}>
          <SelectSheet
            label="Card country"
            title="Card country"
            subtitle="Where the gift card can be redeemed"
            value={buyCountry}
            onChange={setBuyCountry}
            fullScreen={false}
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

        <Animated.View entering={cardEntering(40)} style={styles.listCard}>
          <View style={styles.listHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.listTitle}>Buy gift cards</Text>
              {buyLoading ? (
                <Skeleton width={150} height={11} style={{ marginTop: 6 }} />
              ) : (
                <Text style={styles.listSub}>
                  {`${filteredBuy.length} products · tap to buy`}
                  {buyDemo
                    ? ' · demo catalog'
                    : buySandbox
                      ? ' · sandbox'
                      : ' · live'}
                </Text>
              )}
            </View>
            <Ionicons name="bag-handle-outline" size={20} color={Brand.orange} />
          </View>

          {buyError ? (
            <View style={styles.errorBlock}>
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

          {buyLoading ? (
            <GiftCardLiveListSkeleton count={6} />
          ) : (
            filteredBuy.map((product) => {
              const from = product.denominations[0] ?? product.minAmount ?? 10;
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
            })
          )}
        </Animated.View>
      </View>

      <Pressable
        onPress={() => router.push('/(app)/services/gift-cards')}
        style={styles.footerLink}>
        <Text style={styles.footerMuted}>Prefer the form directly? </Text>
        <Text style={styles.footerAction}>Open Gift Cards</Text>
      </Pressable>

      <ErrorAlertModal
        error={buyError}
        onClose={() => setBuyError(null)}
        page="Gift Cards"
      />
    </Screen>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    stack: { gap: 12 },
    card: {
      borderRadius: 22,
      borderWidth: 1,
      borderColor: colors.grayDivider,
      backgroundColor: colors.card,
      padding: 14,
    },
    searchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      height: 48,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.grayDivider,
      backgroundColor: colors.card,
      paddingHorizontal: 12,
      marginBottom: 12,
    },
    searchInput: {
      flex: 1,
      fontSize: 15,
      fontWeight: '600',
      color: colors.charcoal,
      paddingVertical: 0,
    },
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
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.grayDivider,
    },
    listTitle: { fontSize: 16, fontWeight: '700', color: colors.charcoal },
    listSub: {
      marginTop: 2,
      fontSize: 12,
      fontWeight: '500',
      color: colors.mutedForeground,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      minHeight: 68,
      paddingHorizontal: 14,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.grayDivider,
    },
    rowBody: { flex: 1, minWidth: 0 },
    rowTitle: { fontSize: 14, fontWeight: '700', color: colors.charcoal },
    rowSub: {
      marginTop: 2,
      fontSize: 11,
      fontWeight: '500',
      color: colors.mutedForeground,
    },
    rateCol: { alignItems: 'flex-end' },
    rateValue: { fontSize: 13, fontWeight: '800', color: colors.charcoal },
    rateUnit: {
      marginTop: 2,
      fontSize: 10,
      fontWeight: '500',
      color: colors.mutedForeground,
    },
    errorBlock: {
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.grayDivider,
      gap: 8,
    },
    retry: { fontSize: 13, fontWeight: '700', color: Brand.orange },
    emptyText: {
      paddingHorizontal: 14,
      paddingVertical: 28,
      textAlign: 'center',
      fontSize: 13,
      fontWeight: '600',
      color: colors.mutedForeground,
    },
    footerLink: {
      marginTop: 18,
      marginBottom: 8,
      flexDirection: 'row',
      justifyContent: 'center',
      flexWrap: 'wrap',
    },
    footerMuted: { fontSize: 12, fontWeight: '500', color: colors.mutedForeground },
    footerAction: { fontSize: 12, fontWeight: '700', color: Brand.orange },
  });
}
