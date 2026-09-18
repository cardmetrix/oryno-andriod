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
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { AdminEmpty, AdminError, AdminLoading } from '@/components/admin/admin-state';
import { StatusBadge } from '@/components/admin/status-badge';
import { SelectSheet } from '@/components/app/picker-sheet';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { Brand, Radius, type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';
import { useAdminQuery } from '@/hooks/use-admin-query';
import { adminApi, ApiError } from '@/lib/admin/api';
import { alert } from '@/lib/alert';
import { endpoints } from '@/lib/endpoints';
import { toast } from '@/lib/toast';

type TestimonialStatus = 'pending' | 'approved' | 'rejected' | 'hidden';

type StatusOption = {
  value: TestimonialStatus;
  label: string;
  description?: string;
};

type Review = {
  id: string;
  authorName: string;
  authorRole: string | null;
  rating: number;
  body: string;
  status: TestimonialStatus;
  statusLabel: string;
  featured: boolean;
  sortOrder: number;
  approved: boolean;
  createdAt: string;
  updatedAt: string;
  approvedAt: string | null;
};

type Response = {
  reviews: Review[];
  statusOptions: StatusOption[];
};

type FormState = {
  authorName: string;
  authorRole: string;
  rating: number;
  body: string;
  status: TestimonialStatus;
  featured: boolean;
  sortOrder: string;
};

const FALLBACK_STATUS_OPTIONS: StatusOption[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'hidden', label: 'Hidden' },
];

const emptyForm = (): FormState => ({
  authorName: '',
  authorRole: '',
  rating: 5,
  body: '',
  status: 'approved',
  featured: false,
  sortOrder: '0',
});

