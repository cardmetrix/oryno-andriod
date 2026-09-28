import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AdminCard } from '@/components/admin/admin-card';
import { AdminEmpty, AdminError, AdminLoading } from '@/components/admin/admin-state';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { StatCard } from '@/components/admin/stat-card';
import { StatusBadge } from '@/components/admin/status-badge';
import { Screen } from '@/components/ui/screen';
import { Brand, Radius, type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';
import { useAdminQuery } from '@/hooks/use-admin-query';
import { adminApi } from '@/lib/admin/api';
import { endpoints } from '@/lib/endpoints';
import { toast } from '@/lib/toast';

type OrderRow = {
  id: string;
  status:
    | 'pending_payment'
    | 'paid_pending_review'
    | 'approved'
    | 'rejected'
    | 'issued';
  feeFormatted: string;
  localFormatted: string;
  localCurrency: string;
  paymentRef: string | null;
  paidAt: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    countryCode: string | null;
  };
};

const STATUS_LABEL: Record<OrderRow['status'], string> = {
  pending_payment: 'Pending payment',
  paid_pending_review: 'Awaiting review',
  approved: 'Approved',
  rejected: 'Rejected',
  issued: 'Issued',
};

export default function AdminVirtualCardsScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const { data, loading, error, reload } = useAdminQuery<{
    pendingCount: number;
    orders: OrderRow[];
  }>(endpoints.admin.virtualCards);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [noteById, setNoteById] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<'pending' | 'all'>('pending');

  const orders = useMemo(() => {
    const list = data?.orders ?? [];
    if (filter === 'pending') {
      return list.filter((o) => o.status === 'paid_pending_review');
    }
    return list;
  }, [data?.orders, filter]);

  async function review(orderId: string, action: 'approve' | 'reject') {
    setBusyId(orderId);
    try {
      await adminApi.patch(endpoints.admin.virtualCards, {
        orderId,
        action,
        note: noteById[orderId]?.trim() || undefined,
      });
      toast.success(action === 'approve' ? 'Card issued to user' : 'Purchase rejected');
      setNoteById((prev) => {
        const next = { ...prev };
        delete next[orderId];
        return next;
      });
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Screen
      scroll
      refreshing={loading}
      onRefresh={reload}
      header={
        <AdminPageHeader
          title="Virtual card purchases"
          subtitle="Review paid USD virtual card orders and issue cards"
        />
      }>
      {loading && !data ? <AdminLoading variant="stats" /> : null}
      {error ? <AdminError message={error} onRetry={reload} /> : null}
      {data ? (
        <>
          <View style={styles.stats}>
            <StatCard label="Awaiting review" value={String(data.pendingCount ?? 0)} />
            <StatCard label="Orders loaded" value={String(data.orders?.length ?? 0)} />
            <StatCard label="Filter" value={filter === 'pending' ? 'Pending' : 'All'} />
          </View>

          <View style={styles.filters}>
            {(['pending', 'all'] as const).map((key) => (
              <Pressable
                key={key}
                onPress={() => setFilter(key)}
                style={[styles.filterChip, filter === key && styles.filterChipActive]}>
                <Text style={[styles.filterText, filter === key && styles.filterTextActive]}>
                  {key === 'pending' ? 'Pending review' : 'All orders'}
                </Text>
              </Pressable>
            ))}
          </View>

          <AdminCard title="Orders">
            {orders.length === 0 ? (
              <AdminEmpty
                message={
                  filter === 'pending'
                    ? 'No paid card purchases awaiting review.'
                    : 'No virtual card orders yet.'
                }
              />
            ) : (
              orders.map((row) => {
                const busy = busyId === row.id;
                const canReview = row.status === 'paid_pending_review';
                return (
                  <View key={row.id} style={styles.row}>
                    <View style={styles.rowHead}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.title}>{row.user.name}</Text>
                        <Text style={styles.sub}>{row.user.email}</Text>
                        {row.user.countryCode ? (
                          <Text style={styles.meta}>{row.user.countryCode}</Text>
                        ) : null}
                      </View>
                      <StatusBadge
                        status={
                          row.status === 'paid_pending_review'
                            ? 'Pending'
                            : row.status === 'issued'
                              ? 'Approved'
                              : row.status === 'rejected'
                                ? 'Rejected'
                                : STATUS_LABEL[row.status]
                        }
                      />
                    </View>
                    <Text style={styles.amount}>
                      {row.localFormatted}
                      <Text style={styles.fee}> · Fee {row.feeFormatted}</Text>
                    </Text>
                    {row.paidAt ? (
                      <Text style={styles.meta}>
                        Paid {new Date(row.paidAt).toLocaleString()}
                      </Text>
                    ) : null}
                    {row.paymentRef ? (
                      <Text style={styles.ref} numberOfLines={1}>
                        Ref {row.paymentRef}
                      </Text>
                    ) : null}
                    {canReview ? (
                      <View style={styles.reviewBox}>
                        <TextInput
                          value={noteById[row.id] ?? ''}
                          onChangeText={(text) =>
                            setNoteById((prev) => ({ ...prev, [row.id]: text }))
                          }
                          placeholder="Optional note"
                          placeholderTextColor={colors.mutedForeground}
                          style={styles.noteInput}
                          editable={!busy}
                        />
                        <View style={styles.reviewActions}>
                          <Pressable
                            disabled={busy}
                            onPress={() => void review(row.id, 'approve')}
                            style={[styles.issueBtn, busy && styles.disabled]}>
                            {busy ? (
                              <ActivityIndicator color={Brand.success} size="small" />
                            ) : (
                              <Ionicons name="checkmark" size={16} color={Brand.success} />
                            )}
                            <Text style={styles.issueText}>Issue</Text>
                          </Pressable>
                          <Pressable
                            disabled={busy}
                            onPress={() => void review(row.id, 'reject')}
                            style={[styles.rejectBtn, busy && styles.disabled]}>
                            <Ionicons name="close" size={16} color={Brand.error} />
                            <Text style={styles.rejectText}>Reject</Text>
                          </Pressable>
                        </View>
                      </View>
                    ) : row.reviewNote ? (
                      <Text style={styles.meta}>{row.reviewNote}</Text>
                    ) : null}
                  </View>
                );
              })
            )}
          </AdminCard>
        </>
      ) : null}
    </Screen>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
    filterChip: {
      borderRadius: 999,
      paddingHorizontal: 14,
      paddingVertical: 8,
      backgroundColor: colors.muted,
      borderWidth: 1,
      borderColor: colors.border,
    },
    filterChipActive: { backgroundColor: Brand.orange, borderColor: Brand.orange },
    filterText: { fontSize: 12, fontWeight: '700', color: colors.mutedForeground },
    filterTextActive: { color: Brand.white },
    row: {
      paddingVertical: 14,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      gap: 6,
    },
    rowHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    title: { fontSize: 14, fontWeight: '700', color: colors.foreground },
    sub: { marginTop: 2, fontSize: 12, color: colors.mutedForeground },
    meta: { fontSize: 11, fontWeight: '600', color: colors.mutedForeground },
    amount: { fontSize: 14, fontWeight: '700', color: colors.foreground },
    fee: { fontWeight: '600', color: colors.mutedForeground },
    ref: { fontFamily: 'monospace', fontSize: 11, color: colors.mutedForeground },
    reviewBox: { marginTop: 8, gap: 8 },
    noteInput: {
      height: 40,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      paddingHorizontal: 10,
      fontSize: 13,
      color: colors.foreground,
    },
    reviewActions: { flexDirection: 'row', gap: 8 },
    issueBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      height: 40,
      borderRadius: Radius.md,
      backgroundColor: 'rgba(52,199,89,0.12)',
    },
    issueText: { fontSize: 12, fontWeight: '700', color: Brand.success },
    rejectBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      height: 40,
      borderRadius: Radius.md,
      backgroundColor: 'rgba(255,59,48,0.12)',
    },
    rejectText: { fontSize: 12, fontWeight: '700', color: Brand.error },
    disabled: { opacity: 0.5 },
  });
}
