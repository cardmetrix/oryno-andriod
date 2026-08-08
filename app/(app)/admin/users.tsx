import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
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
import { StatusBadge } from '@/components/admin/status-badge';
import { Screen } from '@/components/ui/screen';
import { Brand, Radius, type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';
import { useAdminQuery } from '@/hooks/use-admin-query';
import { adminApi, ApiError } from '@/lib/admin/api';
import { endpoints } from '@/lib/endpoints';
import { toast } from '@/lib/toast';

type UserRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  country: string;
  status: string;
  statusLabel: string;
  kyc: string;
  kycLabel: string;
  balance: string;
  balances: Array<{
    balanceFormatted: string;
    currency: string;
    status: string;
    isPrimary: boolean;
  }>;
};

type UserDetail = {
  user: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    username: string | null;
    country: string;
    countryCode: string | null;
    status: string;
    statusLabel: string;
    kyc: string;
    kycLabel: string;
    lastLoginAt: string | null;
    createdAt: string | null;
  };
  wallets: Array<{
    id: string;
    currency: string;
    balanceFormatted: string;
    status: string;
    statusLabel: string;
    isPrimary: boolean;
  }>;
  kycSubmission: {
    id: string;
    status: string;
    statusLabel: string;
    idType: string | null;
    idNumber: string | null;
    idFrontUrl: string | null;
    idBackUrl: string | null;
    selfieUrl: string | null;
    rejectionReason: string | null;
  } | null;
  transactions: Array<{
    id: string;
    title: string;
    amount: string;
    status: string;
    category: string;
    when: string;
  }>;
};

const STATUS_FILTERS = [
  { key: '', label: 'All status' },
  { key: 'active', label: 'Active' },
  { key: 'suspended', label: 'Suspended' },
  { key: 'deleted', label: 'Deleted' },
];

const KYC_FILTERS = [
  { key: '', label: 'All KYC' },
  { key: 'unverified', label: 'Unverified' },
  { key: 'pending', label: 'Pending' },
  { key: 'verified', label: 'Verified' },
  { key: 'rejected', label: 'Rejected' },
];

