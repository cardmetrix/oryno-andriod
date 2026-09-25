import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { PageHeader } from '@/components/app/page-header';
import { Screen } from '@/components/ui/screen';
import { Skeleton } from '@/components/ui/skeleton';
import { Brand, type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';
import { api } from '@/lib/api';
import { endpoints } from '@/lib/endpoints';
import { toast } from '@/lib/toast';

const HERO_BG = require('@/assets/images/international-gifting-bg.png');

type WaitlistStatus = {
  joined: boolean;
  joinedAt: string | null;
};

const DETAILS = [
  {
    icon: 'globe-outline' as const,
    title: 'Gifts Across Borders',
    body: 'Send thoughtful gifts to friends and family in other countries, right from your ORYNO account.',
  },
  {
    icon: 'gift-outline' as const,
    title: 'Thoughtfully Curated Gifts',
    body: 'Choose from flowers, cakes, personalized frames, wristwatches, fashion accessories, and other special gifts for every occasion.',
  },
  {
    icon: 'chatbubble-ellipses-outline' as const,
    title: 'Personal Written Notes',
    body: "Add a heartfelt message to your gift and let your loved ones know you're thinking of them, no matter the distance.",
  },
  {
    icon: 'car-outline' as const,
    title: 'Convenient Gift Delivery',
    body: 'We make it easy to celebrate birthdays, anniversaries, milestones, and special moments with loved ones abroad.',
  },
];

export default function InternationalGiftingScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [status, setStatus] = useState<WaitlistStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);

  const load = useCallback(async () => {
    try {
      const json = await api.get<WaitlistStatus>(endpoints.waitlist.internationalGifting);
      setStatus(json);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onJoin() {
    setJoining(true);
    try {
      const json = await api.post<{ created?: boolean }>(
        endpoints.waitlist.internationalGifting,
      );
      toast.success(
        json.created ? "You're on the waitlist" : "You're already on the waitlist",
        {
          description: "We'll notify you by email and push when gifting launches.",
        },
      );
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not join');
    } finally {
      setJoining(false);
    }
  }

  async function onLeave() {
    setJoining(true);
    try {
      await api.delete(endpoints.waitlist.internationalGifting);
      toast.success('Removed from waitlist');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not leave');
    } finally {
      setJoining(false);
    }
  }

  return (
    <Screen
      scroll
      header={
        <PageHeader
          title="International Gifting"
          subtitle="Send gifts worldwide"
          showBack
        />
      }>
      {loading || !status ? (
        <View style={{ gap: 16 }}>
          <Skeleton height={208} radius={22} />
          <Skeleton height={160} radius={22} />
        </View>
      ) : (
        <View style={{ gap: 16 }}>
          <HeroCard />
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>What you will get</Text>
            {DETAILS.map((item) => (
              <View key={item.title} style={styles.detailRow}>
                <View style={styles.iconBox}>
                  <Ionicons name={item.icon} size={16} color={Brand.orange} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.detailTitle}>{item.title}</Text>
                  <Text style={styles.detailBody}>{item.body}</Text>
                </View>
              </View>
            ))}
          </View>

          <View style={styles.panel}>
            {status.joined ? (
              <View style={{ gap: 12 }}>
                <View style={styles.detailRow}>
                  <View style={styles.joinedIcon}>
                    <Ionicons name="checkmark" size={16} color="#059669" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.detailTitle}>You are on the waitlist</Text>
                    <Text style={styles.detailBody}>
                      {status.joinedAt
                        ? `Joined ${new Date(status.joinedAt).toLocaleDateString('en-NG', { dateStyle: 'medium' })}`
                        : 'You will be notified at launch'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.detailBody}>
                  We will email and push you when International Gifting goes live.
                </Text>
                <Pressable
                  disabled={joining}
                  onPress={() => void onLeave()}
                  style={[styles.leaveBtn, joining && styles.disabled]}>
                  <Text style={styles.leaveText}>
                    {joining ? 'Leaving...' : 'Leave waitlist'}
                  </Text>
                </Pressable>
              </View>
            ) : (
              <View style={{ gap: 12 }}>
                <View>
                  <Text style={styles.detailTitle}>Join the waitlist</Text>
                  <Text style={[styles.detailBody, { marginTop: 2 }]}>
                    Get notified the moment International Gifting launches.
                  </Text>
                </View>
                <Pressable
                  disabled={joining}
                  onPress={() => void onJoin()}
                  style={[styles.joinBtn, joining && styles.disabled]}>
                  <Ionicons name="notifications-outline" size={16} color={Brand.white} />
                  <Text style={styles.joinText}>
                    {joining ? 'Joining...' : 'Join waitlist'}
                  </Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>
      )}
    </Screen>
  );
}

function HeroCard() {
  const shine = useSharedValue(0);

  useEffect(() => {
    shine.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 5500, easing: Easing.inOut(Easing.ease) }),
        withDelay(2000, withTiming(0, { duration: 0 })),
      ),
      -1,
      false,
    );
  }, [shine]);

  const shineStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: -160 + shine.value * 520 },
      { skewX: '-18deg' },
    ],
  }));

  return (
    <ImageBackground
      source={HERO_BG}
      resizeMode="cover"
      imageStyle={stylesHero.image}
      style={stylesHero.card}>
      <LinearGradient
        colors={[
          'rgba(0,0,0,0.5)',
          'rgba(0,0,0,0.22)',
          'rgba(0,0,0,0.06)',
          'rgba(0,0,0,0)',
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
      <Animated.View pointerEvents="none" style={[stylesHero.shine, shineStyle]}>
        <LinearGradient
          colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.15)', 'rgba(255,255,255,0)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      <View style={stylesHero.content}>
        <View style={stylesHero.top}>
          <Text style={stylesHero.brand}>ORYNO</Text>
          <View style={stylesHero.badge}>
            <Text style={stylesHero.badgeText}>COMING SOON</Text>
          </View>
        </View>
        <Text style={stylesHero.title}>International Gifting</Text>
        <Text style={stylesHero.body}>
          Send thoughtful gifts to your loved ones abroad — from beautiful flowers
          and delicious cakes to personalized frames, elegant wristwatches,
          accessories, and more. Add a heartfelt written note to make every gift
          truly personal.
        </Text>
      </View>
    </ImageBackground>
  );
}

