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

type SlideStatus = 'draft' | 'live' | 'paused' | 'archived';

type Slide = {
  id: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  accent: string;
  status: SlideStatus;
  statusLabel: string;
  sortOrder: number;
  active: boolean;
};

type StatusOption = {
  value: SlideStatus;
  label: string;
  description: string;
};

type Response = {
  slides: Slide[];
  statusOptions: StatusOption[];
};

type FormState = {
  title: string;
  subtitle: string;
  accent: string;
  status: SlideStatus;
  sortOrder: string;
  imageUrl: string;
  image?: { filename: string; mime: string; base64: string; preview: string };
};

const EMPTY_FORM = (): FormState => ({
  title: '',
  subtitle: '',
  accent: '#FF6A00',
  status: 'live',
  sortOrder: '0',
  imageUrl: '',
});

const STATUS_FILTERS: Array<'' | SlideStatus> = [
  '',
  'live',
  'paused',
  'draft',
  'archived',
];

export default function AdminOnboardingScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const insets = useSafeAreaInsets();
  const { data, loading, error, reload } = useAdminQuery<Response>(
    endpoints.admin.onboarding,
  );
  const [filter, setFilter] = useState<'' | SlideStatus>('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Slide | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const slides = useMemo(() => {
    const rows = data?.slides ?? [];
    if (!filter) return rows;
    return rows.filter((s) => s.status === filter);
  }, [data?.slides, filter]);

  function openCreate() {
    setEditing(null);
    setForm({
      ...EMPTY_FORM(),
      sortOrder: String(data?.slides?.length ?? 0),
    });
    setOpen(true);
  }

  function openEdit(slide: Slide) {
    setEditing(slide);
    setForm({
      title: slide.title,
      subtitle: slide.subtitle,
      accent: slide.accent || '#FF6A00',
      status: slide.status,
      sortOrder: String(slide.sortOrder),
      imageUrl: slide.imageUrl,
      image: undefined,
    });
    setOpen(true);
  }

  async function pickImage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      toast.error('Allow photo library access to upload onboarding images.');
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
        filename: asset.fileName || `onboarding-${Date.now()}.jpg`,
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
    if (!form.subtitle.trim()) {
      toast.error('Description is required');
      return;
    }
    if (!form.imageUrl && !form.image) {
      toast.error('Upload an onboarding image');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        subtitle: form.subtitle.trim(),
        accent: form.accent.trim() || '#FF6A00',
        status: form.status,
        sortOrder: Number(form.sortOrder) || 0,
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
        await adminApi.patch(endpoints.admin.onboardingSlide(editing.id), payload);
        toast.success('Slide updated');
      } else {
        await adminApi.post(endpoints.admin.onboarding, payload);
        toast.success('Slide created');
      }
      setOpen(false);
      await reload();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Failed to save slide');
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(slide: Slide, status: SlideStatus) {
    setBusyId(slide.id);
    try {
      const json = await adminApi.patch<{ slide?: { statusLabel?: string } }>(
        endpoints.admin.onboardingSlide(slide.id),
        { status },
      );
      toast.success(`${slide.title} → ${json.slide?.statusLabel || status}`);
      await reload();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Failed to update');
    } finally {
      setBusyId(null);
    }
  }

  function confirmDelete(slide: Slide) {
    alert.confirm('Delete slide?', `“${slide.title}” will be permanently removed.`, {
      confirmLabel: 'Delete',
      destructive: true,
      onConfirm: () => void onDelete(slide),
    });
  }

  async function onDelete(slide: Slide) {
    setBusyId(slide.id);
    try {
      await adminApi.delete(endpoints.admin.onboardingSlide(slide.id));
      toast.success('Slide deleted');
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
        title="Onboarding"
        subtitle="App intro slides — image, title & description"
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
        slides.length === 0 ? (
          <AdminEmpty message="No onboarding slides yet. Create your first slide." />
        ) : (
          <View style={styles.list}>
            {slides.map((slide) => (
              <AdminCard key={slide.id}>
                <View style={styles.preview}>
                  <Image
                    source={{ uri: slide.imageUrl }}
                    style={styles.previewImage}
                    contentFit="cover"
                  />
                  <View style={styles.previewTop}>
                    <StatusBadge status={slide.statusLabel} />
                    {slide.active ? (
                      <Text style={[styles.flag, styles.flagLive]}>Showing</Text>
                    ) : null}
                  </View>
                </View>

                <Text style={styles.title}>{slide.title}</Text>
                <Text style={styles.sub} numberOfLines={3}>
                  {slide.subtitle}
                </Text>
                <Text style={styles.meta}>
                  Order {slide.sortOrder}
                  {slide.accent ? ` · ${slide.accent}` : ''}
                </Text>

                <View style={styles.statusRow}>
                  {(['live', 'paused', 'draft', 'archived'] as SlideStatus[]).map(
                    (status) => {
                      const active = slide.status === status;
                      return (
                        <Pressable
                          key={status}
                          disabled={busyId === slide.id || active}
                          onPress={() => void setStatus(slide, status)}
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
                  <Pressable
                    style={styles.actionBtn}
                    onPress={() => openEdit(slide)}>
                    <Ionicons name="create-outline" size={16} color={colors.foreground} />
                    <Text style={styles.actionText}>Edit</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.actionBtn, styles.deleteBtn]}
                    disabled={busyId === slide.id}
                    onPress={() => confirmDelete(slide)}>
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
              {editing ? 'Edit slide' : 'Create slide'}
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
              placeholder="Your borderless wallet"
            />
            <View style={{ marginBottom: 12 }}>
              <Text style={styles.label}>Description</Text>
              <TextInput
                value={form.subtitle}
                onChangeText={(subtitle) => setForm((f) => ({ ...f, subtitle }))}
                placeholder="Short description for this slide"
                placeholderTextColor={colors.mutedForeground}
                multiline
                style={[styles.input, styles.textarea]}
              />
            </View>
            <Field
              label="Sort order"
              value={form.sortOrder}
              onChangeText={(sortOrder) => setForm((f) => ({ ...f, sortOrder }))}
              keyboardType="number-pad"
            />
            <Field
              label="Accent color"
              value={form.accent}
              onChangeText={(accent) => setForm((f) => ({ ...f, accent }))}
              placeholder="#FF6A00"
              autoCapitalize="none"
            />

            <Text style={styles.label}>Status</Text>
            <View style={styles.statusRow}>
              {(['live', 'paused', 'draft', 'archived'] as SlideStatus[]).map(
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
              title={saving ? 'Saving…' : editing ? 'Save changes' : 'Create slide'}
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
      <TextInput
        {...props}
        style={styles.input}
        placeholderTextColor={colors.mutedForeground}
      />
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
    height: 160,
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
  sub: { marginTop: 4, fontSize: 13, color: colors.mutedForeground, lineHeight: 18 },
  meta: {
    marginTop: 6,
    fontSize: 12,
    color: colors.mutedForeground,
    fontWeight: '600',
  },
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
  textarea: {
    height: 96,
    paddingTop: 12,
    paddingBottom: 12,
    textAlignVertical: 'top',
  },
  imagePick: {
    height: 148,
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

