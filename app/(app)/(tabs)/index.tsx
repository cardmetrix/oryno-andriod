import { AdminAccessBanner } from '@/components/admin/admin-banner';
import { AdCarousel } from '@/components/app/ad-carousel';
import { TransactionRow } from '@/components/app/transaction-row';
import { WalletCard } from '@/components/app/wallet-card';
import { GiftCardIcon } from '@/components/icons/gift-card-icon';
import { Screen } from '@/components/ui/screen';
import { HomeSkeleton } from '@/components/ui/skeletons';
import { Brand } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';
import { useAdminAccess } from '@/hooks/use-admin-access';
import { useNotificationsQuery } from '@/hooks/use-notifications-query';
import { useProfile } from '@/hooks/use-profile';
import { usePullRefresh } from '@/hooks/use-pull-refresh';
import { useWallet } from '@/hooks/use-wallet';
import { useUser } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import type { ComponentProps, ReactNode } from 'react';
import { useCallback, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

type QuickAction = {
  label: string;
  href: string;
  icon?: IoniconName;
  renderIcon?: (color: string) => ReactNode;
};

const quickActions: QuickAction[] = [
  {
    label: 'Gift Cards',
    href: '/(app)/services/gift-cards',
    renderIcon: (color) => <GiftCardIcon size={20} color={color} strokeWidth={1.75} />,
  },
  { label: 'Boosting', icon: 'trending-up-outline', href: '/(app)/services/social' },
  { label: 'Numbers', icon: 'call-outline', href: '/(app)/services/virtual-numbers' },
  { label: 'Airtime', icon: 'phone-portrait-outline', href: '/(app)/services/airtime' },
  { label: 'Data', icon: 'wifi-outline', href: '/(app)/services/data' },
  { label: 'More', icon: 'ellipsis-horizontal', href: '/(app)/(tabs)/services' },
];

function chunkActions<T>(items: T[], size: number) {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    rows.push(items.slice(i, i + size));
  }
  return rows;
}

