import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AdminCard } from '@/components/admin/admin-card';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { AdminEmpty, AdminError, AdminLoading } from '@/components/admin/admin-state';
import { StatusBadge } from '@/components/admin/status-badge';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { Brand, Radius, type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';
import { useAdminQuery } from '@/hooks/use-admin-query';
import { adminApi, ApiError } from '@/lib/admin/api';
import { endpoints } from '@/lib/endpoints';
import { toast } from '@/lib/toast';

type AudienceMode = 'all' | 'selected' | 'individual';

type AdminEmailTemplate = {
  id: string;
  label: string;
  description: string;
  subject: string;
  title: string;
  body: string;
  ctaLabel: string;
  ctaHref: string;
  notificationType: string;
};

type CampaignRow = {
  id: string;
  title: string;
  body: string;
  audience: string;
  status: string;
  statusLabel: string;
  subject: string;
  templateId: string;
  mode: AudienceMode;
  userIds: string[];
  selectedUsers: Array<{ id: string; email: string; fullName: string }>;
  individualEmail: string;
  ctaLabel: string;
  ctaHref: string;
  notificationType: string;
  sendInApp: boolean;
  sendEmail: boolean;
  stats: {
    recipients: number;
    emailed: number;
    notified: number;
    failed: number;
  } | null;
  when: string;
};

type UserPick = {
  id: string;
  name: string;
  email: string;
  status: string;
  country: string;
};

type Response = {
  templates: AdminEmailTemplate[];
  activeUserCount: number;
  campaigns: CampaignRow[];
  recent: Array<{ id: string; title: string; type: string; when: string }>;
};

export default function AdminNotificationsScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const { data, loading, error, reload } = useAdminQuery<Response>(
    endpoints.admin.notifications,
  );

  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [templateId, setTemplateId] = useState('custom');
  const [mode, setMode] = useState<AudienceMode>('all');
  const [subject, setSubject] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [ctaLabel, setCtaLabel] = useState('Open ORYNO');
  const [ctaHref, setCtaHref] = useState('/dashboard');
  const [individualEmail, setIndividualEmail] = useState('');
  const [selected, setSelected] = useState<UserPick[]>([]);
  const [sendInApp, setSendInApp] = useState(true);
  const [sendEmail, setSendEmail] = useState(true);
  const [busy, setBusy] = useState<'draft' | 'send' | null>(null);

  const [userQuery, setUserQuery] = useState('');
  const [userResults, setUserResults] = useState<UserPick[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);

  const templates = data?.templates || [];
  const activeTemplate = useMemo(
    () => templates.find((t) => t.id === templateId) || templates[0],
    [templates, templateId],
  );

  function pickTemplate(t: AdminEmailTemplate) {
    setTemplateId(t.id);
    if (t.id === 'custom') return;
    setSubject(t.subject);
    setTitle(t.title);
    setBody(t.body);
    setCtaLabel(t.ctaLabel);
    setCtaHref(t.ctaHref);
  }

  useEffect(() => {
    if (mode !== 'selected' && mode !== 'individual') return;
    let cancelled = false;
    const timer = setTimeout(() => {
      void (async () => {
        setUsersLoading(true);
        try {
          const json = await adminApi.get<{ users: UserPick[] }>(
            `${endpoints.admin.notificationUsers}?q=${encodeURIComponent(userQuery)}`,
          );
          if (!cancelled) setUserResults(json.users || []);
        } catch (e) {
          if (!cancelled) {
            toast.error(e instanceof ApiError ? e.message : 'Failed to load users');
          }
        } finally {
          if (!cancelled) setUsersLoading(false);
        }
      })();
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [userQuery, mode]);

  function applyCampaign(c: CampaignRow) {
    setCampaignId(c.id);
    setTemplateId(c.templateId || 'custom');
    setMode(c.mode || 'all');
    setSubject(c.subject || c.title);
    setTitle(c.title);
    setBody(c.body);
    setCtaLabel(c.ctaLabel || 'Open ORYNO');
    setCtaHref(c.ctaHref || '/dashboard');
    setIndividualEmail(c.individualEmail || '');
    setSendInApp(c.sendInApp !== false);
    setSendEmail(c.sendEmail !== false);
    setSelected(
      (c.selectedUsers || []).map((u) => ({
        id: u.id,
        name: u.fullName,
        email: u.email,
        status: 'active',
        country: '—',
      })),
    );
    toast.message('Draft loaded into composer');
  }

  function resetComposer() {
    setCampaignId(null);
    setTemplateId('custom');
    setMode('all');
    setSubject('');
    setTitle('');
    setBody('');
    setCtaLabel('Open ORYNO');
    setCtaHref('/dashboard');
    setIndividualEmail('');
    setSelected([]);
    setSendInApp(true);
    setSendEmail(true);
  }

  function toggleUser(user: UserPick) {
    setSelected((prev) => {
      if (prev.some((p) => p.id === user.id)) {
        return prev.filter((p) => p.id !== user.id);
      }
      return [...prev, user];
    });
  }

  async function submit(action: 'draft' | 'send') {
    if (!title.trim() || !body.trim()) {
      toast.error('Title and message are required');
      return;
    }
    if (mode === 'individual' && !individualEmail.trim()) {
      toast.error('Enter the user’s email');
      return;
    }
    if (mode === 'selected' && selected.length === 0) {
      toast.error('Select at least one user');
      return;
    }
    if (!sendInApp && !sendEmail) {
      toast.error('Enable email and/or in-app delivery');
      return;
    }

    setBusy(action);
    try {
      const json = await adminApi.post<{
        campaign?: { id: string };
        stats?: {
          recipients: number;
          emailed: number;
          notified: number;
          failed: number;
        };
      }>(endpoints.admin.notifications, {
        action,
        campaignId,
        templateId,
        mode,
        subject: subject || title,
        title,
        body,
        ctaLabel,
        ctaHref,
        notificationType: activeTemplate?.notificationType || 'promo',
        individualEmail,
        userIds: selected.map((u) => u.id),
        sendInApp,
        sendEmail,
      });

      if (action === 'draft') {
        setCampaignId(json.campaign?.id || null);
        toast.success('Draft saved');
      } else {
        const s = json.stats;
        toast.success(
          `Sent to ${s?.recipients ?? 0} · emailed ${s?.emailed ?? 0} · in-app ${s?.notified ?? 0}`,
        );
        resetComposer();
      }
      await reload();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Failed');
    } finally {
      setBusy(null);
    }
  }

  const recipientHint =
    mode === 'all'
      ? `${data?.activeUserCount ?? '…'} active users`
      : mode === 'selected'
        ? `${selected.length} selected`
        : individualEmail.trim() || 'one email';

  return (
    <Screen scroll refreshing={loading} onRefresh={reload}>
      <AdminPageHeader
        title="Notifications & Email"
        subtitle="Draft or send branded emails and in-app alerts to one user, selected users, or everyone"
        actions={
          <Pressable
            onPress={resetComposer}
            style={({ pressed }) => [styles.newBtn, pressed && { opacity: 0.9 }]}>
            <Text style={styles.newBtnText}>New message</Text>
          </Pressable>
        }
      />

      {loading && !data ? <AdminLoading variant="overview" /> : null}
      {error ? <AdminError message={error} onRetry={reload} /> : null}

      {data ? (
        <>
          <AdminCard title="Compose">
            <Text style={styles.sectionLabel}>Template</Text>
            <View style={styles.templateGrid}>
              {templates.map((t) => {
                const on = templateId === t.id;
                return (
                  <Pressable
                    key={t.id}
                    onPress={() => pickTemplate(t)}
                    style={[styles.templateCard, on && styles.templateCardOn]}>
                    <Text style={styles.templateTitle}>{t.label}</Text>
                    <Text style={styles.templateDesc} numberOfLines={2}>
                      {t.description}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={[styles.sectionLabel, { marginTop: 18 }]}>Audience</Text>
            <View style={styles.modeRow}>
              {(
                [
                  ['all', 'Broadcast all'],
                  ['selected', 'Selected'],
                  ['individual', 'One user'],
                ] as const
              ).map(([value, label]) => {
                const on = mode === value;
                return (
                  <Pressable
                    key={value}
                    onPress={() => setMode(value)}
                    style={[styles.modeBtn, on && styles.modeBtnOn]}>
                    <Text style={[styles.modeText, on && styles.modeTextOn]}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.recipientHint}>
              <Ionicons name="people-outline" size={14} color={colors.mutedForeground} />
              <Text style={styles.hintText}>Recipients: {recipientHint}</Text>
            </View>

            {mode === 'individual' ? (
              <Field label="User email">
                <TextInput
                  value={individualEmail}
                  onChangeText={setIndividualEmail}
                  placeholder="user@email.com"
                  placeholderTextColor={colors.mutedForeground}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  style={styles.input}
                />
              </Field>
            ) : null}

            {mode === 'selected' ? (
              <View style={styles.pickerBox}>
                <View style={styles.searchWrap}>
                  <Ionicons name="search" size={16} color={colors.mutedForeground} />
                  <TextInput
                    value={userQuery}
                    onChangeText={setUserQuery}
                    placeholder="Search users by name or email…"
                    placeholderTextColor={colors.mutedForeground}
                    style={styles.searchInput}
                    autoCapitalize="none"
                  />
                </View>
                {selected.length > 0 ? (
                  <View style={styles.selectedWrap}>
                    {selected.map((u) => (
                      <Pressable
                        key={u.id}
                        onPress={() => toggleUser(u)}
                        style={styles.selectedChip}>
                        <Text style={styles.selectedChipText}>{u.name} ×</Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
                <View style={styles.userList}>
                  {usersLoading ? (
                    <ActivityIndicator color={Brand.orange} style={{ marginVertical: 12 }} />
                  ) : userResults.length === 0 ? (
                    <Text style={styles.hintText}>No users found</Text>
                  ) : (
                    userResults.map((u) => {
                      const on = selected.some((s) => s.id === u.id);
                      return (
                        <Pressable
                          key={u.id}
                          onPress={() => toggleUser(u)}
                          style={[styles.userRow, on && styles.userRowOn]}>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={styles.userName} numberOfLines={1}>
                              {u.name}
                            </Text>
                            <Text style={styles.userEmail} numberOfLines={1}>
                              {u.email}
                            </Text>
                          </View>
                          <Text style={styles.addLabel}>{on ? 'Selected' : 'Add'}</Text>
                        </Pressable>
                      );
                    })
                  )}
                </View>
              </View>
            ) : null}

            <Field label="Email subject">
              <TextInput
                value={subject}
                onChangeText={setSubject}
                placeholder="Subject line"
                placeholderTextColor={colors.mutedForeground}
                style={styles.input}
              />
            </Field>
            <Field label="Title (in-app + email heading)">
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="Message title"
                placeholderTextColor={colors.mutedForeground}
                style={styles.input}
              />
            </Field>
            <Field label="Message body">
              <TextInput
                value={body}
                onChangeText={setBody}
                placeholder="Use {{name}} to personalize the greeting"
                placeholderTextColor={colors.mutedForeground}
                style={[styles.input, styles.textarea]}
                multiline
                textAlignVertical="top"
              />
              <Text style={styles.tip}>Tip: {'{{name}}'} inserts the user’s first name.</Text>
            </Field>
            <View style={styles.ctaRow}>
              <View style={{ flex: 1 }}>
                <Field label="CTA label">
                  <TextInput
                    value={ctaLabel}
                    onChangeText={setCtaLabel}
                    style={styles.input}
                  />
                </Field>
              </View>
              <View style={{ flex: 1 }}>
                <Field label="CTA link">
                  <TextInput
                    value={ctaHref}
                    onChangeText={setCtaHref}
                    placeholder="/dashboard"
                    placeholderTextColor={colors.mutedForeground}
                    autoCapitalize="none"
                    style={styles.input}
                  />
                </Field>
              </View>
            </View>

            <View style={styles.toggles}>
              <View style={styles.toggleRow}>
                <Text style={styles.toggleLabel}>Send email</Text>
                <Switch
                  value={sendEmail}
                  onValueChange={setSendEmail}
                  trackColor={{ false: colors.border, true: Brand.orangeSoft }}
                  thumbColor={Brand.white}
                />
              </View>
              <View style={styles.toggleRow}>
                <Text style={styles.toggleLabel}>In-app notification</Text>
                <Switch
                  value={sendInApp}
                  onValueChange={setSendInApp}
                  trackColor={{ false: colors.border, true: Brand.orangeSoft }}
                  thumbColor={Brand.white}
                />
              </View>
            </View>

            <View style={styles.actions}>
              <Button
                title={busy === 'draft' ? 'Saving…' : 'Save draft'}
                variant="secondary"
                loading={busy === 'draft'}
                disabled={busy !== null}
                onPress={() => void submit('draft')}
                style={{ flex: 1 }}
              />
              <Button
                title={busy === 'send' ? 'Sending…' : 'Send now'}
                loading={busy === 'send'}
                disabled={busy !== null}
                onPress={() => void submit('send')}
                style={{ flex: 1 }}
              />
            </View>

            {campaignId ? (
              <Text style={styles.editing}>
                Editing campaign {campaignId.slice(0, 8)}
              </Text>
            ) : null}
          </AdminCard>

          <AdminCard title="Campaigns">
            {data.campaigns.length === 0 ? (
              <AdminEmpty message="No campaigns yet. Draft or send your first message." />
            ) : (
              data.campaigns.map((c) => (
                <Pressable
                  key={c.id}
                  onPress={() => applyCampaign(c)}
                  style={({ pressed }) => [styles.campaignRow, pressed && { opacity: 0.92 }]}>
                  <View style={styles.campaignTop}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.userName} numberOfLines={1}>
                        {c.title}
                      </Text>
                      <Text style={styles.userEmail} numberOfLines={1}>
                        {c.audience} · {c.when}
                      </Text>
                    </View>
                    <StatusBadge status={c.statusLabel} />
                  </View>
                  {c.stats ? (
                    <Text style={styles.statsLine}>
                      {c.stats.recipients} recipients · {c.stats.emailed} emailed ·{' '}
                      {c.stats.notified} in-app
                      {c.stats.failed ? ` · ${c.stats.failed} failed` : ''}
                    </Text>
                  ) : null}
                </Pressable>
              ))
            )}
          </AdminCard>

          <AdminCard title="Recent in-app notifications">
            {data.recent.length === 0 ? (
              <AdminEmpty message="No notifications sent yet." />
            ) : (
              data.recent.map((n) => (
                <View key={n.id} style={styles.recentRow}>
                  <Text style={styles.userName}>{n.title}</Text>
                  <Text style={styles.userEmail}>
                    {n.type} · {n.when}
                  </Text>
                </View>
              ))
            )}
          </AdminCard>

          <View style={styles.brandNote}>
            <View style={styles.megaphone}>
              <Ionicons name="megaphone-outline" size={20} color={Brand.orange} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.userName}>Branded delivery</Text>
              <Text style={styles.brandBody}>
                Emails use the ORYNO header, logo, and footer. In-app alerts appear in the
                user notification center.
              </Text>
            </View>
          </View>
        </>
      ) : null}
    </Screen>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
  newBtn: {
    height: 42,
    paddingHorizontal: 14,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newBtnText: { fontSize: 13, fontWeight: '700', color: colors.foreground },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  templateGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  templateCard: {
    width: '48%',
    flexGrow: 1,
    minWidth: '46%',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    backgroundColor: colors.card,
  },
  templateCardOn: {
    borderColor: Brand.orange,
    backgroundColor: colors.orangeMuted,
  },
  templateTitle: { fontSize: 13, fontWeight: '700', color: colors.foreground },
  templateDesc: { marginTop: 4, fontSize: 11, color: colors.mutedForeground, lineHeight: 15 },
  modeRow: { flexDirection: 'row', gap: 8 },
  modeBtn: {
    flex: 1,
    height: 40,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  modeBtnOn: { backgroundColor: Brand.orange, borderColor: Brand.orange },
  modeText: { fontSize: 11, fontWeight: '700', color: colors.mutedForeground, textAlign: 'center' },
  modeTextOn: { color: Brand.white },
  recipientHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    marginBottom: 4,
  },
  hintText: { fontSize: 12, color: colors.mutedForeground },
  field: { marginTop: 14 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: colors.mutedForeground, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.muted,
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    color: colors.foreground,
  },
  textarea: { minHeight: 120, paddingTop: 12 },
  tip: { marginTop: 6, fontSize: 11, color: colors.mutedForeground },
  ctaRow: { flexDirection: 'row', gap: 10 },
  pickerBox: {
    marginTop: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 10,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 10,
    backgroundColor: colors.card,
  },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 14, color: colors.foreground },
  selectedWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  selectedChip: {
    borderRadius: 999,
    backgroundColor: colors.orangeMuted,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  selectedChipText: { fontSize: 11, fontWeight: '700', color: Brand.orange },
  userList: { maxHeight: 200 },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  userRowOn: { backgroundColor: colors.orangeMuted },
  userName: { fontSize: 13, fontWeight: '700', color: colors.foreground },
  userEmail: { marginTop: 2, fontSize: 11, color: colors.mutedForeground },
  addLabel: { fontSize: 11, fontWeight: '700', color: Brand.orange },
  toggles: {
    marginTop: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  toggleLabel: { fontSize: 14, fontWeight: '700', color: colors.foreground },
  actions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  editing: { marginTop: 10, fontSize: 11, color: colors.mutedForeground },
  campaignRow: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginTop: 10,
  },
  campaignTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  statsLine: { marginTop: 8, fontSize: 11, color: colors.mutedForeground },
  recentRow: {
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  brandNote: {
    marginTop: 14,
    flexDirection: 'row',
    gap: 12,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: 16,
  },
  megaphone: {
    width: 40,
    height: 40,
    borderRadius: 16,
    backgroundColor: colors.orangeMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandBody: { marginTop: 4, fontSize: 12, color: colors.mutedForeground, lineHeight: 17 },
});
}

