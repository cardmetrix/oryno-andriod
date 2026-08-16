import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Skeleton } from '@/components/ui/skeleton';
import { Brand, Radius, type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';

export type AdminSkeletonVariant =
  | 'table'
  | 'stats'
  | 'overview'
  | 'reports'
  | 'settings'
  | 'cards';

type AdminLoadingProps = {
  variant?: AdminSkeletonVariant;
  rows?: number;
};

export function AdminLoading({ variant = 'table', rows = 6 }: AdminLoadingProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <Animated.View
      entering={FadeIn.duration(280)}
      style={styles.wrap}
      accessibilityRole="progressbar"
      accessibilityLabel="Loading">
      {variant === 'overview' ? (
        <OverviewSkeleton />
      ) : variant === 'stats' ? (
        <StatsSkeleton />
      ) : variant === 'cards' ? (
        <CardsSkeleton />
      ) : variant === 'reports' ? (
        <ReportsSkeleton />
      ) : variant === 'settings' ? (
        <SettingsSkeleton />
      ) : (
        <TableSkeleton rows={rows} />
      )}
    </Animated.View>
  );
}

function StatsSkeleton() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.statsGrid}>
      {Array.from({ length: 4 }).map((_, i) => (
        <View key={i} style={styles.statCard}>
          <Skeleton width="55%" height={11} radius={999} />
          <Skeleton width="70%" height={22} radius={999} style={{ marginTop: 10 }} />
          <Skeleton width="40%" height={10} radius={999} style={{ marginTop: 10 }} />
        </View>
      ))}
    </View>
  );
}

function TableSkeleton({ rows }: { rows: number }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <Skeleton width={120} height={14} radius={999} />
        <Skeleton width={72} height={28} radius={12} />
      </View>
      {Array.from({ length: rows }).map((_, i) => (
        <View key={i} style={styles.row}>
          <Skeleton width={40} height={40} radius={14} />
          <View style={{ flex: 1, gap: 8 }}>
            <Skeleton width="68%" height={13} radius={999} />
            <Skeleton width="42%" height={11} radius={999} />
          </View>
          <Skeleton width={56} height={22} radius={999} />
        </View>
      ))}
    </View>
  );
}

function CardsSkeleton() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.cardsGrid}>
      {Array.from({ length: 6 }).map((_, i) => (
        <View key={i} style={styles.miniCard}>
          <Skeleton width={36} height={36} radius={12} />
          <Skeleton width="70%" height={12} radius={999} style={{ marginTop: 10 }} />
          <Skeleton width="50%" height={10} radius={999} style={{ marginTop: 6 }} />
        </View>
      ))}
    </View>
  );
}

function OverviewSkeleton() {
  return (
    <View style={{ gap: 10, marginTop: 4 }}>
      <StatsSkeleton />
      <TableSkeleton rows={4} />
      <TableSkeleton rows={3} />
    </View>
  );
}

function ReportsSkeleton() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={{ gap: 10 }}>
      <StatsSkeleton />
      <View style={styles.card}>
        <Skeleton width={110} height={14} radius={999} />
        <View style={{ marginTop: 10, gap: 12 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <View key={i} style={styles.reportRow}>
              <Skeleton width="36%" height={12} radius={999} />
              <Skeleton width="28%" height={12} radius={999} />
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

function SettingsSkeleton() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.card}>
      <Skeleton width={100} height={14} radius={999} />
      {Array.from({ length: 5 }).map((_, i) => (
        <View key={i} style={styles.settingsRow}>
          <View style={{ flex: 1, gap: 8 }}>
            <Skeleton width="55%" height={13} radius={999} />
            <Skeleton width="40%" height={11} radius={999} />
          </View>
          <Skeleton width={48} height={28} radius={999} />
        </View>
      ))}
    </View>
  );
}

export function AdminError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.box}>
      <Text style={styles.error}>{message}</Text>
      {onRetry ? (
        <Pressable onPress={onRetry} style={styles.retry}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function AdminEmpty({ message }: { message: string }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.center}>
      <Text style={styles.muted}>{message}</Text>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    wrap: { marginTop: 8, width: '100%' },
    center: { alignItems: 'center', paddingVertical: 10, gap: 10 },
    muted: { fontSize: 13, color: colors.mutedForeground },
    box: {
      marginTop: 12,
      padding: 10,
      borderRadius: Radius.md,
      backgroundColor: 'rgba(255,59,48,0.08)',
      gap: 10,
    },
    error: { color: Brand.error, fontSize: 13, fontWeight: '600' },
    retry: {
      alignSelf: 'flex-start',
      backgroundColor: Brand.orange,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    retryText: { color: Brand.white, fontWeight: '700', fontSize: 13 },
    statsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    statCard: {
      flexGrow: 1,
      flexBasis: '46%',
      minWidth: '46%',
      borderRadius: Radius.lg,
      backgroundColor: colors.card,
      padding: 10,
    },
    card: {
      marginTop: 4,
      borderRadius: Radius.card,
      backgroundColor: colors.card,
      padding: 12,
    },
    cardHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    cardsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    miniCard: {
      flexGrow: 1,
      flexBasis: '46%',
      minWidth: '46%',
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      padding: 10,
    },
    reportRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    settingsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
  });
}