export default function AdminTestimonialsScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { data, loading, error, reload } = useAdminQuery<Response>(
    endpoints.admin.testimonials,
  );
  const [filter, setFilter] = useState<'' | TestimonialStatus>('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Review | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const statusOptions = data?.statusOptions?.length
    ? data.statusOptions
    : FALLBACK_STATUS_OPTIONS;

  const reviews = useMemo(() => {
    const rows = data?.reviews ?? [];
    if (!filter) return rows;
    return rows.filter((review) => review.status === filter);
  }, [data?.reviews, filter]);

  const pendingCount =
    data?.reviews.filter((review) => review.status === 'pending').length ?? 0;

  function openCreate() {
    setEditing(null);
    setForm({
      ...emptyForm(),
      sortOrder: String(data?.reviews?.length ?? 0),
    });
    setOpen(true);
  }

  function openEdit(review: Review) {
    setEditing(review);
    setForm({
      authorName: review.authorName,
      authorRole: review.authorRole || '',
      rating: review.rating,
      body: review.body,
      status: review.status,
      featured: review.featured,
      sortOrder: String(review.sortOrder),
    });
    setOpen(true);
  }

  async function patchReview(
    id: string,
    patch: Record<string, unknown>,
    successMessage: string,
  ) {
    setBusyId(id);
    try {
      await adminApi.patch(endpoints.admin.testimonial(id), patch);
      toast.success(successMessage);
      await reload();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Update failed');
    } finally {
      setBusyId(null);
    }
  }

  async function onSave() {
    if (!form.authorName.trim() || !form.body.trim()) {
      toast.error('Name and review text are required');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        authorName: form.authorName.trim(),
        authorRole: form.authorRole.trim() || null,
        rating: form.rating,
        body: form.body.trim(),
        status: form.status,
        featured: form.featured,
        sortOrder: Number(form.sortOrder) || 0,
      };

      if (editing) {
        await adminApi.patch(endpoints.admin.testimonial(editing.id), payload);
        toast.success('Review updated');
      } else {
        await adminApi.post(endpoints.admin.testimonials, payload);
        toast.success('Review created');
      }
      setOpen(false);
      await reload();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete(review: Review) {
    alert.confirm(
      'Delete review?',
      `Delete review from ${review.authorName}? This cannot be undone.`,
      {
        confirmLabel: 'Delete',
        destructive: true,
        onConfirm: () => void onDelete(review),
      },
    );
  }

  async function onDelete(review: Review) {
    setBusyId(review.id);
    try {
      await adminApi.delete(endpoints.admin.testimonial(review.id));
      toast.success('Review deleted');
      await reload();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Delete failed');
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
          title="Testimonials"
          subtitle="Approve user reviews for the landing page marquee, feature highlights, or reject spam"
          actions={
            <Pressable style={styles.addBtn} onPress={openCreate}>
              <Ionicons name="add" size={18} color={Brand.white} />
              <Text style={styles.addText}>Add</Text>
            </Pressable>
          }
        />
      }>
      <SelectSheet
        label="Status filter"
        title="Filter by status"
        value={filter || 'all'}
        onChange={(v) => setFilter(v === 'all' ? '' : (v as TestimonialStatus))}
        fullScreen={false}
        options={[
          { id: 'all', title: 'All' },
          ...statusOptions.map((option) => ({
            id: option.value,
            title:
              option.value === 'pending' && pendingCount
                ? `${option.label} (${pendingCount})`
                : option.label,
          })),
        ]}
      />

      {loading && !data ? <AdminLoading /> : null}
      {error && !data ? <AdminError message={error} onRetry={reload} /> : null}

      {data ? (
        reviews.length === 0 ? (
          <AdminEmpty message="No reviews yet. User submissions and manually added reviews will appear here for moderation." />
        ) : (
          <View style={styles.list}>
            {reviews.map((review) => {
              const busy = busyId === review.id;
              return (
                <AdminCard key={review.id}>
                  <View style={styles.cardHead}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <View style={styles.nameRow}>
                        <Text style={styles.title} numberOfLines={1}>
                          {review.authorName}
                        </Text>
                        <StatusBadge status={review.statusLabel || review.status} />
                        {review.featured ? (
                          <Text style={styles.featuredBadge}>Featured</Text>
                        ) : null}
                      </View>
                      {review.authorRole ? (
                        <Text style={styles.sub} numberOfLines={1}>
                          {review.authorRole}
                        </Text>
                      ) : null}
                    </View>
                    <StarRow value={review.rating} />
                  </View>

                  <Text style={styles.body} numberOfLines={4}>
                    “{review.body}”
                  </Text>

                  <Text style={styles.meta}>
                    Sort {review.sortOrder}
                    {' · '}
                    {new Date(review.createdAt).toLocaleString()}
                  </Text>

                  <View style={styles.actions}>
                    {review.status === 'pending' ? (
                      <>
                        <Pressable
                          disabled={busy}
                          onPress={() =>
                            void patchReview(
                              review.id,
                              { status: 'approved' },
                              'Review approved',
                            )
                          }
                          style={[styles.actionBtn, styles.successBtn]}>
                          <Ionicons
                            name="checkmark"
                            size={16}
                            color={Brand.success}
                          />
                          <Text style={[styles.actionText, { color: Brand.success }]}>
                            Approve
                          </Text>
                        </Pressable>
                        <Pressable
                          disabled={busy}
                          onPress={() =>
                            void patchReview(
                              review.id,
                              { status: 'rejected' },
                              'Review rejected',
                            )
                          }
                          style={[styles.actionBtn, styles.dangerBtn]}>
                          <Ionicons name="close" size={16} color={Brand.error} />
                          <Text style={[styles.actionText, { color: Brand.error }]}>
                            Reject
                          </Text>
                        </Pressable>
                      </>
                    ) : null}

                    {review.status === 'approved' ? (
                      <Pressable
                        disabled={busy}
                        onPress={() =>
                          void patchReview(
                            review.id,
                            { featured: !review.featured },
                            review.featured
                              ? 'Removed from featured'
                              : 'Marked featured',
                          )
                        }
                        style={styles.actionBtn}>
                        <Ionicons
                          name={review.featured ? 'star' : 'star-outline'}
                          size={16}
                          color={colors.foreground}
                        />
                        <Text style={styles.actionText}>
                          {review.featured ? 'Unfeature' : 'Feature'}
                        </Text>
                      </Pressable>
                    ) : null}

                    <Pressable
                      disabled={busy}
                      onPress={() => openEdit(review)}
                      style={styles.actionBtn}>
                      <Ionicons
                        name="create-outline"
                        size={16}
                        color={colors.foreground}
                      />
                      <Text style={styles.actionText}>Edit</Text>
                    </Pressable>

                    <Pressable
                      disabled={busy}
                      onPress={() => confirmDelete(review)}
                      style={[styles.actionBtn, styles.dangerBtn]}>
                      <Ionicons name="trash-outline" size={16} color={Brand.error} />
                      <Text style={[styles.actionText, { color: Brand.error }]}>
                        Delete
                      </Text>
                    </Pressable>
                  </View>
                </AdminCard>
              );
            })}
          </View>
        )
      ) : null}

      <Modal visible={open} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.modal, { paddingTop: Math.max(insets.top, 12) }]}>
          <View style={styles.modalHead}>
            <Text style={styles.modalTitle}>
              {editing ? 'Edit review' : 'Add review'}
            </Text>
            <Pressable onPress={() => setOpen(false)} hitSlop={10}>
              <Ionicons name="close" size={22} color={colors.foreground} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.modalBody}>
            <Field
              label="Name"
              value={form.authorName}
              onChangeText={(authorName) => setForm((f) => ({ ...f, authorName }))}
              placeholder="Ada Okafor"
            />
            <Field
              label="Location or role"
              value={form.authorRole}
              onChangeText={(authorRole) => setForm((f) => ({ ...f, authorRole }))}
              placeholder="Optional"
            />

            <Text style={styles.label}>Rating</Text>
            <View style={styles.ratingRow}>
              {[1, 2, 3, 4, 5].map((value) => {
                const active = form.rating >= value;
                return (
                  <Pressable
                    key={value}
                    onPress={() => setForm((f) => ({ ...f, rating: value }))}
                    hitSlop={6}>
                    <Ionicons
                      name={active ? 'star' : 'star-outline'}
                      size={28}
                      color={active ? Brand.orange : colors.mutedForeground}
                    />
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.label}>Review</Text>
            <TextInput
              value={form.body}
              onChangeText={(body) => setForm((f) => ({ ...f, body }))}
              multiline
              maxLength={600}
              placeholder="Write the review…"
              placeholderTextColor={colors.mutedForeground}
              style={styles.textarea}
            />

            <SelectSheet
              label="Status"
              title="Review status"
              value={form.status}
              onChange={(status) =>
                setForm((f) => ({ ...f, status: status as TestimonialStatus }))
              }
              fullScreen={false}
              options={statusOptions.map((option) => ({
                id: option.value,
                title: option.label,
              }))}
            />

            <Field
              label="Sort order"
              value={form.sortOrder}
              onChangeText={(sortOrder) => setForm((f) => ({ ...f, sortOrder }))}
              keyboardType="number-pad"
            />

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Featured in marquee</Text>
              <Switch
                value={form.featured}
                onValueChange={(featured) => setForm((f) => ({ ...f, featured }))}
                trackColor={{ false: colors.border, true: Brand.orange }}
              />
            </View>

            <Button
              title={
                saving ? 'Saving…' : editing ? 'Save changes' : 'Create review'
              }
              loading={saving}
              disabled={saving}
              onPress={() => void onSave()}
              style={{ marginTop: 8 }}
            />
          </ScrollView>
        </View>
      </Modal>
    </Screen>
  );
}

function StarRow({ value }: { value: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Ionicons
          key={n}
          name={value >= n ? 'star' : 'star-outline'}
          size={14}
          color={Brand.orange}
        />
      ))}
    </View>
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
    list: { gap: 12, paddingBottom: 12, marginTop: 8 },
    cardHead: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 10,
    },
    nameRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 6,
    },
    title: { fontSize: 16, fontWeight: '800', color: colors.foreground },
    sub: { marginTop: 4, fontSize: 13, color: colors.mutedForeground },
    featuredBadge: {
      overflow: 'hidden',
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 3,
      fontSize: 10,
      fontWeight: '800',
      textTransform: 'uppercase',
      color: Brand.orange,
      backgroundColor: 'rgba(255,106,0,0.12)',
    },
    body: {
      marginTop: 12,
      fontSize: 14,
      lineHeight: 20,
      color: colors.foreground,
      fontWeight: '500',
    },
    meta: {
      marginTop: 10,
      fontSize: 11,
      fontWeight: '600',
      color: colors.mutedForeground,
    },
    actions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 14,
      paddingTop: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
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
    successBtn: {
      borderColor: 'rgba(52,199,89,0.3)',
      backgroundColor: 'rgba(52,199,89,0.1)',
    },
    dangerBtn: {
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
      minHeight: 120,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.muted,
      paddingHorizontal: 10,
      paddingVertical: 12,
      fontSize: 14,
      color: colors.foreground,
      fontWeight: '600',
      textAlignVertical: 'top',
      marginBottom: 12,
    },
    ratingRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 14,
    },
    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
      paddingVertical: 4,
    },
    switchLabel: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.foreground,
    },
  });
}
