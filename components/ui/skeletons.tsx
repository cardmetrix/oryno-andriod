import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { Skeleton } from '@/components/ui/skeleton';
import { Brand, Radius, type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';

export function WalletCardSkeleton() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={{ gap: 8 }}>
      <LinearGradient
        colors={['#FF8124', Brand.orange, '#E85D00']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.walletCard}>
        <View style={styles.row}>
          <Skeleton width={34} height={34} radius={10} tone="onOrange" />
          <View style={{ flex: 1, gap: 4 }}>
            <Skeleton width={64} height={9} tone="onOrange" />
            <Skeleton width={100} height={12} tone="onOrange" />
          </View>
        </View>
        <Skeleton width={100} height={9} tone="onOrange" style={{ marginTop: 10 }} />
        <View style={[styles.row, { marginTop: 8, alignItems: 'flex-end' }]}>
          <Skeleton width={150} height={24} tone="onOrange" />
          <Skeleton width={30} height={30} radius={15} tone="onOrange" />
        </View>
      </LinearGradient>
      <View style={[styles.row, { gap: 8 }]}>
        <Skeleton width="48%" height={44} radius={14} />
        <Skeleton width="48%" height={44} radius={14} />
      </View>
    </View>
  );
}

export function TransactionRowSkeleton() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.txRow}>
      <Skeleton width={44} height={44} radius={Radius.lg} />
      <View style={{ flex: 1, gap: 8 }}>
        <Skeleton width="70%" height={13} />
        <Skeleton width="45%" height={11} />
      </View>
      <View style={{ alignItems: 'flex-end', gap: 8 }}>
        <Skeleton width={64} height={13} />
        <Skeleton width={48} height={10} />
      </View>
    </View>
  );
}

export function TransactionListSkeleton({ count = 5 }: { count?: number }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.card}>
      {Array.from({ length: count }).map((_, i) => (
        <TransactionRowSkeleton key={i} />
      ))}
    </View>
  );
}

