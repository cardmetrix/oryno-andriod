import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewToken,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Brand, Radius, type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';
import {
  useOnboardingSlides,
  type OnboardingSlide,
} from '@/hooks/use-onboarding';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

export default function OnboardingScreen() {
  const { colors, isDark } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);
  const { slides } = useOnboardingSlides();
  const listRef = useRef<FlatList<OnboardingSlide>>(null);
  const [index, setIndex] = useState(0);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems[0]?.index != null) setIndex(viewableItems[0].index);
    },
  ).current;

  const goGetStarted = () => {
    router.replace('/(auth)/register');
  };

  const goLogin = () => {
    router.replace('/(auth)/login');
  };

  const safeIndex = Math.min(index, Math.max(slides.length - 1, 0));
  const gradientColors = isDark
    ? ([colors.background, colors.card, '#1A120C'] as const)
    : (['#FFF5ED', '#FFFFFF', '#FFE8D6'] as const);

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[...gradientColors]}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.blob, styles.blobA]} />
      <View style={[styles.blob, styles.blobB]} />

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.topBar}>
          <View style={styles.logoWell}>
            <Image
              source={require('@/assets/images/oryno-icon.png')}
              style={styles.logo}
              contentFit="cover"
            />
          </View>
          <Text style={styles.brand}>ORYNO</Text>
          <Pressable onPress={goLogin} hitSlop={10} style={styles.skip}>
            <Text style={styles.skipText}>Skip</Text>
          </Pressable>
        </View>

        <FlatList
          ref={listRef}
          data={slides}
          keyExtractor={(item) => item.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          bounces={false}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={{ viewAreaCoveragePercentThreshold: 60 }}
          onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
            const i = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
            if (i !== index) setIndex(i);
          }}
          scrollEventThrottle={16}
          renderItem={({ item }) => (
            <View style={styles.slide}>
              <View style={styles.phoneWrap}>
                <LinearGradient
                  colors={[
                    'rgba(255,106,0,0.25)',
                    'rgba(255,140,66,0.08)',
                    'transparent',
                  ]}
                  style={styles.phoneGlow}
                />
                <View style={styles.phoneFrame}>
                  <Image
                    source={item.image}
                    style={styles.phoneImage}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                  />
                </View>
              </View>

              <View style={styles.glassWrap}>
                {Platform.OS === 'web' ? (
                  <View style={[styles.glass, styles.glassFallback]}>
                    <GlassCopy
                      title={item.title}
                      subtitle={item.subtitle}
                      step={safeIndex}
                      total={slides.length}
                    />
                  </View>
                ) : (
                  <BlurView
                    intensity={isDark ? 48 : 55}
                    tint={isDark ? 'dark' : 'light'}
                    style={styles.glass}>
                    <View style={styles.glassTint} />
                    <GlassCopy
                      title={item.title}
                      subtitle={item.subtitle}
                      step={safeIndex}
                      total={slides.length}
                    />
                  </BlurView>
                )}
              </View>
            </View>
          )}
        />

        <View style={styles.dots}>
          {slides.map((s, i) => (
            <View
              key={s.id}
              style={[styles.dot, i === safeIndex && styles.dotActive]}
            />
          ))}
        </View>

        <View style={styles.actions}>
          <Pressable
            onPress={goGetStarted}
            style={({ pressed }) => [
              styles.primary,
              pressed && { opacity: 0.92, transform: [{ scale: 0.985 }] },
            ]}>
            <Text style={styles.primaryText}>Get Started</Text>
          </Pressable>
          <Pressable onPress={goLogin} style={styles.secondary}>
            <Text style={styles.secondaryText}>Login</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

function GlassCopy({
  title,
  subtitle,
  step,
  total,
}: {
  title: string;
  subtitle: string;
  step: number;
  total: number;
}) {
  const { colors, isDark } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);
  return (
    <View style={styles.glassContent}>
      <Text style={styles.stepLabel}>
        Step {step + 1} of {total}
      </Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
}

