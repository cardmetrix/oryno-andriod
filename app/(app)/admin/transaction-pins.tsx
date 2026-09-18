import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AdminCard } from '@/components/admin/admin-card';
import { AdminEmpty, AdminError, AdminLoading } from '@/components/admin/admin-state';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { StatCard } from '@/components/admin/stat-card';
import { StatusBadge } from '@/components/admin/status-badge';
import { SelectSheet } from '@/components/app/picker-sheet';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { Brand, type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';
import { useAdminQuery } from '@/hooks/use-admin-query';
import { adminApi, ApiError } from '@/lib/admin/api';
import { endpoints } from '@/lib/endpoints';
import { toast } from '@/lib/toast';

type PinUser = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  username: string | null;
  countryCode: string | null;
  status: string;
  statusLabel: string;
  hasPin: boolean;
  pin: string | null;
  pinLabel: string;
  failedPinAttempts: number;
  lockedUntil: string | null;
  isLocked: boolean;
  pinUpdatedAt: string | null;
};

type ManageState = {
  user: PinUser;
  action: 'set' | 'clear' | 'unlock';
};

export default function AdminTransactionPinsScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState('');
  const [pinFilter, setPinFilter] = useState('');
  const [revealIds, setRevealIds] = useState<Record<string, boolean>>({});
  const [manage, setManage] = useState<ManageState | null>(null);
  const [newPin, setNewPin] = useState('');
  const [notifyUser, setNotifyUser] = useState(true);
  const [saving, setSaving] = useState(false);

  const url = useMemo(() => {
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    if (pinFilter) params.set('pin', pinFilter);
    const qs = params.toString();
    return `${endpoints.admin.transactionPins}${qs ? `?${qs}` : ''}`;
  }, [q, pinFilter]);

  const { data, loading, error, reload } = useAdminQuery<{
    users: PinUser[];
    stats: {
      total: number;
      withPin: number;
      withoutPin: number;
      locked: number;
    };
  }>(url);

  async function runAction() {
    if (!manage) return;
    setSaving(true);
    try {
      await adminApi.patch(endpoints.admin.transactionPins, {
        userId: manage.user.id,
        action: manage.action,
        pin: manage.action === 'set' ? newPin : undefined,
        notify: manage.action === 'set' ? notifyUser : undefined,
      });
      toast.success(
        manage.action === 'set'
          ? 'PIN updated'
          : manage.action === 'clear'
            ? 'PIN cleared'
            : 'PIN unlocked',
      );
      setManage(null);
      setNewPin('');
      await reload();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Action failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen
      scroll
      refreshing={loading}
      onRefresh={reload}
      header={
        <AdminPageHeader
          title="Transaction PINs"
          subtitle="View, set, unlock, or clear user transaction PINs"
        />
      }>
      <View style={styles.filters}>
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
        <SelectSheet
          label="PIN state"
          title="Filter PIN state"
          value={pinFilter || 'all'}
          onChange={(v) => setPinFilter(v === 'all' ? '' : v)}
          fullScreen={false}
          options={[
            { id: 'all', title: 'All PIN states' },
            { id: 'set', title: 'PIN set' },
            { id: 'missing', title: 'No PIN' },
            { id: 'locked', title: 'Locked' },
          ]}
        />
      </View>

      {loading && !data ? <AdminLoading variant="stats" /> : null}
      {error ? <AdminError message={error} onRetry={reload} /> : null}

      {data ? (
        <>
          <View style={styles.stats}>
            <StatCard label="Users shown" value={String(data.stats.total)} />
            <StatCard label="PIN set" value={String(data.stats.withPin)} />
            <StatCard label="No PIN" value={String(data.stats.withoutPin)} />
            <StatCard label="Locked" value={String(data.stats.locked)} />
          </View>

          <AdminCard title="Users">
            {data.users.length === 0 ? (
              <AdminEmpty message="No users match this filter." />
            ) : (
              data.users.map((row) => {
                const revealed = Boolean(revealIds[row.id]);
                return (
                  <View key={row.id} style={styles.row}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.title}>{row.name}</Text>
                      <Text style={styles.sub}>{row.email}</Text>
                      <View style={styles.pinRow}>
                        {!row.hasPin ? (
                          <Text style={styles.noPin}>Not set</Text>
                        ) : (
                          <>
                            <Text style={styles.pinCode}>
                              {revealed ? row.pin || '••••' : '••••••'}
                            </Text>
                            <Pressable
                              onPress={() =>
                                setRevealIds((prev) => ({
                                  ...prev,
                                  [row.id]: !prev[row.id],
                                }))
                              }
                              hitSlop={8}>
                              <Ionicons
                                name={revealed ? 'eye-off-outline' : 'eye-outline'}
                                size={16}
                                color={colors.mutedForeground}
                              />
                            </Pressable>
                          </>
                        )}
                        {row.isLocked ? (
                          <Text style={styles.locked}>Locked</Text>
                        ) : null}
                        <Text style={styles.attempts}>
                          {row.failedPinAttempts} attempts
                        </Text>
                      </View>
                      <View style={styles.actions}>
                        <Pressable
                          style={styles.actionBtn}
                          onPress={() => {
                            setNewPin('');
                            setNotifyUser(true);
                            setManage({ user: row, action: 'set' });
                          }}>
                          <Text style={styles.actionText}>Set</Text>
                        </Pressable>
                        {row.hasPin ? (
                          <Pressable
                            style={styles.actionBtn}
                            onPress={() => setManage({ user: row, action: 'clear' })}>
                            <Text style={styles.actionText}>Clear</Text>
                          </Pressable>
                        ) : null}
                        {row.isLocked ? (
                          <Pressable
                            style={styles.actionBtn}
                            onPress={() =>
                              setManage({ user: row, action: 'unlock' })
                            }>
                            <Text style={styles.actionText}>Unlock</Text>
                          </Pressable>
                        ) : null}
                      </View>
                    </View>
                    <StatusBadge status={row.status} />
                  </View>
                );
              })
            )}
          </AdminCard>
        </>
      ) : null}

      <Modal
        visible={Boolean(manage)}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          if (!saving) setManage(null);
        }}>
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.background,
              paddingTop: Math.max(insets.top, 12),
              paddingBottom: Math.max(insets.bottom, 16),
            },
          ]}>
          <View style={styles.sheetHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sheetTitle}>
                {manage?.action === 'set'
                  ? 'Set transaction PIN'
                  : manage?.action === 'clear'
                    ? 'Clear transaction PIN'
                    : 'Unlock PIN'}
              </Text>
              <Text style={styles.sheetSub}>
                {manage?.user.name} · {manage?.user.email}
              </Text>
            </View>
            <Pressable onPress={() => !saving && setManage(null)} hitSlop={8}>
              <Text style={styles.close}>Close</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
            {manage?.action === 'set' ? (
              <>
                <Text style={styles.fieldLabel}>New 4–6 digit PIN</Text>
                <TextInput
                  value={newPin}
                  onChangeText={setNewPin}
                  keyboardType="number-pad"
                  maxLength={6}
                  placeholder="••••"
                  placeholderTextColor={colors.mutedForeground}
                  style={styles.input}
                  secureTextEntry
                />
                <View style={styles.notifyRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.title}>Notify user</Text>
                    <Text style={styles.sub}>Email them about the PIN change</Text>
                  </View>
                  <Switch
                    value={notifyUser}
                    onValueChange={setNotifyUser}
                    trackColor={{ true: Brand.orange }}
                  />
                </View>
              </>
            ) : (
              <Text style={styles.sub}>
                {manage?.action === 'clear'
                  ? 'This removes the user’s transaction PIN. They will need to set a new one.'
                  : 'Clears failed attempts and unlocks PIN entry.'}
              </Text>
            )}
            <Button
              title={
                saving
                  ? 'Working…'
                  : manage?.action === 'set'
                    ? 'Save PIN'
                    : manage?.action === 'clear'
                      ? 'Clear PIN'
                      : 'Unlock'
              }
              loading={saving}
              disabled={
                saving || (manage?.action === 'set' && !/^\d{4,6}$/.test(newPin))
              }
              onPress={() => void runAction()}
            />
          </ScrollView>
        </View>
      </Modal>
    </Screen>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    filters: { gap: 10, marginBottom: 8 },
    searchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      height: 44,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      paddingHorizontal: 12,
    },
    searchInput: {
      flex: 1,
      fontSize: 14,
      fontWeight: '600',
      color: colors.foreground,
      paddingVertical: 0,
    },
    stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 4 },
    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      paddingVertical: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    title: { fontSize: 14, fontWeight: '700', color: colors.foreground },
    sub: { marginTop: 2, fontSize: 12, color: colors.mutedForeground },
    pinRow: {
      marginTop: 8,
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 8,
    },
    pinCode: {
      fontFamily: 'Courier',
      fontSize: 14,
      fontWeight: '700',
      letterSpacing: 3,
      color: colors.foreground,
      backgroundColor: colors.muted,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
      overflow: 'hidden',
    },
    noPin: { fontSize: 12, fontWeight: '600', color: colors.mutedForeground },
    locked: { fontSize: 11, fontWeight: '800', color: Brand.error },
    attempts: { fontSize: 11, fontWeight: '600', color: colors.mutedForeground },
    actions: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    actionBtn: {
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 10,
      paddingVertical: 6,
      backgroundColor: colors.card,
    },
    actionText: { fontSize: 12, fontWeight: '700', color: colors.foreground },
    sheet: { flex: 1 },
    sheetHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      paddingHorizontal: 16,
      paddingBottom: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    sheetTitle: { fontSize: 18, fontWeight: '800', color: colors.foreground },
    sheetSub: { marginTop: 4, fontSize: 13, color: colors.mutedForeground },
    close: { fontSize: 14, fontWeight: '700', color: Brand.orange },
    fieldLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.mutedForeground,
    },
    input: {
      height: 48,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      paddingHorizontal: 14,
      fontSize: 18,
      fontWeight: '700',
      letterSpacing: 4,
      color: colors.foreground,
    },
    notifyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
  });
}