/** Full wallet tab skeleton — matches website WalletSkeleton. */
export function WalletPageSkeleton() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={{ gap: 12, paddingTop: 4 }}>
      <View style={[styles.row, { alignItems: 'flex-start', marginBottom: 2 }]}>
        <View style={{ flex: 1, gap: 8 }}>
          <Skeleton width={130} height={28} radius={10} />
          <Skeleton width={210} height={13} radius={8} />
        </View>
        <Skeleton width={40} height={40} radius={14} />
      </View>

      <View style={styles.walletPageCard}>
        <LinearGradient
          colors={['rgba(255,129,36,0.55)', 'rgba(255,106,0,0.45)', 'rgba(232,93,0,0.5)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.walletPageHero}>
          <Skeleton width={96} height={12} radius={999} tone="onOrange" />
          <Skeleton width={180} height={34} radius={999} tone="onOrange" style={{ marginTop: 10 }} />
          <Skeleton width={140} height={14} radius={999} tone="onOrange" style={{ marginTop: 10 }} />
          <View style={[styles.row, { marginTop: 14, gap: 10 }]}>
            <Skeleton width="48%" height={50} radius={16} tone="onOrange" />
            <Skeleton width="48%" height={50} radius={16} tone="onOrange" />
          </View>
        </LinearGradient>
      </View>

      <View style={styles.pagerDots}>
        <Skeleton width={24} height={8} radius={999} />
        <Skeleton width={8} height={8} radius={999} />
      </View>

      <View style={[styles.row, { gap: 10 }]}>
        {Array.from({ length: 3 }).map((_, i) => (
          <View key={i} style={styles.statBone}>
            <Skeleton width={32} height={32} radius={12} />
            <Skeleton width={48} height={10} radius={999} style={{ marginTop: 10 }} />
            <Skeleton width={64} height={14} radius={999} style={{ marginTop: 6 }} />
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <View style={[styles.row, { marginBottom: 10 }]}>
          <Skeleton width={44} height={44} radius={16} />
          <View style={{ flex: 1, gap: 8 }}>
            <Skeleton width={120} height={14} />
            <Skeleton width={160} height={11} />
          </View>
          <Skeleton width={88} height={40} radius={14} />
        </View>
        <View style={{ gap: 10 }}>
          <Skeleton width="100%" height={78} radius={18} />
          <Skeleton width="100%" height={78} radius={18} />
        </View>
      </View>

      <View style={styles.card}>
        <Skeleton width={140} height={16} style={{ marginBottom: 10 }} />
        {Array.from({ length: 4 }).map((_, i) => (
          <TransactionRowSkeleton key={i} />
        ))}
      </View>
    </View>
  );
}

export function HomeSkeleton() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={{ gap: 8, paddingTop: 0 }}>
      <View style={[styles.row, { alignItems: 'center' }]}>
        <View style={{ flex: 1, gap: 4 }}>
          <Skeleton width={64} height={18} />
          <Skeleton width={130} height={12} />
        </View>
        <Skeleton width={36} height={36} radius={12} />
      </View>
      <WalletCardSkeleton />
      <Skeleton width="100%" height={118} radius={18} />
      <View style={styles.card}>
        <View style={[styles.row, { marginBottom: 8 }]}>
          <Skeleton width={96} height={14} />
          <Skeleton width={52} height={12} />
        </View>
        <View style={styles.grid3}>
          {Array.from({ length: 6 }).map((_, i) => (
            <View key={i} style={styles.actionBone}>
              <Skeleton width={36} height={36} radius={12} />
              <Skeleton width={44} height={9} />
            </View>
          ))}
        </View>
      </View>
      <View style={styles.card}>
        <Skeleton width={130} height={14} style={{ marginBottom: 8 }} />
        <TransactionListSkeleton count={3} />
      </View>
    </View>
  );
}

export function ServiceGridSkeleton({ count = 6 }: { count?: number }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={{ gap: 10, marginTop: 12 }}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={styles.serviceRow}>
          <Skeleton width={44} height={44} radius={16} />
          <View style={{ flex: 1, gap: 8 }}>
            <Skeleton width="55%" height={14} />
            <Skeleton width="75%" height={11} />
          </View>
          <Skeleton width={18} height={18} radius={9} />
        </View>
      ))}
    </View>
  );
}

export function ChipRowSkeleton({ count = 4 }: { count?: number }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.chipRow}>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} width={78} height={36} radius={99} />
      ))}
    </View>
  );
}

export function FormSkeleton() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={{ gap: 10, marginTop: 12 }}>
      <Skeleton width={90} height={12} />
      <ChipRowSkeleton />
      <Skeleton width={120} height={12} style={{ marginTop: 8 }} />
      <Skeleton width="100%" height={48} radius={Radius.md} />
      <Skeleton width={100} height={12} />
      <View style={styles.chipRow}>
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} width="30%" height={40} radius={99} />
        ))}
      </View>
      <Skeleton width="100%" height={54} radius={Radius.lg} style={{ marginTop: 8 }} />
    </View>
  );
}

export function NotificationListSkeleton({ count = 5 }: { count?: number }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={{ gap: 10, marginTop: 12 }}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={styles.notif}>
          <Skeleton width={10} height={10} radius={5} />
          <View style={{ flex: 1, gap: 8 }}>
            <Skeleton width="60%" height={14} />
            <Skeleton width="90%" height={12} />
            <Skeleton width={64} height={10} />
          </View>
        </View>
      ))}
    </View>
  );
}