function makeStyles(colors: ThemeColors, isDark: boolean) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    safe: { flex: 1 },
    blob: {
      position: 'absolute',
      borderRadius: 999,
      opacity: isDark ? 0.35 : 0.45,
    },
    blobA: {
      width: 260,
      height: 260,
      backgroundColor: 'rgba(255,106,0,0.22)',
      top: -60,
      right: -80,
    },
    blobB: {
      width: 220,
      height: 220,
      backgroundColor: 'rgba(255,140,66,0.18)',
      bottom: 120,
      left: -90,
    },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: 4,
      paddingBottom: 8,
      gap: 10,
    },
    logoWell: {
      width: 36,
      height: 36,
      borderRadius: 999,
      overflow: 'hidden',
    },
    logo: { width: '100%', height: '100%', borderRadius: 999,},
    brand: {
      flex: 1,
      fontSize: 18,
      fontWeight: '800',
      color: colors.foreground,
      letterSpacing: 1,
    },
    skip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 99,
      backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.55)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.7)',
    },
    skipText: { color: colors.mutedForeground, fontWeight: '700', fontSize: 13 },
    slide: {
      width: SCREEN_W,
      paddingHorizontal: 20,
      paddingTop: 8,
    },
    phoneWrap: {
      height: SCREEN_H * 0.42,
      alignItems: 'center',
      justifyContent: 'center',
    },
    phoneGlow: {
      position: 'absolute',
      width: SCREEN_W * 0.7,
      height: SCREEN_W * 0.7,
      borderRadius: 999,
    },
    phoneFrame: {
      width: SCREEN_W * 0.58,
      height: SCREEN_H * 0.4,
      borderRadius: 28,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.75)',
      backgroundColor: colors.card,
      shadowColor: Brand.orange,
      shadowOpacity: 0.22,
      shadowRadius: 28,
      shadowOffset: { width: 0, height: 16 },
      elevation: 10,
    },
    phoneImage: { width: '100%', height: '100%' },
    glassWrap: {
      marginTop: 10,
      borderRadius: Radius.card,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.65)',
      shadowColor: colors.foreground,
      shadowOpacity: isDark ? 0.2 : 0.08,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 8 },
    },
    glass: {
      borderRadius: Radius.card,
      overflow: 'hidden',
      minHeight: 150,
    },
    glassFallback: {
      backgroundColor: isDark ? 'rgba(23,23,27,0.88)' : 'rgba(255,255,255,0.72)',
    },
    glassTint: {
      ...StyleSheet.absoluteFill,
      backgroundColor: isDark ? 'rgba(15,15,18,0.35)' : 'rgba(255,255,255,0.35)',
    },
    glassContent: {
      paddingHorizontal: 20,
      paddingVertical: 18,
    },
    stepLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: Brand.orange,
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      marginBottom: 8,
    },
    title: {
      fontSize: 26,
      fontWeight: '800',
      color: colors.foreground,
      letterSpacing: -0.4,
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 14,
      lineHeight: 21,
      color: colors.mutedForeground,
      fontWeight: '500',
    },
    dots: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 8,
      marginTop: 16,
      marginBottom: 14,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 99,
      backgroundColor: colors.border,
    },
    dotActive: {
      width: 22,
      backgroundColor: Brand.orange,
    },
    actions: {
      paddingHorizontal: 20,
      paddingBottom: 12,
      gap: 10,
    },
    primary: {
      height: 54,
      borderRadius: Radius.lg,
      backgroundColor: Brand.orange,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: Brand.orange,
      shadowOpacity: 0.3,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
    },
    primaryText: { color: Brand.white, fontSize: 16, fontWeight: '800' },
    secondary: {
      height: 50,
      borderRadius: Radius.lg,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.55)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.8)',
    },
    secondaryText: { color: colors.foreground, fontSize: 15, fontWeight: '700' },
  });
}
