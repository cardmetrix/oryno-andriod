import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { GiftCardIcon } from '@/components/icons/gift-card-icon';
import { PageHeader } from '@/components/app/page-header';
import { Screen } from '@/components/ui/screen';
import { Brand, Radius, type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';
import { APP_VERSION_LABEL } from '@/lib/app-version';

const pillars = [
  {
    title: 'Premium fintech feel',
    description:
      'Clean layouts, soft shadows, rounded corners, and smooth motion — with ORYNO’s own identity.',
  },
  {
    title: 'Built for Africa',
    description:
      'Multi-country architecture with configurable currency, networks, bills, gateways, and payouts.',
  },
  {
    title: 'Secure by default',
    description:
      'OTP, 2FA-ready flows, encrypted APIs, KYC where required, and clear transaction logs.',
  },
];

const services: Array<{
  icon: keyof typeof Ionicons.glyphMap;
  customIcon?: 'gift';
  title: string;
  description: string;
  soon?: boolean;
}> = [
  { icon: 'wallet-outline', title: 'ORYNO Wallet', description: 'Fund, hold, spend, and withdraw locally.' },
  { icon: 'phone-portrait-outline', title: 'Airtime', description: 'Instant top-ups across mobile networks.' },
  { icon: 'wifi-outline', title: 'Data Bundles', description: 'Daily, weekly, and monthly packs.' },
  { icon: 'flash-outline', title: 'Electricity', description: 'Prepaid and postpaid discos with tokens.' },
  { icon: 'tv-outline', title: 'TV Subscriptions', description: 'Renew DStv, GOtv, StarTimes, and more.' },
  { icon: 'call-outline', title: 'Virtual Numbers', description: 'Buy or rent numbers for SMS verification.' },
  { icon: 'trending-up-outline', title: 'Social Boosting', description: 'Grow followers, likes, views, and engagement.' },
  {
    customIcon: 'gift',
    icon: 'gift-outline',
    title: 'Buy Gift Cards',
    description: 'Buy and sell gift cards with live rates.',
  },
  {
    icon: 'card-outline',
    title: 'USD Virtual Card',
    description: 'Spend your USD wallet online worldwide.',
    soon: true,
  },
];

const countries = [
  { flag: '🇳🇬', name: 'Nigeria', currency: 'NGN' },
  { flag: '🇬🇭', name: 'Ghana', currency: 'GHS' },
  { flag: '🇿🇦', name: 'South Africa', currency: 'ZAR' },
  { flag: '🇰🇪', name: 'Kenya', currency: 'KES' },
];

const values = [
  { title: 'Simple', text: 'First-time users should feel confident in seconds.' },
  { title: 'Fast', text: 'Instant services, clear statuses, and quick payouts.' },
  { title: 'Trustworthy', text: 'Transparent fees, secure flows, and reliable support.' },
  { title: 'Scalable', text: 'New countries join through configuration — not rewrites.' },
];

export default function AboutScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <Screen
      scroll
      header={
        <PageHeader
          title="About ORYNO"
          subtitle="Your Digital World, Simplified."
          showBack
        />
      }>
      <Animated.View entering={FadeIn.duration(220)}>
        <LinearGradient
          colors={[Brand.orange, '#FF8533']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}>
          <View style={styles.heroBrand}>
            <Image
              source={require('@/assets/images/oryno-icon.png')}
              style={styles.logo}
            />
            <View>
              <Text style={styles.heroEyebrow}>BRAND</Text>
              <Text style={styles.heroTitle}>ORYNO</Text>
            </View>
          </View>
          <Text style={styles.heroBody}>
            ORYNO is a premium digital services super app for Africa — airtime, data,
            bill payments, gift cards, virtual numbers, social boosting, and wallet
            payouts — with USD virtual cards on the way.
          </Text>
          <View style={styles.sloganPill}>
            <Ionicons name="sparkles-outline" size={14} color={Brand.white} />
            <Text style={styles.sloganText}>Your Digital World, Simplified.</Text>
          </View>
          <Text style={styles.version}>App {APP_VERSION_LABEL}</Text>
        </LinearGradient>
      </Animated.View>

      <View style={styles.pillarGrid}>
        {pillars.map((item, index) => (
          <Animated.View
            key={item.title}
            entering={FadeInDown.delay(60 + index * 40).duration(200)}
            style={styles.pillarCard}>
            <Text style={styles.pillarTitle}>{item.title}</Text>
            <Text style={styles.pillarBody}>{item.description}</Text>
          </Animated.View>
        ))}
      </View>

      <Animated.View entering={FadeInDown.delay(180).duration(200)} style={styles.section}>
        <View style={styles.sectionHead}>
          <View style={styles.sectionIcon}>
            <Ionicons name="globe-outline" size={20} color={Brand.orange} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionTitle}>What you can do with ORYNO</Text>
            <Text style={styles.sectionSub}>Phase 1 services for everyday digital life</Text>
          </View>
        </View>
        {services.map((service, index) => (
          <Animated.View
            key={service.title}
            entering={FadeInDown.delay(200 + index * 25).duration(180)}
            style={styles.serviceRow}>
            <View style={styles.serviceIcon}>
              {service.customIcon === 'gift' ? (
                <GiftCardIcon size={18} color={Brand.orange} strokeWidth={1.75} />
              ) : (
                <Ionicons name={service.icon} size={18} color={Brand.orange} />
              )}
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.serviceTitle}>{service.title}</Text>
              <Text style={styles.serviceBody}>{service.description}</Text>
            </View>
            {service.soon ? (
              <View style={styles.soonBadge}>
                <Text style={styles.soonText}>Soon</Text>
              </View>
            ) : null}
          </Animated.View>
        ))}
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(260).duration(200)} style={styles.section}>
        <Text style={styles.sectionTitle}>Multi-country ready</Text>
        <Text style={styles.sectionSub}>
          Initial target markets with local currency and payout routing.
        </Text>
        <View style={styles.countryGrid}>
          {countries.map((c) => (
            <View key={c.name} style={styles.countryCard}>
              <Text style={styles.flag}>{c.flag}</Text>
              <Text style={styles.countryName}>{c.name}</Text>
              <Text style={styles.countryCurrency}>{c.currency}</Text>
            </View>
          ))}
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(320).duration(200)} style={styles.section}>
        <View style={styles.sectionHead}>
          <View style={styles.sectionIcon}>
            <Ionicons name="shield-checkmark-outline" size={20} color={Brand.orange} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionTitle}>Our design principles</Text>
            <Text style={styles.sectionSub}>Minimal · Premium · Clean · Modern · Fast</Text>
          </View>
        </View>
        {values.map((v) => (
          <View key={v.title} style={styles.valueRow}>
            <Text style={styles.valueTitle}>{v.title}</Text>
            <Text style={styles.valueBody}>{v.text}</Text>
          </View>
        ))}
        <View style={styles.palette}>
          <Text style={styles.paletteLine}>
            <Text style={styles.paletteKey}>Primary</Text> #FF6A00
          </Text>
          <Text style={styles.paletteLine}>
            <Text style={styles.paletteKey}>Charcoal</Text> #1C1C1E
          </Text>
          <Text style={styles.paletteLine}>
            <Text style={styles.paletteKey}>White</Text> #FFFFFF
          </Text>
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(380).duration(200)} style={styles.footer}>
        <Text style={styles.footerTitle}>Need help or have feedback?</Text>
        <Text style={styles.footerSub}>
          Our support team is ready via chat, tickets, and email.
        </Text>
        <Pressable
          onPress={() => router.push('/(app)/support')}
          style={({ pressed }) => [styles.cta, pressed && { opacity: 0.92 }]}>
          <Text style={styles.ctaText}>Contact support</Text>
          <Ionicons name="arrow-forward" size={16} color={Brand.white} />
        </Pressable>
        <View style={styles.linkRow}>
          <Pressable onPress={() => router.push('/(app)/terms')}>
            <Text style={styles.link}>Terms</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/(app)/privacy')}>
            <Text style={styles.link}>Privacy</Text>
          </Pressable>
        </View>
      </Animated.View>
    </Screen>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    hero: {
      borderRadius: 28,
      padding: 22,
      overflow: 'hidden',
    },
    heroBrand: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    logo: { width: 48, height: 48, borderRadius: 14 },
    heroEyebrow: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 2,
      color: 'rgba(255,255,255,0.85)',
    },
    heroTitle: { fontSize: 28, fontWeight: '800', color: Brand.white },
    heroBody: {
      marginTop: 16,
      fontSize: 15,
      lineHeight: 22,
      color: 'rgba(255,255,255,0.92)',
    },
    sloganPill: {
      marginTop: 14,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      alignSelf: 'flex-start',
      backgroundColor: 'rgba(255,255,255,0.16)',
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    sloganText: { color: Brand.white, fontWeight: '700', fontSize: 13 },
    version: { marginTop: 10, fontSize: 12, color: 'rgba(255,255,255,0.75)' },
    pillarGrid: { marginTop: 16, gap: 10 },
    pillarCard: {
      borderRadius: 22,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      padding: 16,
    },
    pillarTitle: { fontSize: 14, fontWeight: '800', color: Brand.orange },
    pillarBody: {
      marginTop: 6,
      fontSize: 13,
      lineHeight: 19,
      color: colors.mutedForeground,
    },
    section: {
      marginTop: 16,
      borderRadius: 28,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      padding: 18,
    },
    sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
    sectionIcon: {
      width: 44,
      height: 44,
      borderRadius: 16,
      backgroundColor: Brand.orangeMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.foreground },
    sectionSub: { marginTop: 2, fontSize: 13, color: colors.mutedForeground },
    serviceRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.muted,
      padding: 12,
      marginTop: 10,
    },
    serviceIcon: {
      width: 40,
      height: 40,
      borderRadius: 14,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    serviceTitle: { fontSize: 14, fontWeight: '700', color: colors.foreground },
    serviceBody: { marginTop: 2, fontSize: 12, lineHeight: 17, color: colors.mutedForeground },
    soonBadge: {
      backgroundColor: Brand.orangeMuted,
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    soonText: { fontSize: 10, fontWeight: '800', color: Brand.orange },
    countryGrid: {
      marginTop: 14,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    countryCard: {
      width: '47%',
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.muted,
      paddingVertical: 14,
      alignItems: 'center',
    },
    flag: { fontSize: 28 },
    countryName: { marginTop: 6, fontSize: 14, fontWeight: '700', color: colors.foreground },
    countryCurrency: { fontSize: 12, color: colors.mutedForeground },
    valueRow: {
      marginTop: 10,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 12,
    },
    valueTitle: { fontSize: 14, fontWeight: '800', color: Brand.orange },
    valueBody: { marginTop: 4, fontSize: 13, color: colors.mutedForeground },
    palette: {
      marginTop: 14,
      borderRadius: 18,
      backgroundColor: colors.muted,
      padding: 14,
      gap: 6,
    },
    paletteLine: { fontSize: 13, color: colors.mutedForeground },
    paletteKey: { fontWeight: '700', color: colors.foreground },
    footer: {
      marginTop: 16,
      marginBottom: 8,
      borderRadius: 28,
      backgroundColor: colors.muted,
      padding: 18,
    },
    footerTitle: { fontSize: 16, fontWeight: '700', color: colors.foreground },
    footerSub: { marginTop: 4, fontSize: 13, color: colors.mutedForeground },
    cta: {
      marginTop: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: Brand.orange,
      borderRadius: 14,
      height: 48,
    },
    ctaText: { color: Brand.white, fontWeight: '800', fontSize: 15 },
    linkRow: { marginTop: 12, flexDirection: 'row', gap: 16 },
    link: { fontSize: 14, fontWeight: '700', color: Brand.orange },
  });
}