export function SettingsSkeleton() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={{ gap: 12, marginTop: 4 }}>
      <Skeleton width="100%" height={118} radius={Radius.card} />
      {Array.from({ length: 3 }).map((_, section) => (
        <View key={section} style={{ gap: 8 }}>
          <Skeleton width={88} height={12} style={{ marginLeft: 4 }} />
          <View style={styles.settingsSectionCard}>
            {Array.from({ length: section === 1 ? 3 : 4 }).map((__, i) => (
              <View
                key={i}
                style={[
                  styles.settingsSectionRow,
                  i > 0 && styles.settingsSectionRowBorder,
                ]}>
                <Skeleton width={40} height={40} radius={16} />
                <View style={{ flex: 1, gap: 6 }}>
                  <Skeleton width="46%" height={14} />
                  <Skeleton width="62%" height={11} />
                </View>
                <Skeleton width={16} height={16} radius={4} />
              </View>
            ))}
          </View>
        </View>
      ))}
      <Skeleton width="100%" height={52} radius={18} />
    </View>
  );
}

export function ProfileSkeleton() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={{ gap: 12, paddingTop: 4 }}>
      <Skeleton width={100} height={28} />
      <Skeleton width={180} height={13} />
      <View style={styles.profileHeroModern}>
        <Skeleton width="100%" height={104} radius={0} />
        <View style={{ alignItems: 'center', marginTop: -48, paddingBottom: 14 }}>
          <Skeleton width={96} height={96} radius={48} />
          <Skeleton width={160} height={22} style={{ marginTop: 10 }} />
          <Skeleton width={100} height={14} style={{ marginTop: 8 }} />
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            <Skeleton width={90} height={28} radius={999} />
            <Skeleton width={44} height={28} radius={999} />
          </View>
        </View>
      </View>
      <View style={styles.card}>
        {Array.from({ length: 5 }).map((_, i) => (
          <View key={i} style={[styles.row, { paddingVertical: 12 }]}>
            <Skeleton width={40} height={40} radius={16} />
            <View style={{ flex: 1, gap: 8 }}>
              <Skeleton width={80} height={11} />
              <Skeleton width="60%" height={14} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

export function DetailSkeleton() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={{ gap: 10, marginTop: 12 }}>
      <Skeleton width={120} height={12} />
      <Skeleton width="70%" height={28} />
      <Skeleton width="40%" height={14} />
      <View style={[styles.card, { marginTop: 8, gap: 10 }]}>
        {Array.from({ length: 5 }).map((_, i) => (
          <View key={i} style={styles.row}>
            <Skeleton width={90} height={12} />
            <Skeleton width={110} height={12} />
          </View>
        ))}
      </View>
      <Skeleton width="100%" height={48} radius={Radius.lg} />
    </View>
  );
}

/** @deprecated Prefer SplashLoading — kept as alias for boot/auth gates. */
export { SplashLoading as FullScreenSkeleton } from '@/components/ui/splash-loading';

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
  walletCard: {
    borderRadius: 20,
    padding: 12,
    minHeight: 112,
  },
  walletPageCard: {
    borderRadius: Radius.card,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.grayDivider,
    backgroundColor: colors.card,
  },
  walletPageHero: {
    paddingHorizontal: 12,
    paddingVertical: 14,
    minHeight: 168,
  },
  pagerDots: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  statBone: {
    flex: 1,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.grayDivider,
    backgroundColor: colors.card,
    padding: 10,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  card: {
    borderRadius: Radius.card,
    padding: 12,
    backgroundColor: colors.card,
  },
  grid3: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  actionBone: {
    width: '31%',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.grayLight,
    borderRadius: 18,
    paddingVertical: 10,
  },
  serviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: Radius.xl,
    backgroundColor: colors.grayLight,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  notif: {
    flexDirection: 'row',
    gap: 12,
    padding: 12,
    borderRadius: Radius.xl,
    backgroundColor: colors.grayLight,
    alignItems: 'flex-start',
  },
  settingsSectionCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.grayDivider,
    backgroundColor: colors.card,
    overflow: 'hidden',
  },
  settingsSectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  settingsSectionRowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.grayDivider,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: colors.grayDivider,
    backgroundColor: colors.card,
  },
  profileHero: {
    alignItems: 'center',
    backgroundColor: colors.grayLight,
    borderRadius: Radius.card,
    padding: 14,
  },
  profileHeroModern: {
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: colors.grayDivider,
    backgroundColor: colors.card,
    overflow: 'hidden',
  },
});
}