export default function HomeScreen() {
  const { user } = useUser();
  const { colors } = useAppTheme();
  const { data, loading, error, refresh } = useWallet();
  const { profile, refresh: refreshProfile } = useProfile();
  const {
    unreadCount,
    refresh: refreshNotifications,
    refreshIfStale: refreshNotificationsIfStale,
  } = useNotificationsQuery();
  const { canAccessAdmin, hasSession } = useAdminAccess();
  const firstName =
    data?.user.fullName?.split(' ')[0] ||
    user?.username ||
    user?.firstName ||
    user?.fullName?.split(' ')[0] ||
    'there';
  const avatarUrl =
    profile?.avatarUrl ||
    (typeof user?.publicMetadata?.avatarUrl === 'string'
      ? user.publicMetadata.avatarUrl
      : null) ||
    user?.imageUrl ||
    null;
  const initials = useMemo(() => {
    const name =
      data?.user.fullName || user?.fullName || user?.firstName || firstName || 'OR';
    return (
      name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0]?.toUpperCase() ?? '')
        .join('') || 'OR'
    );
  }, [data?.user.fullName, user?.fullName, user?.firstName, firstName]);
  const currency = data?.primary.currency ?? data?.country?.currency ?? 'NGN';
  const recent = (data?.recent ?? []).slice(0, 2);

  useFocusEffect(
    useCallback(() => {
      // Only refetch when stale — avoids focus→refetch loops on flaky networks.
      void refreshNotificationsIfStale();
    }, [refreshNotificationsIfStale]),
  );

  const { pulling, onRefresh } = usePullRefresh(async () => {
    await Promise.all([refresh(), refreshNotifications(), refreshProfile()]);
  });

  if (loading && !data) {
    return (
      <Screen scroll>
        <HomeSkeleton />
      </Screen>
    );
  }

  return (
    <Screen
      scroll
      refreshing={pulling}
      onRefresh={onRefresh}
      header={
        <View style={styles.header}>
          <Pressable
            style={styles.headerIdentity}
            onPress={() => router.push('/(app)/(tabs)/profile')}
            accessibilityLabel="Open profile">
            <View style={styles.logoWell}>
              <Image
                source={
                  avatarUrl
                    ? { uri: avatarUrl }
                    : require('@/assets/images/oryno-logo.png')
                }
                style={[styles.logo, !avatarUrl && styles.logoFallback]}
                contentFit="cover"
              />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                style={[styles.pageTitle, { color: colors.foreground }]}
                numberOfLines={1}>
                Welcome back, {firstName} 👋
              </Text>
            </View>
          </Pressable>

          <View style={styles.headerActions}>
            <Pressable
              style={[styles.bell, { backgroundColor: colors.muted }]}
              onPress={() => router.push('/(app)/notifications')}
              accessibilityLabel={
                unreadCount > 0
                  ? `Notifications, ${unreadCount} unread`
                  : 'Notifications'
              }>
              <Ionicons name="notifications-outline" size={20} color={colors.foreground} />
              {unreadCount > 0 ? (
                <View style={[styles.bellBadge, { borderColor: colors.muted }]}>
                  <Text style={styles.bellBadgeText}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          </View>
        </View>
      }>
      <WalletCard
        balanceFormatted={data?.primary.balanceFormatted}
        label={`${currency} Wallet`}
        loading={loading && !data}
      />

      {canAccessAdmin ? <AdminAccessBanner hasSession={hasSession} /> : null}

      <AdCarousel />

      {error ? (
        <Pressable onPress={refresh} style={styles.errorBox}>
          <Text style={styles.errorText}>{error}. Tap to retry.</Text>
        </Pressable>
      ) : null}

      <View
        style={[
          styles.panel,
          styles.qaPanel,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}>
        <View style={[styles.panelHead, styles.qaHead]}>
          <Text style={[styles.panelTitle, { color: colors.foreground }]}>Quick Actions</Text>
          <Pressable
            style={styles.linkRow}
            onPress={() => router.push('/(app)/(tabs)/services')}>
            <Text style={styles.link}>View all</Text>
            <Ionicons name="arrow-forward" size={13} color={Brand.orange} />
          </Pressable>
        </View>
        <View style={styles.qaGrid}>
          {chunkActions(quickActions, 3).map((row, rowIndex) => (
            <View key={`qa-row-${rowIndex}`} style={styles.qaGridRow}>
              {row.map((action) => (
                <Pressable
                  key={action.label}
                  style={({ pressed }) => [
                    styles.action,
                    styles.qaAction,
                    { backgroundColor: colors.muted },
                    pressed && styles.actionPressed,
                  ]}
                  onPress={() => router.push(action.href as never)}>
                  <View style={[styles.actionIcon, styles.qaActionIcon, { backgroundColor: colors.card }]}>
                    {action.renderIcon ? (
                      action.renderIcon(Brand.orange)
                    ) : (
                      <Ionicons name={action.icon!} size={20} color={Brand.orange} />
                    )}
                  </View>
                  <Text
                    style={[styles.actionLabel, { color: colors.foreground }]}
                    numberOfLines={1}>
                    {action.label}
                  </Text>
                </Pressable>
              ))}
              {row.length < 3
                ? Array.from({ length: 3 - row.length }).map((_, i) => (
                    <View key={`qa-pad-${i}`} style={styles.actionSpacer} />
                  ))
                : null}
            </View>
          ))}
        </View>
      </View>

      <View
        style={[
          styles.panel,
          styles.txPanel,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}>
        <View style={[styles.panelHead, styles.txPanelHead]}>
          <Text style={[styles.panelTitle, { color: colors.foreground }]}>
            Recent Transactions
          </Text>
          <Pressable
            style={styles.linkRow}
            onPress={() => router.push('/(app)/(tabs)/history')}>
            <Text style={styles.link}>See All</Text>
            <Ionicons name="arrow-forward" size={14} color={Brand.orange} />
          </Pressable>
        </View>

        {recent.length === 0 ? (
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIcon}>
              <Ionicons name="receipt-outline" size={20} color={Brand.orange} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              No transactions yet
            </Text>
            <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
              When you fund your wallet or pay for services, your activity will show up here.
            </Text>
            <View style={styles.emptyActions}>
              <Pressable style={styles.emptyPrimary} onPress={() => router.push('/(app)/fund')}>
                <Ionicons name="add" size={16} color={Brand.white} />
                <Text style={styles.emptyPrimaryText}>Fund wallet</Text>
              </Pressable>
              <Pressable
                style={[styles.emptySecondary, { backgroundColor: colors.muted }]}
                onPress={() => router.push('/(app)/(tabs)/services')}>
                <Text style={styles.emptySecondaryText}>Explore services</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.txList}>
            {recent.map((tx) => (
              <TransactionRow
                key={tx.id}
                item={tx}
                compact
                onPress={() => router.push(`/(app)/history/${tx.id}`)}
              />
            ))}
          </View>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingTop: 2,
    paddingBottom: 0,
  },
  headerIdentity: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: Brand.orangeMuted,
    borderWidth: 1.5,
    borderColor: 'rgba(255,106,0,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: { width: '100%', height: '100%', borderRadius: 999 },
  avatarText: {
    fontSize: 14,
    fontWeight: '800',
    color: Brand.orange,
  },
  pageTitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  hello: {
    fontSize: 12,
    marginTop: 0,
    fontWeight: '500',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  bell: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 15,
    height: 15,
    borderRadius: 999,
    paddingHorizontal: 3,
    backgroundColor: Brand.orange,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  bellBadgeText: {
    color: Brand.white,
    fontSize: 9,
    fontWeight: '800',
    lineHeight: 11,
  },
  errorBox: {
    marginTop: 8,
    padding: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255,59,48,0.08)',
  },
  errorText: { color: Brand.error, fontSize: 13 },
  panel: {
    marginTop: 8,
    borderRadius: 16,
    borderWidth: 1,
    padding: 10,
    overflow: 'hidden',
    shadowColor: '#0F0F12',
    shadowOpacity: 0.03,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  qaPanel: {
    marginTop: 6,
    padding: 8,
  },
  qaHead: {
    marginBottom: 4,
  },
  qaGrid: {
    gap: 4,
    width: '100%',
  },
  qaGridRow: {
    flexDirection: 'row',
    gap: 4,
    width: '100%',
  },
  qaAction: {
    gap: 2,
    paddingVertical: 5,
    paddingHorizontal: 2,
    borderRadius: 12,
  },
  qaActionIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
  },
  txPanel: {
    marginTop: 6,
    padding: 8,
    marginBottom: 28,
  },
  txPanelHead: {
    marginBottom: 2,
  },
  logoWell: {
    width: 34,
    height: 34,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: Brand.orange,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  logo: {
    width: '100%',
    height: '100%',
    borderRadius: 999,
  },
  logoFallback: {
    transform: [{ scale: 1.22 }],
  },
  panelHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  panelTitle: { fontSize: 14, fontWeight: '700' },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  link: { color: Brand.orange, fontWeight: '700', fontSize: 12 },
  action: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: 0,
    alignItems: 'center',
    gap: 4,
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  actionSpacer: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: 0,
  },
  actionPressed: {
    backgroundColor: Brand.orangeMuted,
    borderColor: 'rgba(255,106,0,0.18)',
    opacity: 0.92,
  },
  actionIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0F0F12',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  actionLabel: {
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
    width: '100%',
  },
  txList: { marginHorizontal: -2, gap: 0 },
  emptyWrap: { alignItems: 'center', paddingVertical: 4, paddingHorizontal: 6 },
  emptyIcon: {
    width: 40,
    height: 36,
    borderRadius: 12,
    backgroundColor: Brand.orangeMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,106,0,0.16)',
  },
  emptyTitle: { fontSize: 14, fontWeight: '800', letterSpacing: -0.2 },
  emptySub: {
    marginTop: 2,
    fontSize: 11,
    lineHeight: 15,
    textAlign: 'center',
  },
  emptyActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
    justifyContent: 'center',
  },
  emptyPrimary: {
    backgroundColor: Brand.orange,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  emptyPrimaryText: { color: Brand.white, fontWeight: '700', fontSize: 12 },
  emptySecondary: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  emptySecondaryText: { color: Brand.orange, fontWeight: '700', fontSize: 12 },
});
