import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
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
import { PickerSheet, SelectSheet } from '@/components/app/picker-sheet';
import { ServiceSuccess } from '@/components/app/service-success';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { Brand, type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';
import { useInvalidateWallet } from '@/hooks/use-invalidate-wallet';
import {
  useGiftCardCountries,
  useGiftCardProducts,
  useGiftCardSellCatalog,
} from '@/hooks/use-service-catalogs';
import { api } from '@/lib/api';
import { endpoints } from '@/lib/endpoints';
import { formatNaira } from '@/lib/format';
import { STALE } from '@/lib/query-client';
import { queryKeys } from '@/lib/query-keys';
import { useQuery } from '@tanstack/react-query';

const MAX_CARD_IMAGE_BYTES = 2_500_000;
const MAX_CARD_IMAGES = 5;

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
  redeemHint?: string | null;
};

type SellQuote = {
  ratePerUnit: number;
  providerPayout: number;
  userPayout: number;
  currency: string;
};

type BuyQuote = {
  usdFace: number;
  local: number;
  currency: string;
};

type CardImage = {
  filename: string;
  mime: string;
  base64: string;
  preview: string;
};

const CARD_COUNTRIES = [
  { code: 'US', label: 'United States', currency: 'USD' },
  { code: 'GB', label: 'United Kingdom', currency: 'GBP' },
  { code: 'CA', label: 'Canada', currency: 'CAD' },
  { code: 'EU', label: 'Europe', currency: 'EUR' },
  { code: 'AU', label: 'Australia', currency: 'AUD' },
];

const FALLBACK_BUY_COUNTRIES = [
  { code: 'US', label: 'United States' },
  { code: 'GB', label: 'United Kingdom' },
  { code: 'CA', label: 'Canada' },
  { code: 'NG', label: 'Nigeria' },
  { code: 'AU', label: 'Australia' },
];

/** Physical sell trades always use cash receipt (no UI choice). */
const PHYSICAL_SUB_TYPE = 'cash_receipt' as const;

function firstParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0];
  return value;
}

function currencyForCardCountry(
  countryCode: string,
  brandCurrencies?: string[],
) {
  const mapped =
    CARD_COUNTRIES.find((c) => c.code === countryCode)?.currency || 'USD';
  if (!brandCurrencies?.length) return mapped;
  if (brandCurrencies.includes(mapped)) return mapped;
  return brandCurrencies[0] || mapped;
}

