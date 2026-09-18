import { useMemo, useState } from 'react';
import {
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
import { AdminEmpty, AdminError, AdminLoading } from '@/components/admin/admin-state';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
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

type TicketRow = {
  id: string;
  reference: string;
  topic: string;
  email: string;
  subject: string;
  message: string;
  status: string;
  statusLabel: string;
  userName?: string | null;
  createdAt: string;
};

const STATUS_OPTIONS = [
  { id: '', title: 'All statuses' },
  { id: 'open', title: 'Open' },
  { id: 'in_progress', title: 'In progress' },
  { id: 'resolved', title: 'Resolved' },
  { id: 'closed', title: 'Closed' },
];

export default function AdminSupportScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const [status, setStatus] = useState('');
  const url = useMemo(
    () =>
      `${endpoints.admin.support}${status ? `?status=${encodeURIComponent(status)}` : ''}`,
    [status],
  );
  const { data, loading, error, reload } = useAdminQuery<{ tickets: TicketRow[] }>(
    url,
  );
  const [active, setActive] = useState<TicketRow | null>(null);
  const [reply, setReply] = useState('');
  const [nextStatus, setNextStatus] = useState('in_progress');
  const [saving, setSaving] = useState(false);

  async function submitReply() {
    if (!active) return;
    setSaving(true);
    try {
      await adminApi.patch(endpoints.admin.support, {
        ticketId: active.id,
        status: nextStatus,
        reply,
      });
      toast.success(`Updated ${active.reference}`);
      setActive(null);
      setReply('');
      await reload();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Update failed');
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
          title="Support tickets"
          subtitle="Reply to users and update ticket status"
        />
      }>
      <SelectSheet
        label="Status filter"
        title="Filter by status"
        value={status || 'all'}
        onChange={(v) => setStatus(v === 'all' ? '' : v)}
        fullScreen={false}
        options={STATUS_OPTIONS.map((o) => ({
          id: o.id || 'all',
          title: o.title,
        }))}
      />

      {loading && !data ? <AdminLoading /> : null}
      {error ? <AdminError message={error} onRetry={reload} /> : null}

      {data ? (
        <AdminCard title="Tickets">
          {data.tickets.length === 0 ? (
            <AdminEmpty message="No support tickets yet." />
          ) : (
            data.tickets.map((row) => (
              <Pressable
                key={row.id}
                onPress={() => {
                  setActive(row);
                  setReply('');
                  setNextStatus(row.status === 'open' ? 'in_progress' : row.status);
                }}
                style={({ pressed }) => [styles.row, pressed && { opacity: 0.9 }]}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.title}>{row.reference}</Text>
                  <Text style={styles.sub} numberOfLines={1}>
                    {row.subject}
                  </Text>
                  <Text style={styles.meta} numberOfLines={1}>
                    {row.userName || row.email} · {row.topic}
                  </Text>
                </View>
                <StatusBadge status={row.status} />
              </Pressable>
            ))
          )}
        </AdminCard>
      ) : null}

      <Modal
        visible={Boolean(active)}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          if (!saving) setActive(null);
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
              <Text style={styles.sheetTitle}>{active?.reference}</Text>
              <Text style={styles.sheetSub}>
                {active?.userName || active?.email} · {active?.topic}
              </Text>
            </View>
            <Pressable onPress={() => !saving && setActive(null)} hitSlop={8}>
              <Text style={styles.close}>Close</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
            <View style={styles.messageBox}>
              <Text style={styles.messageText}>{active?.message}</Text>
            </View>
            <SelectSheet
              label="Status"
              title="Ticket status"
              value={nextStatus}
              onChange={setNextStatus}
              fullScreen={false}
              options={STATUS_OPTIONS.filter((o) => o.id).map((o) => ({
                id: o.id,
                title: o.title,
              }))}
            />
            <Text style={styles.fieldLabel}>
              Reply (emails + notifies the user)
            </Text>
            <TextInput
              value={reply}
              onChangeText={setReply}
              multiline
              placeholder="Write a reply…"
              placeholderTextColor={colors.mutedForeground}
              style={styles.textarea}
            />
            <Button
              title={saving ? 'Saving…' : 'Send update'}
              loading={saving}
              disabled={saving}
              onPress={() => void submitReply()}
            />
          </ScrollView>
        </View>
      </Modal>
    </Screen>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    title: { fontSize: 14, fontWeight: '700', color: colors.foreground },
    sub: { marginTop: 2, fontSize: 12, color: colors.mutedForeground },
    meta: { marginTop: 4, fontSize: 11, fontWeight: '600', color: colors.mutedForeground },
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
    messageBox: {
      borderRadius: 16,
      backgroundColor: colors.muted,
      padding: 12,
    },
    messageText: {
      fontSize: 14,
      lineHeight: 20,
      color: colors.foreground,
    },
    fieldLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.mutedForeground,
    },
    textarea: {
      minHeight: 120,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      padding: 12,
      fontSize: 14,
      color: colors.foreground,
      textAlignVertical: 'top',
    },
  });
}
