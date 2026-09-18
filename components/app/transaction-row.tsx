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
  /** Show hairline divider under the row (website home list). */
  showDivider?: boolean;
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
  if (s.includes('revers')) {
    return 'reversed' as const;
  }
  return 'completed' as const;
}

/** Category icon well tones — mirrors website `transaction-row`. */
function iconTone(category: string | undefined, credit: boolean) {
  const cat = (category ?? '').toLowerCase();
  if (cat === 'data' || cat === 'airtime' || cat === 'gift_card' || cat === 'giftcard') {
    return { bg: Brand.orangeMuted, fg: Brand.orange };
  }
  if (cat === 'bill' || cat === 'bills' || cat === 'electricity') {
    return { bg: 'rgba(245,158,11,0.12)', fg: '#D97706' };
  }
  if (cat === 'referral' || cat === 'cashback' || cat === 'fund' || cat === 'refund') {
    return { bg: 'rgba(52,199,89,0.12)', fg: Brand.success };
  }
  if (cat === 'social') {
    return { bg: 'rgba(139,92,246,0.12)', fg: '#7C3AED' };
  }
  if (cat === 'betting') {
    return { bg: 'rgba(16,185,129,0.12)', fg: '#059669' };
  }
  if (cat === 'virtual_number' || cat === 'numbers' || cat === 'email') {
    return { bg: 'rgba(14,165,233,0.12)', fg: '#0284C7' };
  }
  if (cat === 'fee') {
    return { bg: 'rgba(139,92,246,0.12)', fg: '#7C3AED' };
  }
  if (cat === 'withdraw' || cat === 'transfer') {
    return credit
      ? { bg: 'rgba(52,199,89,0.12)', fg: Brand.success }
      : { bg: Brand.orangeMuted, fg: Brand.orange };
  }
  return credit
    ? { bg: 'rgba(52,199,89,0.12)', fg: Brand.success }
    : { bg: Brand.orangeMuted, fg: Brand.orange };
}

function formatAmount(raw: string, credit: boolean) {
  if (raw.startsWith('+') || raw.startsWith('-')) return raw;
  return `${credit ? '+' : '-'}${raw}`;
}

export function TransactionRow({
  item,
  onPress,
  compact,
  timeStyle = 'relative',
  showDivider = false,
}: Props) {
  const { colors, isDark } = useAppTheme();
  const credit = item.type === 'credit';
  const status = normalizeStatus(item.status);
  const tone = iconTone(item.category, credit);
  const when =
    timeStyle === 'absolute' ? formatAbsoluteWhen(item.createdAt) : formatWhen(item.createdAt);

  const subtitle =
    item.category === 'virtual_number' || item.category === 'numbers'
      ? 'Tap to get SMS code'
      : timeStyle === 'absolute'
        ? when
        : when;

  const statusMeta =
    status === 'failed'
      ? { label: 'Failed', bg: 'rgba(255,59,48,0.1)', fg: Brand.error }
      : status === 'pending'
        ? { label: 'Pending', bg: Brand.orangeMuted, fg: Brand.orange }
        : status === 'reversed'
          ? {
              label: 'Reversed',
              bg: isDark ? 'rgba(255,255,255,0.08)' : colors.muted,
              fg: colors.mutedForeground,
            }
          : {
              label: statusDisplayLabel(item.status),
              bg: 'rgba(52,199,89,0.12)',
              fg: Brand.success,
            };

  const content = (
    <>
      <View style={[styles.iconWell, { backgroundColor: tone.bg }]}>
        <TransactionCategoryIcon
          category={item.category}
          title={item.title}
          credit={credit}
          size={18}
          color={tone.fg}
        />
      </View>

      <View style={styles.meta}>
        <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={[styles.sub, { color: colors.mutedForeground }]} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>

      <View style={styles.right}>
        <Text
          style={[
            styles.amount,
            credit ? styles.creditAmt : { color: colors.foreground },
          ]}>
          {formatAmount(item.amount, credit)}
        </Text>
        <View style={[styles.statusPill, { backgroundColor: statusMeta.bg }]}>
          <Text style={[styles.statusText, { color: statusMeta.fg }]}>{statusMeta.label}</Text>
        </View>
      </View>
    </>
  );

  const rowStyle = [
    styles.row,
    compact && styles.rowCompact,
    showDivider && {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
  ];

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          ...rowStyle,
          pressed && {
            backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(245,245,247,0.95)',
          },
        ]}>
        {content}
      </Pressable>
    );
  }

  return <View style={rowStyle}>{content}</View>;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  rowCompact: {
    paddingVertical: 12,
    paddingHorizontal: 2,
    gap: 12,
  },
  iconWell: {
    width: 44,
    height: 44,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  meta: { flex: 1, minWidth: 0, gap: 2 },
  title: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  sub: {
    fontSize: 12,
    fontWeight: '500',
  },
  right: {
    flexShrink: 0,
    alignItems: 'flex-end',
    gap: 4,
  },
  amount: {
    fontSize: 15,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  creditAmt: { color: Brand.success },
  statusPill: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
  },
});