export default function GiftCardsScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const params = useLocalSearchParams<{
    mode?: string | string[];
    slug?: string | string[];
    productId?: string | string[];
    country?: string | string[];
  }>();

  const modeParam = firstParam(params.mode);
  const slugParam = firstParam(params.slug);
  const productIdParam = firstParam(params.productId);
  const countryParam = firstParam(params.country);

  const invalidateWallet = useInvalidateWallet();
  const [mode, setMode] = useState<Mode>(
    modeParam === 'buy' ? 'buy' : 'sell',
  );
  const [error, setError] = useState<string | null>(null);

  const sellCatalogQuery = useGiftCardSellCatalog();
  const sellRatesQuery = useQuery({
    queryKey: queryKeys.catalogs.giftCardSellRates,
    queryFn: async () => {
      return api.get<{
        simplified?: Array<{ slug?: string; ratePerUnit?: number }>;
        demo?: boolean;
      }>(`${endpoints.services.giftCardSellRates}?currency=USD&cardType=ecode`);
    },
    staleTime: STALE.catalog,
  });
  const sellBrands = useMemo(
    () =>
      ((sellCatalogQuery.data?.brands as SellBrand[] | undefined) ?? []).filter(
        (b) => b.active !== false,
      ),
    [sellCatalogQuery.data],
  );
  const rateMap = useMemo(() => {
    const next: Record<string, number | null> = {};
    for (const row of sellRatesQuery.data?.simplified ?? []) {
      if (row?.slug) next[row.slug] = row.ratePerUnit ?? null;
    }
    return next;
  }, [sellRatesQuery.data]);
  const sellLoading =
    (sellCatalogQuery.isLoading && !sellCatalogQuery.data) ||
    (sellRatesQuery.isLoading && !sellRatesQuery.data);
  const sellDemo = Boolean(sellCatalogQuery.data?.demo || sellRatesQuery.data?.demo);
  const [selectedSell, setSelectedSell] = useState<SellBrand | null>(null);
  const [cardType, setCardType] = useState<'ecode' | 'physical'>('physical');
  const [cardCountry, setCardCountry] = useState('US');
  const [cardCurrency, setCardCurrency] = useState('USD');
  const [sellAmount, setSellAmount] = useState('100');
  const [code, setCode] = useState('');
  const [images, setImages] = useState<CardImage[]>([]);
  const [sellQuote, setSellQuote] = useState<SellQuote | null>(null);
  const [sellQuoting, setSellQuoting] = useState(false);
  const [sellSubmitting, setSellSubmitting] = useState(false);
  const [sellSuccess, setSellSuccess] = useState(false);
  const [sellSuccessStatus, setSellSuccessStatus] = useState<
    'completed' | 'pending'
  >('pending');
  const [sellReceiptAmount, setSellReceiptAmount] = useState('');
  const [sellReceiptRef, setSellReceiptRef] = useState('');
  const [sellTxId, setSellTxId] = useState('');
  const [changeSellOpen, setChangeSellOpen] = useState(false);
  const [changeSellQuery, setChangeSellQuery] = useState('');

  const [buyCountry, setBuyCountry] = useState(
    (countryParam || 'US').toUpperCase(),
  );
  const buyCountriesQuery = useGiftCardCountries(mode === 'buy');
  const buyProductsQuery = useGiftCardProducts(buyCountry, mode === 'buy');
  const buyCountries = useMemo(() => {
    const rows = buyCountriesQuery.data?.countries as
      | Array<{ code: string; label: string }>
      | undefined;
    if (!rows?.length) return FALLBACK_BUY_COUNTRIES;
    return rows.map((c) => ({
      code: String(c.code).toUpperCase(),
      label: String(c.label),
    }));
  }, [buyCountriesQuery.data]);
  const buyProducts = (buyProductsQuery.data?.products as BuyProduct[] | undefined) ?? [];
  const buyLoading = buyProductsQuery.isLoading && !buyProductsQuery.data;
  const buyDemo = Boolean(
    buyCountriesQuery.data?.demo || buyProductsQuery.data?.demo,
  );
  const [selectedBuy, setSelectedBuy] = useState<BuyProduct | null>(null);
  const [buyAmount, setBuyAmount] = useState('25');
  const [buyEmail, setBuyEmail] = useState('');
  const [changeBuyOpen, setChangeBuyOpen] = useState(false);
  const [changeBuyQuery, setChangeBuyQuery] = useState('');
  const [buyQuote, setBuyQuote] = useState<BuyQuote | null>(null);
  const [buyQuoting, setBuyQuoting] = useState(false);
  const [buySubmitting, setBuySubmitting] = useState(false);
  const [buySuccess, setBuySuccess] = useState(false);
  const [buyReceiptAmount, setBuyReceiptAmount] = useState('');
  const [buyTxId, setBuyTxId] = useState('');
  const [buyCards, setBuyCards] = useState<
    { cardNumber: string | null; pinCode: string | null }[]
  >([]);

  const changeSellOptions = useMemo(() => {
    const q = changeSellQuery.trim().toLowerCase();
    if (!q) return sellBrands;
    return sellBrands.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        b.slug.includes(q) ||
        b.category.toLowerCase().includes(q),
    );
  }, [sellBrands, changeSellQuery]);

  const changeBuyOptions = useMemo(() => {
    const q = changeBuyQuery.trim().toLowerCase();
    if (!q) return buyProducts;
    return buyProducts.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.brandName.toLowerCase().includes(q),
    );
  }, [buyProducts, changeBuyQuery]);

  useEffect(() => {
    if (modeParam === 'buy' || modeParam === 'sell') setMode(modeParam);
    if (countryParam) setBuyCountry(countryParam.toUpperCase());
  }, [modeParam, countryParam]);

  useEffect(() => {
    if (sellCatalogQuery.error) {
      setError(
        sellCatalogQuery.error instanceof Error
          ? sellCatalogQuery.error.message
          : 'Failed to load brands',
      );
    }
  }, [sellCatalogQuery.error]);

  useEffect(() => {
    if (!buyCountries.length) return;
    setBuyCountry((prev) => {
      const codes = new Set(buyCountries.map((c) => c.code));
      return codes.has(prev) ? prev : buyCountries[0].code;
    });
  }, [buyCountries]);

  useEffect(() => {
    if (buyProductsQuery.error) {
      setError(
        buyProductsQuery.error instanceof Error
          ? buyProductsQuery.error.message
          : 'Failed to load products',
      );
    }
  }, [buyProductsQuery.error]);

  useEffect(() => {
    if (mode !== 'sell' || sellLoading || sellBrands.length === 0) return;
    if (slugParam) {
      const match = sellBrands.find((b) => b.slug === slugParam);
      if (match) {
        setSelectedSell(match);
        return;
      }
    }
    setSelectedSell((prev) => prev ?? sellBrands[0] ?? null);
  }, [mode, sellBrands, sellLoading, slugParam]);

  useEffect(() => {
    if (mode !== 'buy' || buyLoading || buyProducts.length === 0) return;
    if (productIdParam) {
      const match = buyProducts.find((p) => String(p.productId) === productIdParam);
      setSelectedBuy(match ?? buyProducts[0] ?? null);
      return;
    }
    setSelectedBuy((prev) => {
      if (prev && buyProducts.some((p) => p.productId === prev.productId)) {
        return prev;
      }
      return buyProducts[0] ?? null;
    });
  }, [mode, buyProducts, buyLoading, productIdParam]);

  useEffect(() => {
    if (!selectedSell) return;
    setCardCurrency(
      currencyForCardCountry(cardCountry, selectedSell.currencies),
    );
    setCardType(
      selectedSell.cardTypes.includes('physical') ? 'physical' : 'ecode',
    );
    setSellAmount(String(selectedSell.denominations[0] || 100));
    setCode('');
    setImages([]);
    setSellSuccess(false);
    setSellQuote(null);
  }, [selectedSell?.slug]);

  useEffect(() => {
    if (!selectedBuy) return;
    setBuyAmount(
      String(selectedBuy.denominations[0] || selectedBuy.minAmount || 25),
    );
    setBuySuccess(false);
    setBuyQuote(null);
    setBuyCards([]);
  }, [selectedBuy?.productId]);

  useEffect(() => {
    if (!selectedSell) return;
    const value = Number(sellAmount);
    if (!Number.isFinite(value) || value <= 0) {
      setSellQuote(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setSellQuoting(true);
      try {
        const qs = new URLSearchParams({
          slug: selectedSell.slug,
          currency: cardCurrency,
          cardType,
          amount: String(value),
        });
        if (cardType === 'physical') qs.set('subType', PHYSICAL_SUB_TYPE);
        const data = await api.get<{ quote?: SellQuote }>(
          `${endpoints.services.giftCardSellRates}?${qs}`,
        );
        if (!cancelled) setSellQuote(data.quote ?? null);
      } catch (e) {
        if (!cancelled) {
          setSellQuote(null);
          setError(e instanceof Error ? e.message : 'Failed to quote');
        }
      } finally {
        if (!cancelled) setSellQuoting(false);
      }
    }, 280);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [selectedSell, sellAmount, cardCurrency, cardType]);

  useEffect(() => {
    if (!selectedBuy) return;
    const value = Number(buyAmount);
    if (!Number.isFinite(value) || value <= 0) {
      setBuyQuote(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setBuyQuoting(true);
      try {
        const qs = new URLSearchParams({
          countryCode: buyCountry,
          productId: String(selectedBuy.productId),
          unitPrice: String(value),
        });
        const data = await api.get<{ quote?: BuyQuote }>(
          `${endpoints.services.giftCardProducts}?${qs}`,
        );
        if (!cancelled) setBuyQuote(data.quote ?? null);
      } catch (e) {
        if (!cancelled) {
          setBuyQuote(null);
          setError(e instanceof Error ? e.message : 'Failed to quote');
        }
      } finally {
        if (!cancelled) setBuyQuoting(false);
      }
    }, 280);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [selectedBuy, buyAmount, buyCountry]);

  async function pickImages() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Allow photo library access to upload card images.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: MAX_CARD_IMAGES - images.length,
      quality: 0.85,
      base64: true,
    });
    if (result.canceled) return;

    const next = [...images];
    for (const asset of result.assets) {
      if (next.length >= MAX_CARD_IMAGES) {
        setError(`You can upload up to ${MAX_CARD_IMAGES} images`);
        break;
      }
      const base64 = asset.base64;
      if (!base64) continue;
      const approxBytes = Math.ceil((base64.length * 3) / 4);
      if (approxBytes > MAX_CARD_IMAGE_BYTES) {
        setError('Each image must be under 2.5MB');
        continue;
      }
      const mime = asset.mimeType || 'image/jpeg';
      next.push({
        filename: asset.fileName || `card-${Date.now()}-${next.length}.jpg`,
        mime,
        base64,
        preview: asset.uri,
      });
    }
    setImages(next);
  }

  async function onSellSubmit() {
    if (!selectedSell || !sellQuote || sellSubmitting) return;
    if (cardType === 'ecode' && !code.trim()) {
      setError('Paste the gift card e-code to continue.');
      return;
    }
    if (cardType === 'physical' && images.length < 1) {
      setError('Upload at least one clear card photo.');
      return;
    }
    setSellSubmitting(true);
    setError(null);
    try {
      const data = await api.post<{
        status?: string;
        amountFormatted?: string;
        reference?: string;
        transactionId?: string;
      }>(endpoints.services.giftCardSell, {
        slug: selectedSell.slug,
        brandName: selectedSell.name,
        cardCountry,
        cardType,
        subType: cardType === 'physical' ? PHYSICAL_SUB_TYPE : null,
        cardCurrency,
        cardAmount: Number(sellAmount),
        additionalInfo: cardType === 'ecode' ? code.trim() : null,
        images:
          cardType === 'physical'
            ? images.map(({ filename, mime, base64 }) => ({
                filename,
                mime,
                base64,
              }))
            : [],
      });
      setSellSuccess(true);
      setSellSuccessStatus(data.status === 'completed' ? 'completed' : 'pending');
      setSellReceiptAmount(data.amountFormatted || '');
      setSellReceiptRef(data.reference || '');
      setSellTxId(data.transactionId || '');
      setCode('');
      setImages([]);
      invalidateWallet();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sell card');
    } finally {
      setSellSubmitting(false);
    }
  }

  async function onBuySubmit() {
    if (!selectedBuy || buySubmitting) return;
    if (!buyEmail.trim()) {
      setError('Enter a delivery email for the gift card.');
      return;
    }
    setBuySubmitting(true);
    setError(null);
    try {
      const data = await api.post<{
        amountFormatted?: string;
        transactionId?: string;
        cards?: { cardNumber: string | null; pinCode: string | null }[];
      }>(endpoints.services.giftCardBuy, {
        productId: selectedBuy.productId,
        unitPrice: Number(buyAmount),
        email: buyEmail.trim(),
      });
      setBuySuccess(true);
      setBuyReceiptAmount(data.amountFormatted || '');
      setBuyTxId(data.transactionId || '');
      setBuyCards(data.cards ?? []);
      invalidateWallet();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to buy card');
    } finally {
      setBuySubmitting(false);
    }
  }

  function switchMode(tab: Mode) {
    if (tab === mode) return;
    setMode(tab);
    setSellSuccess(false);
    setBuySuccess(false);
    setError(null);
  }

  async function copyText(value: string) {
    await Clipboard.setStringAsync(value);
  }

  const stickyFooter =
    sellSuccess || buySuccess
      ? null
      : mode === 'sell'
        ? sellLoading || !selectedSell
          ? null
          : (
              <Button
                title={sellSubmitting ? 'Submitting…' : 'Sell gift card'}
                disabled={!sellQuote || sellSubmitting}
                loading={sellSubmitting}
                onPress={() => void onSellSubmit()}
              />
            )
        : buyLoading || !selectedBuy
          ? null
          : (
              <Button
                title={
                  buySubmitting
                    ? 'Buying…'
                    : buyQuote
                      ? `Buy · ${formatNaira(buyQuote.local)}`
                      : 'Buy gift card'
                }
                disabled={!buyQuote || buySubmitting}
                loading={buySubmitting}
                onPress={() => void onBuySubmit()}
              />
            );

  return (
    <Screen scroll footer={stickyFooter}>
      <PageHeader
        title="Gift Cards"
        subtitle={
          mode === 'sell'
            ? 'Sell gift cards for Naira wallet credit'
            : 'Buy digital gift cards with your wallet'
        }
        showBack
      />

      <View style={styles.modeTabs}>
        {(['sell', 'buy'] as const).map((tab) => {
          const active = mode === tab;
          return (
            <Pressable
              key={tab}
              onPress={() => switchMode(tab)}
              style={[styles.modeTab, active && styles.modeTabActive]}>
              <Text style={[styles.modeTabText, active && styles.modeTabTextActive]}>
                {tab === 'sell' ? 'Sell' : 'Buy'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {error ? (
        <View style={styles.errorBanner}>
          <View style={{ flex: 1 }}>
            <Text style={styles.errorTitle}>Something went wrong</Text>
            <Text style={styles.errorText}>{error}</Text>
          </View>
          <Pressable onPress={() => setError(null)} hitSlop={8}>
            <Ionicons name="close" size={18} color={colors.mutedForeground} />
          </Pressable>
        </View>
      ) : null}

      {mode === 'sell' ? (
        <>
        {sellSuccess ? (
          <ServiceSuccess
            variant={
              sellSuccessStatus === 'completed' ? 'success' : 'pending'
            }
            title={
              sellSuccessStatus === 'completed'
                ? 'Trade completed!'
                : 'Trade submitted'
            }
            subtitle={
              sellSuccessStatus === 'completed'
                ? 'Your wallet has been credited successfully.'
                : 'We’re reviewing your card. You’ll be notified when it’s approved.'
            }
            amountLabel={
              sellSuccessStatus === 'completed'
                ? 'Amount credited'
                : 'Expected amount'
            }
            amount={sellReceiptAmount}
            reference={sellReceiptRef}
            onDismiss={() => setSellSuccess(false)}
            primaryAction={
              sellTxId
                ? {
                    label: 'View receipt',
                    onPress: () =>
                      router.push(`/(app)/history/${sellTxId}` as never),
                    icon: 'receipt',
                  }
                : null
            }
            tertiaryAction={{
              label: 'Sell another gift card',
              onPress: () => setSellSuccess(false),
              icon: 'plus',
            }}
          />
        ) : null}
        {sellLoading || !selectedSell ? (
          <FormSkeleton />
        ) : (
          <View style={styles.stack}>
            <Pressable
              onPress={() => router.push('/(app)/services/gift-cards-live')}
              style={styles.backLink}>
              <Ionicons name="arrow-back" size={16} color={colors.mutedForeground} />
              <Text style={styles.backLinkText}>All gift cards</Text>
            </Pressable>

            <Animated.View entering={FadeInDown.duration(280)} style={styles.card}>
              <View style={styles.brandRow}>
                <GiftCardBrandLogo
                  brand={{
                    slug: selectedSell.slug,
                    image: selectedSell.image,
                    name: selectedSell.name,
                  }}
                  size={56}
                />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.brandTitle} numberOfLines={1}>
                    Sell {selectedSell.name}
                  </Text>
                  <Text style={styles.brandSub}>
                    {selectedSell.category}
                    {sellDemo ? ' · demo rates' : ' · live rates'}
                  </Text>
                </View>
                <View style={styles.rateCol}>
                  <Text style={styles.rateValue}>
                    {formatNaira(
                      rateMap[selectedSell.slug] ??
                        sellQuote?.ratePerUnit ??
                        0,
                    )}
                  </Text>
                  <Text style={styles.rateUnit}>per $1</Text>
                </View>
                <Pressable
                  onPress={() => {
                    setChangeSellQuery('');
                    setChangeSellOpen(true);
                  }}
                  style={styles.changeBtn}
                  accessibilityLabel="Change gift card">
                  <Ionicons name="chevron-down" size={16} color={colors.mutedForeground} />
                </Pressable>
              </View>
            </Animated.View>

            <Animated.View
              entering={FadeInDown.delay(40).duration(280)}
              style={styles.card}>
              <View style={styles.typeRow}>
                {(['physical', 'ecode'] as const)
                  .filter((t) => selectedSell.cardTypes.includes(t))
                  .map((t) => {
                  const active = cardType === t;
                  return (
                    <Pressable
                      key={t}
                      onPress={() => setCardType(t)}
                      style={[styles.typeTab, active && styles.typeTabActive]}>
                      <Text
                        style={[
                          styles.typeTabText,
                          active && styles.typeTabTextActive,
                        ]}>
                        {t === 'physical' ? 'Physical' : 'E-code'}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <SelectSheet
                label="Card country"
                title="Card country"
                value={cardCountry}
                onChange={(next) => {
                  setCardCountry(next);
                  setCardCurrency(
                    currencyForCardCountry(next, selectedSell.currencies),
                  );
                }}
                options={CARD_COUNTRIES.map((c) => ({
                  id: c.code,
                  title: c.label,
                  subtitle: c.currency,
                }))}
              />
              <Text style={styles.hint}>Currency set to {cardCurrency}</Text>

              <Text style={styles.fieldLabel}>Face value</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipRow}>
                {selectedSell.denominations.map((d) => {
                  const active = Number(sellAmount) === d;
                  return (
                    <Pressable
                      key={d}
                      onPress={() => setSellAmount(String(d))}
                      style={[styles.chip, active && styles.chipActive]}>
                      <Text
                        style={[styles.chipText, active && styles.chipTextActive]}>
                        {d}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
              <TextInput
                value={sellAmount}
                onChangeText={setSellAmount}
                keyboardType="decimal-pad"
                style={styles.input}
                placeholder="100"
                placeholderTextColor={colors.mutedForeground}
              />

              {cardType === 'ecode' ? (
                <View style={{ marginTop: 10 }}>
                  <Text style={styles.fieldLabel}>Gift card code</Text>
                  <TextInput
                    value={code}
                    onChangeText={setCode}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    placeholder="Paste E-code"
                    placeholderTextColor={colors.mutedForeground}
                    style={[styles.input, styles.mono]}
                  />
                </View>
              ) : (
                <View style={{ marginTop: 10 }}>
                  <Text style={styles.fieldLabel}>
                    Card photos (1–{MAX_CARD_IMAGES}) · max 2.5MB each
                  </Text>
                  <Pressable onPress={() => void pickImages()} style={styles.upload}>
                    <Ionicons
                      name="image-outline"
                      size={22}
                      color={colors.mutedForeground}
                    />
                    <Text style={styles.uploadTitle}>
                      {images.length
                        ? 'Add another photo'
                        : 'Upload clear card photos'}
                    </Text>
                    <Text style={styles.uploadSub}>Any image · under 2.5MB</Text>
                  </Pressable>
                  {images.length ? (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.thumbs}>
                      {images.map((img, index) => (
                        <View key={`${img.filename}-${index}`} style={styles.thumb}>
                          <Image
                            source={{ uri: img.preview }}
                            style={styles.thumbImg}
                            contentFit="cover"
                          />
                          <Pressable
                            onPress={() =>
                              setImages((prev) =>
                                prev.filter((_, i) => i !== index),
                              )
                            }
                            style={styles.thumbRemove}
                            accessibilityLabel={`Remove photo ${index + 1}`}>
                            <Ionicons name="trash" size={12} color={Brand.white} />
                          </Pressable>
                        </View>
                      ))}
                    </ScrollView>
                  ) : null}
                </View>
              )}
            </Animated.View>

            <Animated.View
              entering={FadeInDown.delay(70).duration(280)}
              style={styles.card}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>You receive</Text>
                <View style={styles.summaryValueRow}>
                  <Ionicons name="wallet-outline" size={16} color={Brand.orange} />
                  <Text style={styles.summaryValue}>
                    {sellQuoting
                      ? '…'
                      : sellQuote
                        ? formatNaira(sellQuote.userPayout)
                        : '—'}
                  </Text>
                </View>
              </View>
              {sellQuote ? (
                <Text style={styles.hint}>
                  Provider rate {formatNaira(sellQuote.ratePerUnit)} per{' '}
                  {cardCurrency} 1
                </Text>
              ) : null}
            </Animated.View>
          </View>
        )}
        </>
      ) : (
        <>
        {buySuccess ? (
          <ServiceSuccess
            title="Purchase successful!"
            subtitle={
              selectedBuy
                ? `Your ${selectedBuy.brandName} card is ready.`
                : 'Your gift card is ready.'
            }
            amountLabel="Amount charged"
            amount={buyReceiptAmount}
            onDismiss={() => setBuySuccess(false)}
            primaryAction={
              buyTxId
                ? {
                    label: 'View receipt',
                    onPress: () =>
                      router.push(`/(app)/history/${buyTxId}` as never),
                    icon: 'receipt',
                  }
                : null
            }
            tertiaryAction={{
              label: 'Buy another gift card',
              onPress: () => setBuySuccess(false),
              icon: 'plus',
            }}>
            {buyCards.length ? (
              <View style={styles.copyStack}>
                {buyCards.map((card, i) => (
                  <View key={i} style={styles.copyCard}>
                    {card.cardNumber ? (
                      <CopyRow
                        label="Code"
                        value={card.cardNumber}
                        onCopy={() => void copyText(String(card.cardNumber))}
                      />
                    ) : null}
                    {card.pinCode ? (
                      <CopyRow
                        label="PIN"
                        value={card.pinCode}
                        onCopy={() => void copyText(String(card.pinCode))}
                      />
                    ) : null}
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.successMeta}>
                Code will also be emailed if provided by the issuer.
              </Text>
            )}
          </ServiceSuccess>
        ) : null}
        {buyLoading || !selectedBuy ? (
          <FormSkeleton />
        ) : (
        <View style={styles.stack}>
          <Pressable
            onPress={() => router.push('/(app)/services/gift-cards-live')}
            style={styles.backLink}>
            <Ionicons name="arrow-back" size={16} color={colors.mutedForeground} />
            <Text style={styles.backLinkText}>All products</Text>
          </Pressable>

          <Animated.View entering={FadeInDown.duration(280)} style={styles.card}>
            <View style={styles.brandRow}>
              <GiftCardBrandLogo
                brand={{
                  image: selectedBuy.image,
                  name: selectedBuy.brandName,
                }}
                fallbacks={selectedBuy.imageFallbacks}
                size={56}
              />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.brandTitle} numberOfLines={1}>
                  Buy {selectedBuy.brandName}
                </Text>
                <Text style={styles.brandSub} numberOfLines={2}>
                  {selectedBuy.name}
                  {buyDemo ? ' · demo' : ''}
                </Text>
              </View>
              <Pressable
                onPress={() => {
                  setChangeBuyQuery('');
                  setChangeBuyOpen(true);
                }}
                style={styles.changeBtn}
                accessibilityLabel="Change gift card">
                <Ionicons name="refresh" size={16} color={colors.mutedForeground} />
              </Pressable>
            </View>
            {selectedBuy.redeemHint ? (
              <Text style={[styles.hint, { marginTop: 10 }]}>
                {selectedBuy.redeemHint}
              </Text>
            ) : null}
          </Animated.View>

          <Animated.View
            entering={FadeInDown.delay(40).duration(280)}
            style={styles.card}>
            <SelectSheet
              label="Card country"
              title="Card country"
              value={buyCountry}
              onChange={(next) => {
                setBuyCountry(next);
                setSelectedBuy(null);
                setBuyQuote(null);
              }}
              options={buyCountries.map((c) => ({
                id: c.code,
                title: c.label,
                subtitle: c.code,
              }))}
            />

            <Text style={[styles.fieldLabel, { marginTop: 10 }]}>
              Amount ({selectedBuy.recipientCurrency})
              {(selectedBuy.denominationType || '').toUpperCase() === 'RANGE' &&
              selectedBuy.minAmount != null &&
              selectedBuy.maxAmount != null
                ? ` · ${selectedBuy.minAmount}–${selectedBuy.maxAmount}`
                : ''}
            </Text>
            {(selectedBuy.denominationType || '').toUpperCase() === 'FIXED' &&
            selectedBuy.denominations.length ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipRow}>
                {selectedBuy.denominations.map((d) => {
                  const active = Number(buyAmount) === d;
                  return (
                    <Pressable
                      key={d}
                      onPress={() => setBuyAmount(String(d))}
                      style={[styles.chip, active && styles.chipActive]}>
                      <Text
                        style={[styles.chipText, active && styles.chipTextActive]}>
                        {selectedBuy.recipientCurrency} {d}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : null}
            <TextInput
              value={buyAmount}
              onChangeText={setBuyAmount}
              keyboardType="decimal-pad"
              style={styles.input}
              placeholder="25"
              placeholderTextColor={colors.mutedForeground}
            />

            <Text style={[styles.fieldLabel, { marginTop: 10 }]}>
              Delivery email
            </Text>
            <TextInput
              value={buyEmail}
              onChangeText={setBuyEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
              placeholder="you@email.com"
              placeholderTextColor={colors.mutedForeground}
              style={styles.input}
            />
          </Animated.View>

          <Animated.View
            entering={FadeInDown.delay(70).duration(280)}
            style={styles.card}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>You pay</Text>
              <View style={styles.summaryValueRow}>
                <Text style={styles.summaryValue}>
                  {buyQuoting
                    ? '…'
                    : buyQuote
                      ? formatNaira(buyQuote.local)
                      : '—'}
                </Text>
              </View>
            </View>
          </Animated.View>
        </View>
        )}
        </>
      )}


      <PickerSheet
        visible={changeSellOpen}
        title="Change gift card"
        subtitle="Search and pick another brand to sell"
        fullScreen
        onClose={() => {
          setChangeSellOpen(false);
          setChangeSellQuery('');
        }}
        headerExtra={
          <SearchField
            value={changeSellQuery}
            onChangeText={setChangeSellQuery}
            placeholder="Search Amazon, Apple…"
          />
        }>
        <View style={styles.pickerList}>
          {changeSellOptions.map((brand) => {
            const active = selectedSell?.slug === brand.slug;
            const rate = rateMap[brand.slug];
            return (
              <Pressable
                key={brand.slug}
                onPress={() => {
                  setSelectedSell(brand);
                  setChangeSellOpen(false);
                  setChangeSellQuery('');
                }}
                style={[styles.pickerRow, active && styles.pickerRowActive]}>
                <GiftCardBrandLogo
                  brand={{
                    slug: brand.slug,
                    image: brand.image,
                    name: brand.name,
                  }}
                />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.pickerTitle} numberOfLines={1}>
                    {brand.name}
                  </Text>
                  <Text style={styles.pickerSub}>{brand.category}</Text>
                </View>
                <Text style={styles.pickerTrailing}>
                  {rate != null ? formatNaira(rate) : '—'}
                </Text>
              </Pressable>
            );
          })}
          {!changeSellOptions.length ? (
            <Text style={styles.emptyText}>No brands match your search</Text>
          ) : null}
        </View>
      </PickerSheet>

      <PickerSheet
        visible={changeBuyOpen}
        title="Change gift card"
        subtitle="Search and pick another product to buy"
        fullScreen
        onClose={() => {
          setChangeBuyOpen(false);
          setChangeBuyQuery('');
        }}
        headerExtra={
          <SearchField
            value={changeBuyQuery}
            onChangeText={setChangeBuyQuery}
            placeholder="Search brands…"
          />
        }>
        <View style={styles.pickerList}>
          {changeBuyOptions.map((product) => {
            const active = selectedBuy?.productId === product.productId;
            const from = product.denominations[0] ?? product.minAmount ?? 10;
            return (
              <Pressable
                key={product.productId}
                onPress={() => {
                  setSelectedBuy(product);
                  setChangeBuyOpen(false);
                  setChangeBuyQuery('');
                }}
                style={[styles.pickerRow, active && styles.pickerRowActive]}>
                <GiftCardBrandLogo
                  brand={{
                    image: product.image,
                    name: product.brandName,
                  }}
                  fallbacks={product.imageFallbacks}
                />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.pickerTitle} numberOfLines={1}>
                    {product.brandName}
                  </Text>
                  <Text style={styles.pickerSub} numberOfLines={1}>
                    {product.name}
                  </Text>
                </View>
                <Text style={styles.pickerTrailing}>
                  from {product.recipientCurrency} {from}
                </Text>
              </Pressable>
            );
          })}
          {!changeBuyOptions.length ? (
            <Text style={styles.emptyText}>No products match your search</Text>
          ) : null}
        </View>
      </PickerSheet>
    </Screen>
  );
}

function SearchField({
  value,
  onChangeText,
  placeholder,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.searchWrap}>
      <Ionicons name="search" size={16} color={colors.mutedForeground} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        style={styles.searchInput}
        autoCorrect={false}
        autoCapitalize="none"
      />
    </View>
  );
}

function FormSkeleton() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.stack}>
      <View style={[styles.card, { height: 72 }]} />
      <View style={[styles.card, { height: 220 }]} />
    </View>
  );
}

function CopyRow({
  label,
  value,
  onCopy,
}: {
  label: string;
  value: string;
  onCopy: () => void;
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.copyRow}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.copyLabel}>{label}</Text>
        <Text style={styles.copyValue} selectable>
          {value}
        </Text>
      </View>
      <Pressable onPress={onCopy} style={styles.copyBtn}>
        <Ionicons name="copy-outline" size={16} color={colors.foreground} />
      </Pressable>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    modeTabs: {
      flexDirection: 'row',
      gap: 8,
      padding: 6,
      marginBottom: 8,
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
    modeTabActive: { backgroundColor: Brand.orange },
    modeTabText: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.grayMedium,
    },
    modeTabTextActive: { color: Brand.white },
    errorBanner: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      marginBottom: 8,
      padding: 10,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: 'rgba(255,59,48,0.25)',
      backgroundColor: 'rgba(255,59,48,0.08)',
    },
    errorTitle: { fontSize: 13, fontWeight: '800', color: Brand.error },
    errorText: {
      marginTop: 3,
      fontSize: 12,
      fontWeight: '500',
      color: colors.charcoal,
    },
    stack: { gap: 10 },
    backLink: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      alignSelf: 'flex-start',
    },
    backLinkText: { fontSize: 13, fontWeight: '700', color: colors.grayMedium },
    card: {
      borderRadius: 22,
      borderWidth: 1,
      borderColor: colors.grayDivider,
      backgroundColor: colors.card,
      padding: 10,
    },
    brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    brandTitle: { fontSize: 16, fontWeight: '700', color: colors.charcoal },
    brandSub: {
      marginTop: 2,
      fontSize: 12,
      fontWeight: '500',
      color: colors.grayMedium,
    },
    rateCol: { alignItems: 'flex-end' },
    rateValue: { fontSize: 14, fontWeight: '800', color: colors.charcoal },
    rateUnit: { marginTop: 2, fontSize: 10, fontWeight: '500', color: colors.grayMedium },
    changeBtn: {
      width: 40,
      height: 40,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.grayDivider,
      backgroundColor: colors.grayLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    typeRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
    typeTab: {
      flex: 1,
      height: 44,
      borderRadius: 14,
      backgroundColor: colors.grayLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    typeTabActive: { backgroundColor: Brand.orange },
    typeTabText: { fontSize: 13, fontWeight: '700', color: colors.grayMedium },
    typeTabTextActive: { color: Brand.white },
    fieldLabel: {
      marginTop: 4,
      marginBottom: 8,
      fontSize: 12,
      fontWeight: '700',
      color: colors.grayMedium,
    },
    hint: {
      marginTop: 8,
      fontSize: 11,
      fontWeight: '500',
      color: colors.grayMedium,
    },
    chipRow: { flexDirection: 'row', gap: 8, paddingRight: 4, marginBottom: 10 },
    chip: {
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: 99,
      backgroundColor: colors.grayLight,
    },
    chipActive: { backgroundColor: Brand.orange },
    chipText: { fontSize: 12, fontWeight: '700', color: colors.grayMedium },
    chipTextActive: { color: Brand.white },
    input: {
      height: 44,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.grayDivider,
      backgroundColor: colors.card,
      paddingHorizontal: 10,
      fontSize: 14,
      fontWeight: '600',
      color: colors.charcoal,
    },
    mono: { fontFamily: 'Courier', letterSpacing: 0.4 },
    upload: {
      minHeight: 112,
      borderRadius: 18,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: colors.grayDivider,
      backgroundColor: colors.grayLight,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 12,
      gap: 4,
    },
    uploadTitle: { fontSize: 12, fontWeight: '700', color: colors.grayMedium },
    uploadSub: { fontSize: 10, fontWeight: '500', color: colors.grayMedium },
    thumbs: { flexDirection: 'row', gap: 8, marginTop: 12 },
    thumb: {
      width: 64,
      height: 64,
      borderRadius: 12,
      overflow: 'hidden',
      backgroundColor: colors.grayLight,
    },
    thumbImg: { width: '100%', height: '100%' },
    thumbRemove: {
      position: 'absolute',
      top: 4,
      right: 4,
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: 'rgba(0,0,0,0.7)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    summaryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    summaryLabel: { fontSize: 13, fontWeight: '500', color: colors.grayMedium },
    summaryValueRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    summaryValue: { fontSize: 16, fontWeight: '800', color: colors.charcoal },
    searchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      height: 44,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.grayDivider,
      backgroundColor: colors.card,
      paddingHorizontal: 12,
    },
    searchInput: {
      flex: 1,
      fontSize: 14,
      fontWeight: '600',
      color: colors.charcoal,
      paddingVertical: 0,
    },
    pickerList: { gap: 8 },
    pickerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      minHeight: 64,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.grayDivider,
      backgroundColor: colors.card,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    pickerRowActive: {
      borderColor: Brand.orange,
      backgroundColor: Brand.orangeMuted,
    },
    pickerTitle: { fontSize: 14, fontWeight: '700', color: colors.charcoal },
    pickerSub: {
      marginTop: 2,
      fontSize: 11,
      fontWeight: '500',
      color: colors.grayMedium,
    },
    pickerTrailing: { fontSize: 12, fontWeight: '800', color: Brand.orange },
    emptyText: {
      textAlign: 'center',
      paddingVertical: 10,
      fontSize: 13,
      fontWeight: '600',
      color: colors.grayMedium,
    },
    successMeta: {
      fontSize: 12,
      fontWeight: '500',
      color: colors.grayMedium,
      textAlign: 'center',
    },
    copyStack: { width: '100%', gap: 10 },
    copyCard: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.grayDivider,
      backgroundColor: colors.grayLight,
      padding: 12,
      gap: 10,
    },
    copyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    copyLabel: { fontSize: 11, fontWeight: '600', color: colors.grayMedium },
    copyValue: {
      marginTop: 2,
      fontSize: 14,
      fontWeight: '800',
      color: colors.charcoal,
    },
    copyBtn: {
      width: 36,
      height: 36,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.grayDivider,
      backgroundColor: colors.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
}
