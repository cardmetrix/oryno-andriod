import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
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
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { AdminEmpty, AdminError, AdminLoading } from '@/components/admin/admin-state';
import { StatusBadge } from '@/components/admin/status-badge';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { Brand, Radius, type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';
import { useAdminQuery } from '@/hooks/use-admin-query';
import { adminApi, ApiError } from '@/lib/admin/api';
import { alert } from '@/lib/alert';
import { endpoints } from '@/lib/endpoints';
import { toast } from '@/lib/toast';

type AdStatus = 'draft' | 'live' | 'paused' | 'archived';

type Ad = {
  id: string;
  title: string;
  subtitle: string | null;
  imageUrl: string;
  href: string;
  badge: string | null;
  status: AdStatus;
  statusLabel: string;
  sortOrder: number;
  startsAt: string | null;
  endsAt: string | null;
  expired: boolean;
  scheduled: boolean;
  active: boolean;
};

type StatusOption = {
  value: AdStatus;
  label: string;
  description: string;
};

type ServiceLinkOption = {
  id: string;
  label: string;
  href: string;
};

type Response = {
  ads: Ad[];
  statusOptions: StatusOption[];
  serviceLinkOptions?: ServiceLinkOption[];
};

type FormState = {
  title: string;
  subtitle: string;
  linkOptionId: string;
  href: string;
  badge: string;
  status: AdStatus;
  sortOrder: string;
  endsAt: string;
  imageUrl: string;
  image?: { filename: string; mime: string; base64: string; preview: string };
};

const FALLBACK_LINKS: ServiceLinkOption[] = [
  { id: 'custom', label: 'Custom URL (enter manually)', href: '' },
  { id: 'dashboard', label: 'Home / Dashboard', href: '/dashboard' },
  { id: 'wallet', label: 'Wallet', href: '/wallet' },
  { id: 'fund', label: 'Fund wallet', href: '/fund' },
  { id: 'withdraw', label: 'Withdraw', href: '/withdraw' },
  { id: 'services', label: 'All services', href: '/services' },
  { id: 'airtime', label: 'Airtime', href: '/services/airtime' },
  { id: 'data', label: 'Data', href: '/services/data' },
  { id: 'bills', label: 'Bills', href: '/services/bills' },
  { id: 'social', label: 'Social boosting', href: '/services/social' },
  { id: 'virtual-numbers', label: 'Virtual numbers', href: '/services/virtual-numbers' },
  { id: 'emails', label: 'Temp emails', href: '/services/emails' },
  { id: 'gift-cards-live', label: 'Gift Card Live', href: '/services/gift-cards/live' },
  { id: 'gift-cards', label: 'Gift Cards', href: '/services/gift-cards' },
];

const EMPTY_FORM = (): FormState => ({
  title: '',
  subtitle: '',
  linkOptionId: 'gift-cards',
  href: '/services/gift-cards',
  badge: '',
  status: 'live',
  sortOrder: '0',
  endsAt: '',
  imageUrl: '',
});

function isValidAdHref(href: string) {
  const value = href.trim();
  if (!value) return false;
  if (value.startsWith('/') && !value.startsWith('//')) return true;
  return /^https?:\/\//i.test(value);
}

function formFromHref(
  href: string,
  options: ServiceLinkOption[],
): Pick<FormState, 'linkOptionId' | 'href'> {
  const match = options.find((o) => o.id !== 'custom' && o.href === href.trim());
  if (match) return { linkOptionId: match.id, href: match.href };
  return { linkOptionId: 'custom', href };
}

const STATUS_FILTERS: Array<'' | AdStatus> = [
  '',
  'live',
  'paused',
  'draft',
  'archived',
];

export default function AdminAdsScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const insets = useSafeAreaInsets();
  const { data, loading, error, reload } = useAdminQuery<Response>(
    endpoints.admin.ads,
  );
  const [filter, setFilter] = useState<'' | AdStatus>('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Ad | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const serviceLinkOptions = data?.serviceLinkOptions?.length
    ? data.serviceLinkOptions
    : FALLBACK_LINKS;

  const ads = useMemo(() => {
    const rows = data?.ads ?? [];
    if (!filter) return rows;
    return rows.filter((a) => a.status === filter);
  }, [data?.ads, filter]);

  const isCustomLink = form.linkOptionId === 'custom';

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM());
    setOpen(true);
  }

  function openEdit(ad: Ad) {
    setEditing(ad);
    const link = formFromHref(ad.href, serviceLinkOptions);
    setForm({
      title: ad.title,
      subtitle: ad.subtitle || '',
      linkOptionId: link.linkOptionId,
      href: link.href,
      badge: ad.badge || '',
      status: ad.status,
      sortOrder: String(ad.sortOrder),
      endsAt: ad.endsAt ? ad.endsAt.slice(0, 16) : '',
      imageUrl: ad.imageUrl,
      image: undefined,
    });
    setOpen(true);
  }

  function onLinkOptionChange(optionId: string) {
    const option = serviceLinkOptions.find((o) => o.id === optionId);
    if (!option) return;
    setForm((f) => ({
      ...f,
      linkOptionId: option.id,
      href: option.id === 'custom' ? f.href : option.href,
    }));
  }

  async function pickImage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      toast.error('Allow photo library access to upload ad images.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      base64: true,
    });
    if (result.canceled || !result.assets[0]?.base64) return;
    const asset = result.assets[0];
    setForm((f) => ({
      ...f,
      imageUrl: asset.uri,
      image: {
        filename: asset.fileName || `ad-${Date.now()}.jpg`,
        mime: asset.mimeType || 'image/jpeg',
        base64: asset.base64!,
        preview: asset.uri,
      },
    }));
  }

  async function onSave() {
    if (!form.title.trim()) {
      toast.error('Title is required');
      return;
    }
    if (!isValidAdHref(form.href)) {
      toast.error('Enter a service path (/…) or a full https:// URL');
      return;
    }
    if (!form.imageUrl && !form.image) {
      toast.error('Upload an ad image');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        subtitle: form.subtitle.trim() || null,
        href: form.href.trim(),
        badge: form.badge.trim() || null,
        status: form.status,
        sortOrder: Number(form.sortOrder) || 0,
        endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
        imageUrl: form.image ? undefined : form.imageUrl || undefined,
        image: form.image
          ? {
              filename: form.image.filename,
              mime: form.image.mime,
              base64: form.image.base64,
            }
          : undefined,
      };

      if (editing) {
        await adminApi.patch(endpoints.admin.ad(editing.id), payload);
        toast.success('Ad updated');
      } else {
        await adminApi.post(endpoints.admin.ads, payload);
        toast.success('Ad created');
      }
      setOpen(false);
      await reload();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Failed to save ad');
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(ad: Ad, status: AdStatus) {
    setBusyId(ad.id);
    try {
      const json = await adminApi.patch<{ ad?: { statusLabel?: string } }>(
        endpoints.admin.ad(ad.id),
        { status },
      );
      toast.success(`${ad.title} → ${json.ad?.statusLabel || status}`);
      await reload();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Failed to update');
    } finally {
      setBusyId(null);
    }
  }

  function confirmDelete(ad: Ad) {
    alert.confirm('Delete ad?', `“${ad.title}” will be permanently removed.`, {
      confirmLabel: 'Delete',
      destructive: true,
      onConfirm: () => void onDelete(ad),
    });
  }

  async function onDelete(ad: Ad) {
    setBusyId(ad.id);
    try {
      await adminApi.delete(endpoints.admin.ad(ad.id));
      toast.success('Ad deleted');
      await reload();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Failed to delete');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Screen scroll refreshing={loading} onRefresh={reload}>
      <AdminPageHeader
        title="Ads"
        subtitle="Home carousel creatives, schedule & archive"
        actions={
          <Pressable style={styles.addBtn} onPress={openCreate}>
            <Ionicons name="add" size={18} color={Brand.white} />
            <Text style={styles.addText}>Add</Text>
          </Pressable>
        }
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filters}>
        {STATUS_FILTERS.map((key) => {
          const active = filter === key;
          const label = key ? key : 'all';
          return (
            <Pressable
              key={label}
              onPress={() => setFilter(key)}
              style={[styles.chip, active && styles.chipActive]}>
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {loading && !data ? <AdminLoading /> : null}
      {error && !data ? <AdminError message={error} onRetry={reload} /> : null}

      {data ? (
        ads.length === 0 ? (
          <AdminEmpty message="No ads yet. Create your first carousel slide." />
        ) : (
          <View style={styles.list}>
            {ads.map((ad) => (
              <AdminCard key={ad.id}>
                <View style={styles.preview}>
                  <Image
                    source={{ uri: ad.imageUrl }}
                    style={styles.previewImage}
                    contentFit="cover"
                  />
                  <View style={styles.previewTop}>
                    <StatusBadge status={ad.statusLabel} />
                    {ad.expired ? (
                      <Text style={styles.flag}>Expired</Text>
                    ) : ad.active ? (
                      <Text style={[styles.flag, styles.flagLive]}>Showing</Text>
                    ) : null}
                  </View>
                </View>

                <Text style={styles.title}>{ad.title}</Text>
                <Text style={styles.sub} numberOfLines={2}>
                  {ad.subtitle || ad.href}
                </Text>
                <Text style={styles.meta}>
                  Order {ad.sortOrder}
                  {ad.endsAt
                    ? ` · Expires ${new Date(ad.endsAt).toLocaleString()}`
                    : ' · No expiry'}
                </Text>

                <View style={styles.statusRow}>
                  {(['live', 'paused', 'draft', 'archived'] as AdStatus[]).map(
                    (status) => {
                      const active = ad.status === status;
                      return (
                        <Pressable
                          key={status}
                          disabled={busyId === ad.id || active}
                          onPress={() => void setStatus(ad, status)}
                          style={[
                            styles.statusBtn,
                            active && styles.statusBtnOn,
                          ]}>
                          <Text
                            style={[
                              styles.statusBtnText,
                              active && styles.statusBtnTextOn,
                            ]}>
                            {status}
                          </Text>
                        </Pressable>
                      );
                    },
                  )}
                </View>

                <View style={styles.actions}>
                  <Pressable style={styles.actionBtn} onPress={() => openEdit(ad)}>
                    <Ionicons name="create-outline" size={16} color={colors.foreground} />
                    <Text style={styles.actionText}>Edit</Text>
                  </Pressable>
                  <Pressable
                    style={styles.actionBtn}
                    disabled={busyId === ad.id || ad.status === 'archived'}
                    onPress={() => void setStatus(ad, 'archived')}>
                    <Ionicons name="archive-outline" size={16} color={colors.foreground} />
                    <Text style={styles.actionText}>Archive</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.actionBtn, styles.deleteBtn]}
                    disabled={busyId === ad.id}
                    onPress={() => confirmDelete(ad)}>
                    <Ionicons name="trash-outline" size={16} color={Brand.error} />
                    <Text style={[styles.actionText, { color: Brand.error }]}>
                      Delete
                    </Text>
                  </Pressable>
                </View>
              </AdminCard>
            ))}
          </View>
        )
      ) : null}

      <Modal visible={open} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.modal, { paddingTop: Math.max(insets.top, 12) }]}>
          <View style={styles.modalHead}>
            <Text style={styles.modalTitle}>
              {editing ? 'Edit ad' : 'Create ad'}
            </Text>
            <Pressable onPress={() => setOpen(false)} hitSlop={10}>
              <Ionicons name="close" size={22} color={colors.foreground} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.modalBody}>
            <Field
              label="Title"
              value={form.title}
              onChangeText={(title) => setForm((f) => ({ ...f, title }))}
              placeholder="Gift Cards"
            />
            <Field
              label="Subtitle"
              value={form.subtitle}
              onChangeText={(subtitle) => setForm((f) => ({ ...f, subtitle }))}
              placeholder="Sell for live Naira rates"
            />
            <Text style={styles.label}>App / web link</Text>
            <View style={styles.linkOptions}>
              {serviceLinkOptions.map((opt) => {
                const active = form.linkOptionId === opt.id;
                return (
                  <Pressable
                    key={opt.id}
                    onPress={() => onLinkOptionChange(opt.id)}
                    style={[styles.linkChip, active && styles.linkChipOn]}>
                    <Text
                      style={[
                        styles.linkChipText,
                        active && styles.linkChipTextOn,
                      ]}
                      numberOfLines={1}>
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {isCustomLink ? (
              <Field
                label="Custom URL"
                value={form.href}
                onChangeText={(href) => setForm((f) => ({ ...f, href }))}
                placeholder="/services/gift-cards or https://…"
                autoCapitalize="none"
              />
            ) : (
              <Text style={styles.linkHint}>Opens {form.href}</Text>
            )}
            <Field
              label="Badge (optional)"
              value={form.badge}
              onChangeText={(badge) => setForm((f) => ({ ...f, badge }))}
              placeholder="Popular"
            />
            <Field
              label="Sort order"
              value={form.sortOrder}
              onChangeText={(sortOrder) => setForm((f) => ({ ...f, sortOrder }))}
              keyboardType="number-pad"
            />
            <Field
              label="Expires at (ISO / datetime)"
              value={form.endsAt}
              onChangeText={(endsAt) => setForm((f) => ({ ...f, endsAt }))}
              placeholder="2026-12-31T23:59"
              autoCapitalize="none"
            />

            <Text style={styles.label}>Status</Text>
            <View style={styles.statusRow}>
              {(['live', 'paused', 'draft', 'archived'] as AdStatus[]).map(
                (status) => {
                  const active = form.status === status;
                  return (
                    <Pressable
                      key={status}
                      onPress={() => setForm((f) => ({ ...f, status }))}
                      style={[styles.statusBtn, active && styles.statusBtnOn]}>
                      <Text
                        style={[
                          styles.statusBtnText,
                          active && styles.statusBtnTextOn,
                        ]}>
                        {status}
                      </Text>
                    </Pressable>
                  );
                },
              )}
            </View>

            <Text style={styles.label}>Image</Text>
            <Pressable style={styles.imagePick} onPress={() => void pickImage()}>
              {form.imageUrl ? (
                <Image
                  source={{ uri: form.image?.preview || form.imageUrl }}
                  style={styles.imagePreview}
                  contentFit="cover"
                />
              ) : (
                <View style={styles.imageEmpty}>
                  <Ionicons name="image-outline" size={28} color={colors.mutedForeground} />
                  <Text style={styles.imageEmptyText}>Tap to upload</Text>
                </View>
              )}
            </Pressable>

            <Button
              title={saving ? 'Saving…' : editing ? 'Save changes' : 'Create ad'}
              loading={saving}
              onPress={() => void onSave()}
              style={{ marginTop: 8 }}
            />
          </ScrollView>
        </View>
      </Modal>
    </Screen>
  );
}

function Field({
  label,
  ...props
}: {
  label: string;
} & React.ComponentProps<typeof TextInput>) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput {...props} style={styles.input} placeholderTextColor={colors.mutedForeground} />
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Brand.orange,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  addText: { color: Brand.white, fontWeight: '800', fontSize: 13 },
  filters: { gap: 8, paddingBottom: 12 },
  chip: {
    borderRadius: 999,
    backgroundColor: colors.muted,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipActive: { backgroundColor: Brand.orange },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.mutedForeground,
    textTransform: 'capitalize',
  },
  chipTextActive: { color: Brand.white },
  list: { gap: 12, paddingBottom: 12 },
  preview: {
    height: 140,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: colors.muted,
    marginBottom: 12,
  },
  previewImage: { width: '100%', height: '100%' },
  previewTop: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  flag: {
    backgroundColor: Brand.error,
    color: Brand.white,
    overflow: 'hidden',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    fontSize: 10,
    fontWeight: '800',
  },
  flagLive: { backgroundColor: Brand.success },
  title: { fontSize: 16, fontWeight: '800', color: colors.foreground },
  sub: { marginTop: 4, fontSize: 13, color: colors.mutedForeground },
  meta: { marginTop: 6, fontSize: 12, color: colors.mutedForeground, fontWeight: '600' },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  statusBtn: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  statusBtnOn: {
    backgroundColor: Brand.orange,
    borderColor: Brand.orange,
  },
  statusBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.mutedForeground,
    textTransform: 'capitalize',
  },
  statusBtnTextOn: { color: Brand.white },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.muted,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  deleteBtn: {
    borderColor: 'rgba(255,59,48,0.25)',
    backgroundColor: 'rgba(255,59,48,0.08)',
  },
  actionText: { fontSize: 12, fontWeight: '700', color: colors.foreground },
  modal: { flex: 1, backgroundColor: colors.card },
  modalHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: colors.foreground },
  modalBody: { padding: 12, paddingBottom: 28 },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.mutedForeground,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  linkOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  linkChip: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.muted,
    paddingHorizontal: 10,
    paddingVertical: 8,
    maxWidth: '100%',
  },
  linkChipOn: {
    backgroundColor: Brand.orange,
    borderColor: Brand.orange,
  },
  linkChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.mutedForeground,
  },
  linkChipTextOn: { color: Brand.white },
  linkHint: {
    marginTop: -2,
    marginBottom: 12,
    fontSize: 12,
    fontWeight: '600',
    color: colors.mutedForeground,
  },
  input: {
    height: 48,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.muted,
    paddingHorizontal: 10,
    fontSize: 14,
    color: colors.foreground,
    fontWeight: '600',
  },
  imagePick: {
    height: 160,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.muted,
    marginBottom: 12,
  },
  imagePreview: { width: '100%', height: '100%' },
  imageEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  imageEmptyText: { fontSize: 13, fontWeight: '600', color: colors.mutedForeground },
});
}

