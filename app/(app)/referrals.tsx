import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { PageHeader } from '@/components/app/page-header';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { FormSkeleton } from '@/components/ui/skeletons';
import { TextField } from '@/components/ui/text-field';
import { Brand, Radius, type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';
import { alert } from '@/lib/alert';
import { api } from '@/lib/api';
import { endpoints } from '@/lib/endpoints';
import { toast } from '@/lib/toast';

type ReferralsPayload = {
  program: {
    bonusNgn: number;
    bonusLabel: string;
    minTransactions: number;
    description: string;
  };
  code: {
    code: string;
    status: string;
    joinsCount: number;
    earnings: string;
    earningsLabel: string;
    shareUrl: string;
  };
  stats: { joins: number; pending: number; completed: number };
  invites: Array<{
    id: string;
    name: string;
    status: string;
    rewardAmount: string;
    currency: string;
    createdAt: string | null;
  }>;
  asReferred: {
    txCount: number;
    required: number;
    status: string;
    remaining: number;
  } | null;
};

export default function ReferralsScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [data, setData] = useState<ReferralsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [applyCode, setApplyCode] = useState('');
  const [applying, setApplying] = useState(false);

  const load = useCallback(async () => {
    try {
      const json = await api.get<ReferralsPayload>(endpoints.referrals);
      setData(json);
    } catch {
      setData(null);
      toast.error('Could not load referrals');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function copy(text: string, kind: 'code' | 'link') {
    try {
      await Clipboard.setStringAsync(text);
      toast.success(kind === 'code' ? 'Code copied' : 'Link copied');
    } catch {
      toast.error('Could not copy');
    }
  }

  async function share() {
    if (!data) return;
    const message = `Join ORYNO with my code ${data.code.code} and we both earn ${data.program.bonusLabel} after ${data.program.minTransactions} transactions.\n${data.code.shareUrl}`;
    try {
      await Share.share({ message, url: data.code.shareUrl });
    } catch {
      await copy(message, 'link');
    }
  }

  async function applyReferral() {
    const code = applyCode.trim();
    if (!code) {
      alert.warning('Missing code', 'Enter a referral code to continue.');
      return;
    }
    setApplying(true);
    try {
      const json = await api.post<{ message?: string }>(endpoints.referrals, {
        code,
      });
      toast.success(json.message || 'Referral linked');
      setApplyCode('');
      await load();
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : 'Could not apply referral code';
      toast.error(msg);
    } finally {
      setApplying(false);
    }
  }

  if (loading && !data) {
    return (
      <Screen scroll>
        <PageHeader
          title="Refer & Earn"
          subtitle="Invite friends and earn when they transact"
          showBack
        />
        <FormSkeleton />
      </Screen>
    );
  }

  if (!data) {
    return (
      <Screen scroll>
        <PageHeader
          title="Refer & Earn"
          subtitle="Invite friends and earn when they transact"
          showBack
        />
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Couldn’t load your referral details.</Text>
          <Button title="Retry" onPress={() => void load()} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <PageHeader
        title="Refer & Earn"
        subtitle="Invite friends and earn when they transact"
        showBack
      />

      <Animated.View entering={FadeInDown.duration(280)} style={styles.heroWrap}>
        <LinearGradient
          colors={['#FF8124', Brand.orange, '#E85D00']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons name="gift-outline" size={22} color={Brand.white} />
          </View>
          <Text style={styles.heroEyebrow}>Referral bonus</Text>
          <Text style={styles.heroTitle}>{data.program.bonusLabel} Each</Text>
          <Text style={styles.heroBody}>{data.program.description}</Text>
        </LinearGradient>
      </Animated.View>

      <Animated.View
        entering={FadeInDown.delay(40).duration(280)}
        style={styles.card}>
        <Text style={styles.sectionLabel}>Your code</Text>
        <View style={styles.codeRow}>
          <Text style={styles.code}>{data.code.code}</Text>
          <Pressable
            style={styles.iconBtn}
            onPress={() => void copy(data.code.code, 'code')}>
            <Ionicons name="copy-outline" size={18} color={Brand.orange} />
          </Pressable>
        </View>

        <Text style={styles.linkBox} numberOfLines={2}>
          {data.code.shareUrl}
        </Text>

        <View style={styles.actionsRow}>
          <Pressable
            style={styles.secondaryBtn}
            onPress={() => void copy(data.code.shareUrl, 'link')}>
            <Ionicons name="link-outline" size={16} color={colors.foreground} />
            <Text style={styles.secondaryBtnText}>Copy link</Text>
          </Pressable>
          <Pressable style={styles.primaryBtn} onPress={() => void share()}>
            <Ionicons name="share-outline" size={16} color={Brand.white} />
            <Text style={styles.primaryBtnText}>Share</Text>
          </Pressable>
        </View>

        <View style={styles.statsRow}>
          {[
            { label: 'Joins', value: data.stats.joins },
            { label: 'Pending', value: data.stats.pending },
            { label: 'Paid', value: data.stats.completed },
          ].map((s) => (
            <View key={s.label} style={styles.stat}>
              <Text style={styles.statLabel}>{s.label}</Text>
              <Text style={styles.statValue}>{s.value}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.earnings}>
          Earnings · {data.code.earningsLabel}
        </Text>
      </Animated.View>

      {data.asReferred ? (
        <Animated.View
          entering={FadeInDown.delay(80).duration(280)}
          style={styles.card}>
          <Text style={styles.sectionLabel}>Your progress</Text>
          <Text style={styles.progressTitle}>
            {data.asReferred.status === 'completed'
              ? 'Bonus unlocked'
              : `${data.asReferred.txCount} / ${data.asReferred.required} transactions`}
          </Text>
          <Text style={styles.progressBody}>
            {data.asReferred.status === 'completed'
              ? 'Your welcome bonus has been credited.'
              : `Complete ${data.asReferred.remaining} more to unlock your ${data.program.bonusLabel} bonus.`}
          </Text>
        </Animated.View>
      ) : (
        <Animated.View
          entering={FadeInDown.delay(80).duration(280)}
          style={styles.card}>
          <Text style={styles.sectionLabel}>Have a code?</Text>
          <TextField
            label="Referral code"
            value={applyCode}
            onChangeText={(v) => setApplyCode(v.toUpperCase())}
            autoCapitalize="characters"
            placeholder="e.g. AB12CD34"
          />
          <Button
            title="Apply code"
            loading={applying}
            onPress={() => void applyReferral()}
            style={{ marginTop: 8 }}
          />
        </Animated.View>
      )}

      <Animated.View
        entering={FadeInDown.delay(120).duration(280)}
        style={styles.card}>
        <Text style={styles.sectionLabel}>Your invites</Text>
        {data.invites.length === 0 ? (
          <Text style={styles.emptyInvites}>
            No invites yet. Share your code to get started.
          </Text>
        ) : (
          data.invites.map((invite, index) => (
            <View
              key={invite.id}
              style={[styles.inviteRow, index > 0 && styles.inviteBorder]}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.inviteName} numberOfLines={1}>
                  {invite.name}
                </Text>
                <Text style={styles.inviteMeta}>
                  {invite.status}
                  {invite.rewardAmount
                    ? ` · ${invite.currency} ${Number(invite.rewardAmount).toLocaleString('en-NG', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}`
                    : ''}
                </Text>
              </View>
              <View
                style={[
                  styles.badge,
                  invite.status === 'completed' && styles.badgeDone,
                ]}>
                <Text
                  style={[
                    styles.badgeText,
                    invite.status === 'completed' && styles.badgeTextDone,
                  ]}>
                  {invite.status}
                </Text>
              </View>
            </View>
          ))
        )}
      </Animated.View>
    </Screen>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    heroWrap: { marginBottom: 14 },
    hero: {
      borderRadius: Radius.card,
      padding: 20,
      gap: 6,
    },
    heroIcon: {
      width: 40,
      height: 40,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.2)',
      marginBottom: 6,
    },
    heroEyebrow: {
      color: 'rgba(255,255,255,0.78)',
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1.4,
      textTransform: 'uppercase',
    },
    heroTitle: {
      color: Brand.white,
      fontSize: 26,
      fontWeight: '800',
      letterSpacing: -0.4,
    },
    heroBody: {
      color: 'rgba(255,255,255,0.9)',
      fontSize: 14,
      lineHeight: 20,
      marginTop: 4,
    },
    card: {
      borderRadius: Radius.card,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      padding: 18,
      marginBottom: 14,
      gap: 10,
    },
    sectionLabel: {
      color: colors.mutedForeground,
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.8,
      textTransform: 'uppercase',
    },
    codeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    code: {
      flex: 1,
      fontSize: 24,
      fontWeight: '800',
      letterSpacing: 1.2,
      color: colors.foreground,
      fontVariant: ['tabular-nums'],
    },
    iconBtn: {
      width: 40,
      height: 40,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    linkBox: {
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: colors.border,
      borderRadius: Radius.lg,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: colors.mutedForeground,
      fontSize: 12,
      lineHeight: 17,
      backgroundColor: colors.muted,
    },
    actionsRow: { flexDirection: 'row', gap: 10, marginTop: 2 },
    secondaryBtn: {
      flex: 1,
      height: 44,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.muted,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    },
    secondaryBtnText: {
      color: colors.foreground,
      fontSize: 13,
      fontWeight: '700',
    },
    primaryBtn: {
      flex: 1,
      height: 44,
      borderRadius: Radius.lg,
      backgroundColor: Brand.orange,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    },
    primaryBtnText: {
      color: Brand.white,
      fontSize: 13,
      fontWeight: '700',
    },
    statsRow: { flexDirection: 'row', gap: 8, marginTop: 6 },
    stat: {
      flex: 1,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.muted,
      paddingVertical: 12,
      alignItems: 'center',
    },
    statLabel: {
      color: colors.mutedForeground,
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
    },
    statValue: {
      marginTop: 4,
      color: colors.foreground,
      fontSize: 18,
      fontWeight: '800',
    },
    earnings: {
      marginTop: 2,
      color: colors.mutedForeground,
      fontSize: 12,
      fontWeight: '600',
    },
    progressTitle: {
      color: colors.foreground,
      fontSize: 18,
      fontWeight: '800',
    },
    progressBody: {
      color: colors.mutedForeground,
      fontSize: 13,
      lineHeight: 19,
    },
    emptyInvites: {
      color: colors.mutedForeground,
      fontSize: 13,
      lineHeight: 19,
    },
    inviteRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 10,
    },
    inviteBorder: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    inviteName: {
      color: colors.foreground,
      fontSize: 14,
      fontWeight: '700',
    },
    inviteMeta: {
      marginTop: 2,
      color: colors.mutedForeground,
      fontSize: 12,
      textTransform: 'capitalize',
    },
    badge: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
      backgroundColor: colors.muted,
    },
    badgeDone: {
      backgroundColor: 'rgba(34,197,94,0.14)',
    },
    badgeText: {
      color: colors.mutedForeground,
      fontSize: 11,
      fontWeight: '700',
      textTransform: 'capitalize',
    },
    badgeTextDone: {
      color: '#16A34A',
    },
    empty: { gap: 14, paddingTop: 24 },
    emptyText: {
      color: colors.mutedForeground,
      fontSize: 14,
      textAlign: 'center',
    },
  });
}