export default function AdminUsersScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [kycFilter, setKycFilter] = useState('');
  const [manageId, setManageId] = useState<string | null>(null);

  const path = useMemo(() => {
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    if (statusFilter) params.set('status', statusFilter);
    if (kycFilter) params.set('kyc', kycFilter);
    const qs = params.toString();
    return qs ? `${endpoints.admin.users}?${qs}` : endpoints.admin.users;
  }, [q, statusFilter, kycFilter]);

  const { data, loading, error, reload } = useAdminQuery<{ users: UserRow[] }>(path);

  return (
    <Screen scroll refreshing={loading} onRefresh={reload}>
      <AdminPageHeader
        title="Users"
        subtitle="Balances, KYC, suspend / activate, and wallet controls"
      />

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={16} color={colors.mutedForeground} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Search users…"
          placeholderTextColor={colors.mutedForeground}
          style={styles.searchInput}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      <View style={styles.filterRow}>
        {STATUS_FILTERS.map((f) => (
          <Chip
            key={`s-${f.key || 'all'}`}
            label={f.label}
            active={statusFilter === f.key}
            onPress={() => setStatusFilter(f.key)}
          />
        ))}
      </View>
      <View style={styles.filterRow}>
        {KYC_FILTERS.map((f) => (
          <Chip
            key={`k-${f.key || 'all'}`}
            label={f.label}
            active={kycFilter === f.key}
            onPress={() => setKycFilter(f.key)}
          />
        ))}
      </View>

      {loading && !data ? <AdminLoading variant="table" rows={8} /> : null}
      {error ? <AdminError message={error} onRetry={reload} /> : null}

      {data ? (
        <AdminCard>
          {data.users.length === 0 ? (
            <AdminEmpty message="No users found." />
          ) : (
            data.users.map((u) => (
              <View key={u.id} style={styles.userRow}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.name} numberOfLines={1}>
                    {u.name}
                  </Text>
                  <Text style={styles.sub} numberOfLines={1}>
                    {u.email}
                  </Text>
                  <Text style={styles.meta} numberOfLines={1}>
                    {u.country}
                    {u.balances?.length > 1 ? ` · ${u.balances.length} wallets` : ''}
                  </Text>
                  <Text style={styles.balance}>{u.balance}</Text>
                  <View style={styles.badges}>
                    <StatusBadge status={u.statusLabel} />
                    <StatusBadge status={u.kycLabel} />
                  </View>
                </View>
                <Pressable
                  onPress={() => setManageId(u.id)}
                  style={({ pressed }) => [styles.manageBtn, pressed && { opacity: 0.9 }]}>
                  <Text style={styles.manageText}>Manage</Text>
                </Pressable>
              </View>
            ))
          )}
        </AdminCard>
      ) : null}

      <UserManageSheet
        userId={manageId}
        onClose={() => setManageId(null)}
        onChanged={reload}
      />
    </Screen>
  );
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active && styles.chipOn]}>
      <Text style={[styles.chipText, active && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

function UserManageSheet({
  userId,
  onClose,
  onChanged,
}: {
  userId: string | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const insets = useSafeAreaInsets();
  const open = Boolean(userId);
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!userId) {
      setDetail(null);
      setNote('');
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const json = await adminApi.get<UserDetail>(endpoints.admin.user(userId));
        if (!cancelled) setDetail(json);
      } catch (e) {
        if (!cancelled) {
          toast.error(e instanceof ApiError ? e.message : 'Failed to load user');
          onClose();
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Reload only when the managed user changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function patch(body: Record<string, unknown>, success: string) {
    if (!userId) return;
    setBusy(true);
    try {
      await adminApi.patch(endpoints.admin.user(userId), {
        ...body,
        note: note || undefined,
      });
      toast.success(success);
      const refreshed = await adminApi.get<UserDetail>(endpoints.admin.user(userId));
      setDetail(refreshed);
      onChanged();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Update failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.grabber} />
          <View style={styles.sheetHead}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sheetTitle}>Manage user</Text>
              <Text style={styles.sheetSub}>Full account, wallet, and KYC controls</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={8}>
              <Ionicons name="close" size={20} color={colors.foreground} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.sheetScroll}
            contentContainerStyle={{ paddingBottom: 24 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled">
            {loading || !detail ? (
              <AdminLoading variant="settings" />
            ) : (
              <>
                <Text style={styles.detailName}>{detail.user.name}</Text>
                <Text style={styles.sub}>{detail.user.email}</Text>
                <View style={[styles.badges, { marginTop: 8 }]}>
                  <StatusBadge status={detail.user.statusLabel} />
                  <StatusBadge status={detail.user.kycLabel} />
                  <Text style={styles.meta}>{detail.user.country}</Text>
                </View>

                <Section title="Balances">
                  {detail.wallets.length === 0 ? (
                    <Text style={styles.sub}>No wallets</Text>
                  ) : (
                    detail.wallets.map((w) => (
                      <View key={w.id} style={styles.walletRow}>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={styles.name}>
                            {w.balanceFormatted}
                            {w.isPrimary ? (
                              <Text style={styles.primaryTag}> Primary</Text>
                            ) : null}
                          </Text>
                          <Text style={styles.sub}>
                            {w.currency} · {w.statusLabel}
                          </Text>
                        </View>
                        <View style={styles.walletActions}>
                          <SmallBtn
                            label="Freeze"
                            disabled={busy || w.status === 'frozen'}
                            onPress={() =>
                              void patch(
                                { walletId: w.id, walletStatus: 'frozen' },
                                `${w.currency} wallet frozen`,
                              )
                            }
                          />
                          <SmallBtn
                            label="Unfreeze"
                            disabled={busy || w.status === 'healthy'}
                            onPress={() =>
                              void patch(
                                { walletId: w.id, walletStatus: 'healthy' },
                                `${w.currency} wallet unfrozen`,
                              )
                            }
                          />
                        </View>
                      </View>
                    ))
                  )}
                </Section>

                <Section title="Account status">
                  <View style={styles.actionGrid}>
                    <ActionBtn
                      label="Activate"
                      primary={detail.user.status === 'active'}
                      disabled={busy || detail.user.status === 'active'}
                      onPress={() => void patch({ status: 'active' }, 'User activated')}
                    />
                    <ActionBtn
                      label="Suspend"
                      danger
                      disabled={busy || detail.user.status === 'suspended'}
                      onPress={() => void patch({ status: 'suspended' }, 'User suspended')}
                    />
                    <ActionBtn
                      label="Freeze wallets"
                      disabled={busy}
                      onPress={() =>
                        void patch({ freezeAllWallets: true }, 'All wallets frozen')
                      }
                    />
                    <ActionBtn
                      label="Unfreeze wallets"
                      disabled={busy}
                      onPress={() =>
                        void patch({ unfreezeAllWallets: true }, 'All wallets unfrozen')
                      }
                    />
                  </View>
                </Section>

                <Section title="KYC">
                  <View style={styles.actionGrid}>
                    <ActionBtn
                      label="Verify KYC"
                      primary
                      disabled={busy || detail.user.kyc === 'verified'}
                      onPress={() => void patch({ kycStatus: 'verified' }, 'KYC verified')}
                    />
                    <ActionBtn
                      label="Reject KYC"
                      danger
                      disabled={busy || detail.user.kyc === 'rejected'}
                      onPress={() => void patch({ kycStatus: 'rejected' }, 'KYC rejected')}
                    />
                    <ActionBtn
                      label="Mark pending"
                      disabled={busy || detail.user.kyc === 'pending'}
                      onPress={() =>
                        void patch({ kycStatus: 'pending' }, 'KYC set to pending')
                      }
                    />
                    <ActionBtn
                      label="Reset KYC"
                      disabled={busy || detail.user.kyc === 'unverified'}
                      onPress={() =>
                        void patch({ kycStatus: 'unverified' }, 'KYC reset to unverified')
                      }
                    />
                  </View>

                  {detail.kycSubmission ? (
                    <View style={styles.kycBox}>
                      <Text style={styles.sub}>
                        Submission: {detail.kycSubmission.statusLabel}
                        {detail.kycSubmission.idType
                          ? ` · ${detail.kycSubmission.idType}`
                          : ''}
                      </Text>
                      {detail.kycSubmission.idNumber ? (
                        <Text style={[styles.sub, { marginTop: 4 }]}>
                          ID: {detail.kycSubmission.idNumber}
                        </Text>
                      ) : null}
                      <View style={styles.docLinks}>
                        {detail.kycSubmission.idFrontUrl ? (
                          <DocLink label="Front ID" url={detail.kycSubmission.idFrontUrl} />
                        ) : null}
                        {detail.kycSubmission.idBackUrl ? (
                          <DocLink label="Back ID" url={detail.kycSubmission.idBackUrl} />
                        ) : null}
                        {detail.kycSubmission.selfieUrl ? (
                          <DocLink label="Selfie" url={detail.kycSubmission.selfieUrl} />
                        ) : null}
                      </View>
                    </View>
                  ) : null}
                </Section>

                <Text style={styles.noteLabel}>Note / rejection reason</Text>
                <TextInput
                  value={note}
                  onChangeText={setNote}
                  placeholder="Optional note sent with suspend / KYC reject…"
                  placeholderTextColor={colors.mutedForeground}
                  style={styles.noteInput}
                  multiline
                  textAlignVertical="top"
                />

                <Section title="Recent transactions">
                  {detail.transactions.length === 0 ? (
                    <Text style={styles.sub}>No transactions</Text>
                  ) : (
                    detail.transactions.map((t) => (
                      <View key={t.id} style={styles.txRow}>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={styles.name} numberOfLines={1}>
                            {t.title}
                          </Text>
                          <Text style={styles.sub}>
                            {t.category} · {t.when}
                          </Text>
                        </View>
                        <View style={{ alignItems: 'flex-end', gap: 4 }}>
                          <Text style={styles.name}>{t.amount}</Text>
                          <StatusBadge status={t.status} />
                        </View>
                      </View>
                    ))
                  )}
                </Section>
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function DocLink({ label, url }: { label: string; url: string }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <Pressable onPress={() => void Linking.openURL(url)}>
      <Text style={styles.docLink}>{label}</Text>
    </Pressable>
  );
}

function ActionBtn({
  label,
  onPress,
  disabled,
  primary,
  danger,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  primary?: boolean;
  danger?: boolean;
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.actionBtn,
        primary && styles.actionPrimary,
        danger && styles.actionDanger,
        disabled && styles.actionDisabled,
        pressed && !disabled && { opacity: 0.9 },
      ]}>
      <Text
        style={[
          styles.actionBtnText,
          primary && styles.actionPrimaryText,
          danger && styles.actionDangerText,
        ]}>
        {label}
      </Text>
    </Pressable>
  );
}

function SmallBtn({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.smallBtn, disabled && styles.actionDisabled]}>
      <Text style={styles.smallBtnText}>{label}</Text>
    </Pressable>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.foreground,
    paddingVertical: 12,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
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
  userRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  name: { fontSize: 14, fontWeight: '700', color: colors.foreground },
  sub: { marginTop: 2, fontSize: 12, color: colors.mutedForeground },
  meta: { marginTop: 4, fontSize: 12, color: colors.mutedForeground },
  balance: { marginTop: 6, fontSize: 14, fontWeight: '800', color: Brand.orange },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8, alignItems: 'center' },
  manageBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: colors.orangeMuted,
  },
  manageText: { fontSize: 13, fontWeight: '700', color: Brand.orange },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(28,28,30,0.4)' },
  sheet: {
    maxHeight: '92%',
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
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
  sheetHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8 },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: colors.foreground },
  sheetSub: { marginTop: 2, fontSize: 12, color: colors.mutedForeground },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetScroll: { flexGrow: 0 },
  detailName: { fontSize: 18, fontWeight: '800', color: colors.foreground },
  section: { marginTop: 20, gap: 10 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  walletRow: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 10,
  },
  walletActions: { flexDirection: 'row', gap: 8 },
  primaryTag: { fontSize: 10, fontWeight: '700', color: Brand.orange },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actionBtn: {
    width: '48%',
    flexGrow: 1,
    minWidth: '46%',
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  actionPrimary: {
    backgroundColor: Brand.orange,
    borderColor: Brand.orange,
  },
  actionDanger: {
    backgroundColor: 'rgba(255,59,48,0.08)',
    borderColor: 'rgba(255,59,48,0.35)',
  },
  actionDisabled: { opacity: 0.45 },
  actionBtnText: { fontSize: 12, fontWeight: '700', color: colors.foreground, textAlign: 'center' },
  actionPrimaryText: { color: Brand.white },
  actionDangerText: { color: Brand.error },
  smallBtn: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 8,
    alignItems: 'center',
  },
  smallBtnText: { fontSize: 11, fontWeight: '700', color: colors.foreground },
  kycBox: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
  },
  docLinks: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 8 },
  docLink: { fontSize: 13, fontWeight: '700', color: Brand.orange },
  noteLabel: {
    marginTop: 20,
    fontSize: 12,
    fontWeight: '700',
    color: colors.mutedForeground,
  },
  noteInput: {
    marginTop: 8,
    minHeight: 84,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.muted,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.foreground,
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
});
}

