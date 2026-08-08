import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { Brand } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';
import { useHomeAds } from '@/hooks/use-ads';

const INTERVAL_MS = 10_000;
const DEFAULT_COLORS = [
  'rgba(28,28,30,0.88)',
  'rgba(28,28,30,0.35)',
  'transparent',
] as const;
const CAROUSEL_HEIGHT = 148;

function isExternalHref(href: string) {
  return /^https?:\/\//i.test(href.trim());
}

function toAppHref(href: string) {
  if (href.startsWith('/(app)/')) return href;
  if (href.startsWith('/')) return `/(app)${href}`;
  return `/(app)/${href}`;
}

function openAdHref(href: string) {
  const value = href.trim();
  if (isExternalHref(value)) {
    void Linking.openURL(value);
    return;
  }
  router.push(toAppHref(value) as never);
}

/** Live ads from /api/ads — reserves height while loading to avoid layout jump. */
export function AdCarousel() {
  const { colors } = useAppTheme();
  const { ads, loaded } = useHomeAds();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [ads.length]);

  useEffect(() => {
    if (ads.length <= 1) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % ads.length);
    }, INTERVAL_MS);
    return () => clearInterval(id);
  }, [ads.length]);

  if (!loaded) {
    return (
      <View
        style={[
          styles.placeholder,
          { backgroundColor: colors.muted, borderColor: colors.border },
        ]}
      />
    );
  }

  if (ads.length === 0) return null;

  const safeIndex = index % ads.length;
  const ad = ads[safeIndex];
  const overlayColors = (ad.overlayColors?.length ? ad.overlayColors : DEFAULT_COLORS) as [
    string,
    string,
    ...string[],
  ];

  return (
    <Pressable
      style={[styles.wrap, { backgroundColor: colors.muted, borderColor: colors.border }]}
      onPress={() => openAdHref(ad.href)}>
      <Animated.View
        key={ad.id}
        entering={FadeIn.duration(420)}
        exiting={FadeOut.duration(280)}
        style={StyleSheet.absoluteFill}>
        <Image
          source={{ uri: ad.imageUrl }}
          style={styles.image}
          contentFit="cover"
          cachePolicy="memory-disk"
          priority="high"
        />
        <LinearGradient
          colors={overlayColors}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.35)']}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            { width: `${((safeIndex + 1) / ads.length) * 100}%` },
          ]}
        />
      </View>

      <View style={styles.dots}>
        {ads.map((item, i) => (
          <Pressable
            key={item.id}
            onPress={() => setIndex(i)}
            style={[styles.dot, i === safeIndex && styles.dotActive]}
          />
        ))}
      </View>

      <View style={styles.copy}>
        {ad.badge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{ad.badge}</Text>
          </View>
        ) : null}
        <Text style={styles.title}>{ad.title}</Text>
        {ad.subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {ad.subtitle}
          </Text>
        ) : null}
        <View style={styles.ctaRow}>
          <Text style={styles.cta}>Explore</Text>
          <Ionicons name="arrow-forward" size={14} color="rgba(255,255,255,0.95)" />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    height: CAROUSEL_HEIGHT,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: 14,
  },
  placeholder: {
    height: CAROUSEL_HEIGHT,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: 14,
  },
  image: { ...StyleSheet.absoluteFillObject },
  progressTrack: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Brand.orange,
  },
  dots: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    gap: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  dotActive: {
    width: 16,
    backgroundColor: Brand.white,
  },
  copy: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 14,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: Brand.orange,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginBottom: 6,
  },
  badgeText: {
    color: Brand.white,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  title: {
    color: Brand.white,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    marginTop: 2,
  },
  ctaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 10,
  },
  cta: {
    color: 'rgba(255,255,255,0.95)',
    fontSize: 12,
    fontWeight: '700',
  },
});
