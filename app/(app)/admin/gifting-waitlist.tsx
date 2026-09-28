import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  Share,
  StyleSheet,
  Switch,
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
import { alert } from '@/lib/alert';
import { adminApi } from '@/lib/admin/api';
import { endpoints } from '@/lib/endpoints';
import { toast } from '@/lib/toast';

type Entry = {
  id: string;
  email: string;
  name: string;
  userId: string | null;
  countryCode: string | null;
  notifiedAt: string | null;
  joinedAt: string;
};

export default function AdminGiftingWaitlistScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const { data, loading, error, reload } = useAdminQuery<{
    count: number;
    notifiedCount: number;
    pendingNotifyCount: number;
    entries: Entry[];
  }>(endpoints.admin.waitlistInternationalGifting);

  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [notifyTitle, setNotifyTitle] = useState('');
  const [notifyBody, setNotifyBody] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = data?.entries ?? [];
    if (!q) return list;
    return list.filter(
      (e) =>
        e.email.toLowerCase().includes(q) ||
        e.name.toLowerCase().includes(q) ||
        (e.countryCode || '').toLowerCase().includes(q),
    );
  }, [data?.entries, query]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === filtered.length) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(filtered.map((e) => e.id)));
  }

  function onDelete(ids: string[]) {
    if (!ids.length) return;
    alert.confirm(
      'Remove waitlist entries?',
      `Remove ${ids.length} entr${ids.length === 1 ? 'y' : 'ies'}?`,
      {
        destructive: true,
        confirmLabel: 'Remove',
        onConfirm: () => {
          void (async () => {
            setBusy(true);
            try {
              const json = await adminApi.delete<{ removed?: number }>(
                endpoints.admin.waitlistInternationalGifting,
                { ids },
              );
              toast.success(`Removed ${json.removed ?? ids.length}`);
              setSelected(new Set());
              await reload();
            } catch (err) {
              toast.error(err instanceof Error ? err.message : 'Delete failed');
            } finally {
              setBusy(false);
            }
          })();
        },
      },
    );
  }

  async function onNotify(ids?: string[]) {
    setBusy(true);
    try {
      const json = await adminApi.patch<{
        notified?: number;
        skipped?: number;
      }>(endpoints.admin.waitlistInternationalGifting, {
        action: 'notify',
        ids: ids?.length ? ids : undefined,
        title: notifyTitle.trim() || undefined,
        body: notifyBody.trim() || undefined,
        onlyUnnotified: !ids?.length,
      });
      toast.success(
        `Notified ${json.notified ?? 0}${json.skipped ? ` (${json.skipped} skipped)` : ''}`,
      );
      setSelected(new Set());
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Notify failed');
    } finally {
      setBusy(false);
    }
  }

  async function exportCsv() {
    const rows = filtered;
    const header = ['name', 'email', 'country', 'joinedAt', 'notifiedAt'];
    const lines = [
      header.join(','),
      ...rows.map((r) =>
        [
          JSON.stringify(r.name),
          JSON.stringify(r.email),
          JSON.stringify(r.countryCode || ''),
          JSON.stringify(r.joinedAt),
          JSON.stringify(r.notifiedAt || ''),
        ].join(','),
      ),
    ];
    await Share.share({
      message: lines.join('\n'),
      title: 'International gifting waitlist',
    });
  }

  return (
    <Screen
      scroll
      refreshing={loading}
      onRefresh={reload}
      header={
        <AdminPageHeader
          title="International Gifting waitlist"
          subtitle="Users waiting for cross-border digital gifting"
        />
      }>
      {loading && !data ? <AdminLoading variant="stats" /> : null}
      {error ? <AdminError message={error} onRetry={reload} /> : null}
      {data ? (
        <>
          <View style={styles.stats}>
            <StatCard label="Joined" value={String(data.count ?? 0)} />
            <StatCard label="Notified" value={String(data.notifiedCount ?? 0)} />
            <StatCard label="Pending notify" value={String(data.pendingNotifyCount ?? 0)} />
          </View>

          <AdminCard title="Launch notification">
            <TextInput
              value={notifyTitle}
              onChangeText={setNotifyTitle}
              placeholder="Optional custom title"
              placeholderTextColor={colors.mutedForeground}
              style={styles.input}
            />
            <TextInput
              value={notifyBody}
              onChangeText={setNotifyBody}
              placeholder="Optional custom message"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.input, { marginTop: 8 }]}
            />
            <View style={styles.actionRow}>
              <Pressable
                disabled={busy || !(data.pendingNotifyCount ?? 0)}
                onPress={() => void onNotify()}
                style={[styles.primaryBtn, busy && styles.disabled]}>
                {busy ? (
                  <ActivityIndicator color={Brand.white} size="small" />
                ) : (
                  <Ionicons name="notifications-outline" size={16} color={Brand.white} />
                )}
                <Text style={styles.primaryText}>Notify unnotified</Text>
              </Pressable>
              <Pressable
                disabled={busy || selected.size === 0}
                onPress={() => void onNotify([...selected])}
                style={[styles.secondaryBtn, (busy || selected.size === 0) && styles.disabled]}>
                <Text style={styles.secondaryText}>Notify selected ({selected.size})</Text>
              </Pressable>
            </View>
            <View style={styles.actionRow}>
              <Pressable
                disabled={busy || selected.size === 0}
                onPress={() => void onDelete([...selected])}
                style={[styles.dangerBtn, (busy || selected.size === 0) && styles.disabled]}>
                <Ionicons name="trash-outline" size={16} color={Brand.error} />
                <Text style={styles.dangerText}>Remove selected</Text>
              </Pressable>
              <Pressable
                disabled={!filtered.length}
                onPress={() => void exportCsv()}
                style={[styles.secondaryBtn, !filtered.length && styles.disabled]}>
                <Text style={styles.secondaryText}>Export CSV</Text>
              </Pressable>
            </View>
          </AdminCard>

          <View style={styles.searchWrap}>
            <Ionicons
              name="search-outline"
              size={18}
              color={colors.mutedForeground}
              style={styles.searchIcon}
            />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search name, email, country…"
              placeholderTextColor={colors.mutedForeground}
              style={styles.searchInput}
            />
          </View>

          <AdminCard
            title={`Entries (${filtered.length})`}
            action={
              filtered.length ? (
                <Pressable onPress={toggleAll} hitSlop={8}>
                  <Text style={styles.selectAll}>
                    {selected.size === filtered.length ? 'Clear all' : 'Select all'}
                  </Text>
                </Pressable>
              ) : undefined
            }>
            {filtered.length === 0 ? (
              <AdminEmpty message="No waitlist signups yet." />
            ) : (
              filtered.map((row) => (
                <View key={row.id} style={styles.row}>
                  <Switch
                    value={selected.has(row.id)}
                    onValueChange={() => toggle(row.id)}
                  />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.title}>{row.name}</Text>
                    <Text style={styles.sub}>{row.email}</Text>
                    <Text style={styles.meta}>
                      {row.countryCode || '—'} ·{' '}
                      {new Date(row.joinedAt).toLocaleString()}
                    </Text>
                  </View>
                  <View style={styles.rowActions}>
                    <StatusBadge status={row.notifiedAt ? 'Sent' : 'Pending'} />
                    <Pressable
                      disabled={busy}
                      onPress={() => void onNotify([row.id])}
                      style={styles.miniBtn}>
                      <Text style={styles.miniBtnText}>Notify</Text>
                    </Pressable>
                    <Pressable
                      disabled={busy}
                      onPress={() => void onDelete([row.id])}
                      style={styles.miniBtn}>
                      <Text style={[styles.miniBtnText, { color: Brand.error }]}>Remove</Text>
                    </Pressable>
                  </View>
                </View>
              ))
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
    input: {
      height: 44,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      paddingHorizontal: 12,
      fontSize: 14,
      color: colors.foreground,
    },
    actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
    primaryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: Brand.orange,
      borderRadius: 999,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    primaryText: { color: Brand.white, fontWeight: '700', fontSize: 13 },
    secondaryBtn: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 14,
      paddingVertical: 10,
      backgroundColor: colors.card,
    },
    secondaryText: { fontWeight: '700', fontSize: 13, color: colors.foreground },
    dangerBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderRadius: 999,
      paddingHorizontal: 14,
      paddingVertical: 10,
      backgroundColor: 'rgba(255,59,48,0.1)',
    },
    dangerText: { fontWeight: '700', fontSize: 13, color: Brand.error },
    disabled: { opacity: 0.45 },
    searchWrap: { position: 'relative', marginBottom: 4 },
    searchIcon: { position: 'absolute', left: 12, top: 13, zIndex: 1 },
    searchInput: {
      height: 44,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      paddingLeft: 40,
      paddingRight: 12,
      fontSize: 14,
      color: colors.foreground,
    },
    selectAll: { fontSize: 12, fontWeight: '700', color: Brand.orange },
    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      paddingVertical: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    title: { fontSize: 14, fontWeight: '700', color: colors.foreground },
    sub: { marginTop: 2, fontSize: 12, color: colors.mutedForeground },
    meta: { marginTop: 4, fontSize: 11, fontWeight: '600', color: colors.mutedForeground },
    rowActions: { alignItems: 'flex-end', gap: 6 },
    miniBtn: { paddingHorizontal: 6, paddingVertical: 4 },
    miniBtnText: { fontSize: 11, fontWeight: '700', color: colors.foreground },
  });
}