const stylesHero = StyleSheet.create({
  card: {
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#1A0F0A',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  image: { borderRadius: 22 },
  shine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 120,
  },
  content: { padding: 20, gap: 16 },
  top: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  brand: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
  },
  badge: {
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  badgeText: {
    color: Brand.white,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  title: {
    color: Brand.white,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  body: {
    marginTop: -8,
    maxWidth: 448,
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
    lineHeight: 21,
  },
});

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    panel: {
      borderRadius: 22,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      padding: 16,
      gap: 12,
    },
    panelTitle: { fontSize: 14, fontWeight: '700', color: colors.foreground },
    detailRow: { flexDirection: 'row', gap: 12 },
    iconBox: {
      width: 36,
      height: 36,
      borderRadius: 12,
      backgroundColor: colors.muted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    joinedIcon: {
      width: 36,
      height: 36,
      borderRadius: 12,
      backgroundColor: 'rgba(16,185,129,0.15)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    detailTitle: { fontSize: 14, fontWeight: '700', color: colors.foreground },
    detailBody: {
      marginTop: 2,
      fontSize: 12,
      lineHeight: 18,
      color: colors.mutedForeground,
    },
    joinBtn: {
      height: 44,
      borderRadius: 999,
      backgroundColor: Brand.orange,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    joinText: { color: Brand.white, fontSize: 14, fontWeight: '800' },
    leaveBtn: {
      height: 44,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    leaveText: { fontSize: 14, fontWeight: '700', color: colors.mutedForeground },
    disabled: { opacity: 0.5 },
  });
}
