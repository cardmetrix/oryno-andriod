import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { PageHeader } from '@/components/app/page-header';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { FormSkeleton } from '@/components/ui/skeletons';
import { Brand, Radius, type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';
import {
  getAccountLevels,
  levelCta,
  resolveUserLevel,
} from '@/lib/account-levels';
import { api } from '@/lib/api';
import { endpoints } from '@/lib/endpoints';
import type { ProfileDto } from '@/lib/types';

export default function AccountLevelsScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [profile, setProfile] = useState<ProfileDto | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const json = await api.get<{ profile: ProfileDto }>(endpoints.profile);
      setProfile(json.profile);
    } catch {
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const kycStatus = profile?.kycStatus || 'unverified';
  const kycLevel = profile?.kycLevel ?? 0;
  const current = useMemo(() => resolveUserLevel(kycLevel), [kycLevel]);
  const levels = useMemo(
    () => getAccountLevels(profile?.countryCode),
    [profile?.countryCode],
  );
  const cta = useMemo(
    () => levelCta({ kycLevel, kycStatus }),
    [kycLevel, kycStatus],
  );
  const progress = (Math.max(kycLevel, 0) / 3) * 100;
  const unlockedId = kycLevel;

  if (loading && !profile) {
    return (
      <Screen scroll>
        <PageHeader
          title="Account Levels"
          subtitle="Increase your daily limit by verifying your identity"
          showBack
        />
        <FormSkeleton />
      </Screen>
    );
  }

  return (
    <Screen
      scroll
      footer={
        <View style={styles.footer}>
          <Button
            title={cta.label}
            disabled={cta.disabled}
            onPress={() => {
              if (cta.disabled) return;
              router.push(cta.href as never);
            }}
          />
        </View>
      }>
      <PageHeader
        title="Account Levels"
        subtitle="Increase your daily limit by verifying your identity"
        showBack
      />

      <Animated.View entering={FadeInDown.duration(280)} style={styles.heroWrap}>
        <LinearGradient
          colors={['#FF8124', Brand.orange, '#E85D00']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}>
          <Text style={styles.heroEyebrow}>Your current level</Text>
          <View style={styles.heroTop}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.heroTitle}>
                {kycLevel > 0 ? current.name : 'Unverified'}
              </Text>
              <Text style={styles.heroSub}>
                {profile?.kycLabel || 'Complete Level 1 to get started'}
              </Text>
            </View>
            <View style={styles.limitPill}>
              <Text style={styles.limitPillLabel}>Daily limit</Text>
              <Text style={styles.limitPillValue}>
                {profile?.dailyLimitLabel ||
                  levels[Math.max(kycLevel, 1) - 1]?.dailyLimitLabel}
              </Text>
            </View>
          </View>
          <View style={styles.progressBlock}>
            <View style={styles.dots}>
              {([1, 2, 3] as const).map((id) => (
                <View
                  key={id}
                  style={[styles.dot, id <= unlockedId && styles.dotOn]}
                />
              ))}
            </View>
          </View>
        </LinearGradient>
      </Animated.View>

      {kycStatus === 'rejected' ? (
        <Animated.View
          entering={FadeInDown.delay(40).duration(240)}
          style={styles.rejectBanner}>
          <Text style={styles.rejectTitle}>Verification was rejected</Text>
          <Text style={styles.rejectBody}>
            Your daily limit is paused until you resubmit valid documents.
          </Text>
        </Animated.View>
      ) : null}

      <Animated.View
        entering={FadeInDown.delay(60).duration(260)}
        style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>Levels & features</Text>
      </Animated.View>

      {levels.map((level, index) => {
        const isCurrent = unlockedId > 0 && level.id === unlockedId;
        const isUnlocked = level.id <= unlockedId;
        const isNext = level.id === unlockedId + 1;

        return (
          <Animated.View
            key={level.id}
            entering={FadeInDown.delay(80 + index * 40).duration(260)}
            style={[
              styles.levelCard,
              isCurrent && styles.levelCardCurrent,
              !isUnlocked && styles.levelCardLocked,
            ]}>
            <View style={styles.levelHeader}>
              <View
                style={[
                  styles.levelIcon,
                  isCurrent && styles.levelIconCurrent,
                  !isUnlocked && styles.levelIconLocked,
                ]}>
                <Ionicons
                  name={
                    !isUnlocked
                      ? 'lock-closed-outline'
                      : level.id === 3
                        ? 'checkmark-circle'
                        : 'checkmark'
                  }
                  size={18}
                  color={isCurrent ? Brand.white : Brand.orange}
                />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={styles.levelTitleRow}>
                  <Text style={styles.levelName}>{level.name}</Text>
                  {isCurrent ? (
                    <View style={styles.badgeCurrent}>
                      <Text style={styles.badgeCurrentText}>Current</Text>
                    </View>
                  ) : null}
                  {isNext ? (
                    <View style={styles.badgeNext}>
                      <Text style={styles.badgeNextText}>Next</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.levelDesc}>{level.description}</Text>
                <Text style={[styles.levelDesc, { marginTop: 4 }]}>
                  Requires · {level.requirement}
                </Text>
                <Text style={styles.levelLimit}>
                  Daily limit · {level.dailyLimitLabel}
                </Text>
              </View>
            </View>

            <View style={styles.featureList}>
              {level.features.map((feature) => (
                <View key={feature} style={styles.featureRow}>
                  <View
                    style={[
                      styles.featureCheck,
                      !isUnlocked && styles.featureCheckLocked,
                    ]}>
                    <Ionicons
                      name="checkmark"
                      size={12}
                      color={isUnlocked ? Brand.orange : colors.grayMedium}
                    />
                  </View>
                  <Text
                    style={[
                      styles.featureText,
                      !isUnlocked && styles.featureTextLocked,
                    ]}>
                    {feature}
                  </Text>
                </View>
              ))}
            </View>
          </Animated.View>
        );
      })}

    </Screen>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    heroWrap: {
      borderRadius: 28,
      overflow: 'hidden',
      marginBottom: 14,
    },
    hero: {
      padding: 20,
    },
    heroEyebrow: {
      color: 'rgba(255,255,255,0.75)',
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 1.2,
      textTransform: 'uppercase',
    },
    heroTop: {
      marginTop: 8,
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 12,
    },
    heroTitle: {
      color: Brand.white,
      fontSize: 24,
      fontWeight: '800',
      letterSpacing: -0.3,
    },
    heroSub: {
      marginTop: 4,
      color: 'rgba(255,255,255,0.85)',
      fontSize: 13,
      fontWeight: '600',
    },
    limitPill: {
      backgroundColor: 'rgba(0,0,0,0.16)',
      borderRadius: 16,
      paddingHorizontal: 12,
      paddingVertical: 8,
      alignItems: 'flex-end',
    },
    limitPillLabel: {
      color: 'rgba(255,255,255,0.7)',
      fontSize: 10,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    limitPillValue: {
      marginTop: 2,
      color: Brand.white,
      fontSize: 16,
      fontWeight: '800',
    },
    progressBlock: { marginTop: 18 },
    progressLabels: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    progressLabel: {
      color: 'rgba(255,255,255,0.8)',
      fontSize: 11,
      fontWeight: '700',
    },
    progressTrack: {
      height: 8,
      borderRadius: 999,
      backgroundColor: 'rgba(0,0,0,0.2)',
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      borderRadius: 999,
      backgroundColor: Brand.white,
    },
    dots: { flexDirection: 'row', gap: 6, marginTop: 10 },
    dot: {
      flex: 1,
      height: 6,
      borderRadius: 999,
      backgroundColor: 'rgba(255,255,255,0.25)',
    },
    dotOn: { backgroundColor: Brand.white },
    rejectBanner: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: 'rgba(255,59,48,0.28)',
      backgroundColor: 'rgba(255,59,48,0.08)',
      paddingHorizontal: 14,
      paddingVertical: 12,
      marginBottom: 14,
    },
    rejectTitle: {
      fontSize: 13,
      fontWeight: '800',
      color: Brand.error,
    },
    rejectBody: {
      marginTop: 4,
      fontSize: 12,
      fontWeight: '500',
      color: colors.grayMedium,
      lineHeight: 17,
    },
    sectionHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 10,
      marginTop: 2,
    },
    sectionTitle: {
      fontSize: 14,
      fontWeight: '800',
      color: colors.charcoal,
    },
    levelCard: {
      borderRadius: 22,
      borderWidth: 1,
      borderColor: colors.grayDivider,
      backgroundColor: colors.card,
      padding: 16,
      marginBottom: 12,
    },
    levelCardCurrent: {
      borderColor: 'rgba(255,106,0,0.4)',
      backgroundColor: 'rgba(255,106,0,0.08)',
    },
    levelCardLocked: { opacity: 0.78 },
    levelHeader: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
    levelIcon: {
      width: 44,
      height: 44,
      borderRadius: 16,
      backgroundColor: 'rgba(255,106,0,0.12)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    levelIconCurrent: { backgroundColor: Brand.orange },
    levelIconLocked: { backgroundColor: colors.grayLight },
    levelTitleRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 8,
    },
    levelName: {
      fontSize: 15,
      fontWeight: '800',
      color: colors.charcoal,
    },
    badgeCurrent: {
      backgroundColor: Brand.orange,
      borderRadius: 6,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    badgeCurrentText: {
      color: Brand.white,
      fontSize: 10,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    badgeNext: {
      backgroundColor: colors.grayLight,
      borderRadius: 6,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    badgeNextText: {
      color: colors.grayMedium,
      fontSize: 10,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    levelDesc: {
      marginTop: 4,
      fontSize: 13,
      fontWeight: '500',
      color: colors.grayMedium,
      lineHeight: 18,
    },
    levelLimit: {
      marginTop: 8,
      fontSize: 13,
      fontWeight: '700',
      color: colors.charcoal,
    },
    featureList: {
      marginTop: 14,
      paddingTop: 14,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.grayDivider,
      gap: 10,
    },
    featureRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    featureCheck: {
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: 'rgba(255,106,0,0.12)',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 1,
    },
    featureCheckLocked: { backgroundColor: colors.grayLight },
    featureText: {
      flex: 1,
      fontSize: 13,
      fontWeight: '600',
      color: colors.charcoal,
      lineHeight: 18,
    },
    featureTextLocked: { color: colors.grayMedium },
    kycHint: {
      flexDirection: 'row',
      gap: 12,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.grayDivider,
      backgroundColor: colors.card,
      padding: 14,
      marginTop: 4,
      marginBottom: 8,
    },
    kycHintIcon: {
      width: 40,
      height: 40,
      borderRadius: 14,
      backgroundColor: 'rgba(255,106,0,0.12)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    kycHintTitle: {
      fontSize: 14,
      fontWeight: '800',
      color: colors.charcoal,
    },
    kycHintBody: {
      marginTop: 4,
      fontSize: 12,
      fontWeight: '500',
      color: colors.grayMedium,
      lineHeight: 17,
    },
    footer: { gap: 10 },
    backRow: {
      height: 48,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: colors.grayDivider,
      backgroundColor: colors.card,
      paddingHorizontal: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    backText: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.charcoal,
    },
  });
}
