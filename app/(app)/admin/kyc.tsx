import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useMemo, useState } from 'react';
import {
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AdminCard } from '@/components/admin/admin-card';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { AdminEmpty, AdminError, AdminLoading } from '@/components/admin/admin-state';
import { StatCard } from '@/components/admin/stat-card';
import { StatusBadge } from '@/components/admin/status-badge';
import { Screen } from '@/components/ui/screen';
import { Brand, Radius, type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';
import { useAdminQuery } from '@/hooks/use-admin-query';
import { adminApi, ApiError } from '@/lib/admin/api';
import { endpoints } from '@/lib/endpoints';
import { toast } from '@/lib/toast';

type Submission = {
  id: string;
  status: string;
  statusLabel: string;
  idType: string | null;
  idNumber: string | null;
  idFrontUrl: string | null;
  idBackUrl: string | null;
  selfieUrl: string | null;
  rejectionReason: string | null;
  createdAt: string | null;
  user: {
    id: string;
    name: string;
    email: string;
    country: string;
  };
};

const FILTERS = [
  { key: 'pending', label: 'Pending' },
  { key: 'verified', label: 'Verified' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'unverified', label: 'Unverified' },
  { key: '', label: 'All' },
];

function formatWhen(iso: string | null) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function AdminKycScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [status, setStatus] = useState('pending');
  const [review, setReview] = useState<Submission | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const insets = useSafeAreaInsets();

  const path = useMemo(
    () =>
      status
        ? `${endpoints.admin.kyc}?status=${encodeURIComponent(status)}`
        : endpoints.admin.kyc,
    [status],
  );

  const { data, loading, error, reload } = useAdminQuery<{
    submissions: Submission[];
    pendingCount: number;
  }>(path);

  async function act(action: 'approve' | 'reject') {
    if (!review) return;
    if (action === 'reject' && !reason.trim()) {
      toast.error('Enter a rejection reason');
      return;
    }
    setBusy(true);
    try {
      await adminApi.patch(endpoints.admin.kycItem(review.id), {
        action,
        reason: reason.trim() || undefined,
      });
      toast.success(action === 'approve' ? 'KYC approved' : 'KYC rejected');
      setReview(null);
      setReason('');
      await reload();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Failed to update KYC');
    } finally {
      setBusy(false);
    }
  }

  function closeReview() {
    setReview(null);
    setReason('');
  }

  return (
    <Screen scroll refreshing={loading} onRefresh={reload}>
      <AdminPageHeader
        title="KYC Management"
        subtitle="Review identity submissions and approve or reject"
      />

      <View style={styles.filters}>
        {FILTERS.map((f) => (
          <Pressable
            key={f.label}
            onPress={() => setStatus(f.key)}
            style={[styles.chip, status === f.key && styles.chipOn]}>
            <Text style={[styles.chipText, status === f.key && styles.chipTextOn]}>
              {f.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.stats}>
        <StatCard
          label="In this view"
          value={String(data?.submissions.length ?? '—')}
          change={status ? `Filter: ${status}` : 'All submissions'}
          up
        />
        <StatCard
          label="Pending (view)"
          value={String(data?.pendingCount ?? '—')}
          change="Needs review"
          up={(data?.pendingCount ?? 0) === 0}
        />
        <StatCard label="Queue" value="Live" change="Synced with user KYC" up />
      </View>

      {loading && !data ? <AdminLoading /> : null}
      {error ? <AdminError message={error} onRetry={reload} /> : null}

      {data ? (
        <AdminCard title="Submissions">
          {data.submissions.length === 0 ? (
            <AdminEmpty message="No KYC submissions for this filter." />
          ) : (
            data.submissions.map((s) => (
              <Pressable
                key={s.id}
                onPress={() => {
                  setReason('');
                  setReview(s);
                }}
                style={({ pressed }) => [styles.row, pressed && { opacity: 0.9 }]}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.title}>{s.user.name}</Text>
                  <Text style={styles.sub} numberOfLines={1}>
                    {s.user.email}
                  </Text>
                  <Text style={styles.meta}>
                    {s.user.country} · {s.idType || 'ID'}
                    {s.idNumber ? ` · ${s.idNumber}` : ''}
                  </Text>
                  <Text style={styles.when}>{formatWhen(s.createdAt)}</Text>
                </View>
                <View style={styles.rowRight}>
                  <StatusBadge status={s.statusLabel} />
                  <Text style={styles.reviewLink}>Review</Text>
                </View>
              </Pressable>
            ))
          )}
        </AdminCard>
      ) : null}

      <Modal
        visible={Boolean(review)}
        animationType="slide"
        transparent
        onRequestClose={closeReview}>
        <View style={styles.modalRoot}>
          <Pressable style={styles.backdrop} onPress={closeReview} />
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View style={styles.grabber} />
            <View style={styles.sheetHead}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetTitle}>Review KYC</Text>
                <Text style={styles.sheetSub}>
                  {review?.user.name} · {review?.user.email}
                </Text>
              </View>
              <Pressable onPress={closeReview} style={styles.closeBtn} hitSlop={8}>
                <Ionicons name="close" size={20} color={colors.foreground} />
              </Pressable>
            </View>

            <ScrollView
              style={styles.sheetScroll}
              contentContainerStyle={{ paddingBottom: 12 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled">
              {review ? (
                <>
                  <View style={styles.badges}>
                    <StatusBadge status={review.statusLabel} />
                    <Text style={styles.meta}>{review.user.country}</Text>
                  </View>

                  <View style={styles.idBox}>
                    <Text style={styles.idLine}>
                      <Text style={styles.idMuted}>Type: </Text>
                      {review.idType || '—'}
                    </Text>
                    <Text style={[styles.idLine, { marginTop: 6 }]}>
                      <Text style={styles.idMuted}>Number: </Text>
                      {review.idNumber || '—'}
                    </Text>
                    {review.rejectionReason ? (
                      <Text style={[styles.idLine, { marginTop: 6 }]}>
                        <Text style={styles.idMuted}>Prior reason: </Text>
                        {review.rejectionReason}
                      </Text>
                    ) : null}
                  </View>

                  <View style={styles.docRow}>
                    <DocChip href={review.idFrontUrl} label="Front ID" />
                    <DocChip href={review.idBackUrl} label="Back ID" />
                    <DocChip href={review.selfieUrl} label="Selfie" />
                  </View>

                  {review.idFrontUrl || review.selfieUrl || review.idBackUrl ? (
                    <View style={styles.previewGrid}>
                      {review.idFrontUrl ? (
                        <DocPreview uri={review.idFrontUrl} label="Front ID" />
                      ) : null}
                      {review.idBackUrl ? (
                        <DocPreview uri={review.idBackUrl} label="Back ID" />
                      ) : null}
                      {review.selfieUrl ? (
                        <DocPreview uri={review.selfieUrl} label="Selfie" />
                      ) : null}
                    </View>
                  ) : null}

                  <Text style={styles.reasonLabel}>Rejection reason</Text>
                  <TextInput
                    value={reason}
                    onChangeText={setReason}
                    placeholder="Required when rejecting…"
                    placeholderTextColor={colors.mutedForeground}
                    style={styles.reasonInput}
                    multiline
                    textAlignVertical="top"
                  />

                  <View style={styles.actions}>
                    <Pressable
                      disabled={busy || review.status === 'verified'}
                      onPress={() => void act('approve')}
                      style={({ pressed }) => [
                        styles.approveBtn,
                        (busy || review.status === 'verified') && styles.btnDisabled,
                        pressed && !busy && { opacity: 0.92 },
                      ]}>
                      <Text style={styles.approveText}>
                        {busy ? 'Saving…' : 'Approve'}
                      </Text>
                    </Pressable>
                    <Pressable
                      disabled={busy || review.status === 'rejected'}
                      onPress={() => void act('reject')}
                      style={({ pressed }) => [
                        styles.rejectBtn,
                        (busy || review.status === 'rejected') && styles.btnDisabled,
                        pressed && !busy && { opacity: 0.92 },
                      ]}>
                      <Text style={styles.rejectText}>Reject</Text>
                    </Pressable>
                  </View>
                </>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

function DocChip({ href, label }: { href: string | null; label: string }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  if (!href) {
    return (
      <View style={styles.docMissing}>
        <Text style={styles.docMissingText}>No {label}</Text>
      </View>
    );
  }
  return (
    <Pressable
      onPress={() => void Linking.openURL(href)}
      style={({ pressed }) => [styles.docChip, pressed && { opacity: 0.9 }]}>
      <Text style={styles.docChipText}>Open {label}</Text>
    </Pressable>
  );
}

function DocPreview({ uri, label }: { uri: string; label: string }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <Pressable
      onPress={() => void Linking.openURL(uri)}
      style={styles.previewWrap}>
      <Image source={{ uri }} style={styles.previewImage} contentFit="cover" />
      <Text style={styles.previewLabel}>{label}</Text>
    </Pressable>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  chip: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.muted,
  },
  chipOn: { backgroundColor: Brand.orange },
  chipText: { fontSize: 12, fontWeight: '700', color: colors.mutedForeground },
  chipTextOn: { color: Brand.white },
  stats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  title: { fontSize: 14, fontWeight: '700', color: colors.foreground },
  sub: { marginTop: 2, fontSize: 12, color: colors.mutedForeground },
  meta: { marginTop: 4, fontSize: 12, fontWeight: '600', color: colors.foreground },
  when: { marginTop: 4, fontSize: 11, color: colors.mutedForeground },
  rowRight: { alignItems: 'flex-end', gap: 8 },
  reviewLink: { fontSize: 13, fontWeight: '700', color: Brand.orange },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(28,28,30,0.4)',
  },
  sheet: {
    maxHeight: '92%',
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: 10,
  },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.foreground,
    letterSpacing: -0.3,
  },
  sheetSub: { marginTop: 3, fontSize: 13, color: colors.mutedForeground },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.muted,
  },
  sheetScroll: { maxHeight: '100%' },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  idBox: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: Radius.md,
    padding: 12,
    marginBottom: 12,
  },
  idLine: { fontSize: 14, color: colors.foreground, fontWeight: '600' },
  idMuted: { color: colors.mutedForeground, fontWeight: '500' },
  docRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  docChip: {
    flexGrow: 1,
    minWidth: '30%',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    backgroundColor: colors.orangeMuted,
  },
  docChipText: { fontSize: 11, fontWeight: '700', color: Brand.orange },
  docMissing: {
    flexGrow: 1,
    minWidth: '30%',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  docMissingText: { fontSize: 11, fontWeight: '600', color: colors.mutedForeground },
  previewGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 10 },
  previewWrap: {
    width: '48%',
    flexGrow: 1,
    borderRadius: Radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.muted,
  },
  previewImage: { width: '100%', height: 140 },
  previewLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.mutedForeground,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  reasonLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.mutedForeground,
    marginBottom: 6,
  },
  reasonInput: {
    minHeight: 72,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.muted,
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    color: colors.foreground,
    marginBottom: 10,
  },
  actions: { flexDirection: 'row', gap: 10 },
  approveBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: Brand.orange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  approveText: { fontSize: 14, fontWeight: '700', color: Brand.white },
  rejectBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,59,48,0.35)',
    backgroundColor: 'rgba(255,59,48,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectText: { fontSize: 14, fontWeight: '700', color: Brand.error },
  btnDisabled: { opacity: 0.45 },
});
}

