import { Pressable, StyleSheet, Text, View } from 'react-native';

import { TransactionCategoryIcon } from '@/components/icons/transaction-category-icon';
import { Brand } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';
import { formatAbsoluteWhen, statusDisplayLabel } from '@/lib/history';
import type { AppTransaction } from '@/lib/types';

type Props = {
  item: AppTransaction;
  onPress?: () => void;
  compact?: boolean;
  /** absolute = "Aug 7th, 21:48:20" (history list); relative = "2h ago" */
  timeStyle?: 'relative' | 'absolute';
};

function formatWhen(createdAt: string) {
  if (!createdAt.includes('T')) return createdAt;
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return createdAt;

  const now = Date.now();
  const diffMs = now - date.getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

function normalizeStatus(status: string) {
  const s = status.trim().toLowerCase();
  if (s.includes('fail') || s.includes('declin') || s.includes('cancel')) {
    return 'failed' as const;
  }
  if (s.includes('pend') || s.includes('process') || s.includes('wait')) {
    return 'pending' as const;
  }
  return 'completed' as const;
}

export function TransactionRow({
  item,
  onPress,
  compact,
  timeStyle = 'relative',
}: Props) {
  const { colors, isDark } = useAppTheme();
  const credit = item.type === 'credit';
  const status = normalizeStatus(item.status);
  const iconColor = credit ? Brand.success : Brand.orange;
  const when =
    timeStyle === 'absolute' ? formatAbsoluteWhen(item.createdAt) : formatWhen(item.createdAt);

  const statusMeta =
    status === 'failed'
      ? {
          label: statusDisplayLabel(item.status),
          icon: 'close-circle' as const,
          bg: 'rgba(255,59,48,0.1)',
          fg: Brand.error,
        }
      : status === 'pending'
        ? {
            label: statusDisplayLabel(item.status),
            icon: 'time' as const,
            bg: Brand.orangeMuted,
            fg: Brand.orange,
          }
        : {
            label: statusDisplayLabel(item.status),
            icon: 'checkmark-circle' as const,
            bg: 'rgba(52,199,89,0.12)',
            fg: Brand.success,
          };

  const content = (
    <>
      <View style={[styles.iconWell, credit ? styles.creditBg : styles.debitBg]}>
        <TransactionCategoryIcon
          category={item.category}
          title={item.title}
          credit={credit}
          size={20}
          color={iconColor}
        />
      </View>

      <View style={styles.meta}>
        <View style={styles.topLine}>
          <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={1}>
            {item.title}
          </Text>
          <Text
            style={[
              styles.amount,
              credit ? styles.creditAmt : { color: colors.foreground },
            ]}>
            {item.amount}
          </Text>
        </View>

        <View style={styles.bottomLine}>
          <Text style={[styles.sub, { color: colors.mutedForeground }]} numberOfLines={1}>
            {timeStyle === 'absolute'
              ? when
              : `${item.subtitle}${item.subtitle ? ' · ' : ''}${when}`}
          </Text>
          <View style={[styles.statusPill, { backgroundColor: statusMeta.bg }]}>
            <Text style={[styles.statusText, { color: statusMeta.fg }]}>
              {statusMeta.label}
            </Text>
          </View>
        </View>
      </View>
    </>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.row,
          compact && styles.rowCompact,
          pressed && {
            backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(245,245,247,0.95)',
          },
        ]}>
        {content}
      </Pressable>
    );
  }

  return <View style={[styles.row, compact && styles.rowCompact]}>{content}</View>;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 18,
  },
  rowCompact: {
    paddingVertical: 10,
    paddingHorizontal: 6,
  },
  iconWell: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  creditBg: { backgroundColor: 'rgba(52,199,89,0.12)' },
  debitBg: { backgroundColor: Brand.orangeMuted },
  meta: { flex: 1, minWidth: 0, gap: 6 },
  topLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  title: {
    flex: 1,
    minWidth: 0,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
  amount: {
    fontSize: 14,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  creditAmt: { color: Brand.success },
  bottomLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  sub: {
    flex: 1,
    minWidth: 0,
    fontSize: 12,
    fontWeight: '500',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
  },
});
