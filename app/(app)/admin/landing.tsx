import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AdminCard } from '@/components/admin/admin-card';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { AdminEmpty, AdminError, AdminLoading } from '@/components/admin/admin-state';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { Brand, type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';
import { useAdminQuery } from '@/hooks/use-admin-query';
import { adminApi, ApiError } from '@/lib/admin/api';
import { alert } from '@/lib/alert';
import { endpoints } from '@/lib/endpoints';
import { toast } from '@/lib/toast';

type Asset = {
  id: string;
  slot: string;
  label: string;
  description: string | null;
  imageUrl: string;
  imageUrlAbsolute: string;
  defaultPath: string;
  defaultUrl: string;
  group: string;
  sortOrder: number;
  isCustom: boolean;
  updatedAt: string;
};

type Response = { assets: Asset[] };

type GroupFilter = 'all' | 'auth' | 'landing';

const FILTERS: Array<{ value: GroupFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'auth', label: 'Login / Auth' },
  { value: 'landing', label: 'Landing page' },
];

export default function AdminLandingScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { data, loading, error, reload } = useAdminQuery<Response>(
    endpoints.admin.landing,
  );
  const [filter, setFilter] = useState<GroupFilter>('all');
  const [busyId, setBusyId] = useState<string | null>(null);

  const assets = useMemo(() => {
    const rows = data?.assets ?? [];
    if (filter === 'all') return rows;
    return rows.filter((a) => a.group === filter);
  }, [data?.assets, filter]);

  async function pickAndUpload(asset: Asset) {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      toast.error('Allow photo library access to upload landing images.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      base64: true,
    });
    if (result.canceled || !result.assets[0]?.base64) return;

    const picked = result.assets[0];
    setBusyId(asset.id);
    try {
      await adminApi.patch(endpoints.admin.landingItem(asset.id), {
        image: {
          filename: picked.fileName || `landing-${asset.slot}-${Date.now()}.jpg`,
          mime: picked.mimeType || 'image/jpeg',
          base64: picked.base64,
        },
      });
      toast.success('Image updated');
      await reload();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Update failed');
    } finally {
      setBusyId(null);
    }
  }

  function confirmReset(asset: Asset) {
    alert.confirm(
      'Reset to default?',
      `Reset “${asset.label}” to the default bundled image?\n${asset.defaultPath}`,
      {
        confirmLabel: 'Reset',
        destructive: true,
        onConfirm: () => void resetAsset(asset),
      },
    );
  }

  async function resetAsset(asset: Asset) {
    setBusyId(asset.id);
    try {
      await adminApi.delete(endpoints.admin.landingItem(asset.id));
      toast.success('Reset to default');
      await reload();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Reset failed');
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
          title="Landing & Auth images"
          subtitle="Upload or replace website landing screenshots and the login-screen panel image"
        />
      }>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filters}>
        {FILTERS.map((item) => {
          const active = filter === item.value;
          return (
            <Pressable
              key={item.value}
              onPress={() => setFilter(item.value)}
              style={[styles.chip, active && styles.chipActive]}>
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {loading && !data ? <AdminLoading /> : null}
      {error && !data ? <AdminError message={error} onRetry={reload} /> : null}

      {data ? (
        assets.length === 0 ? (
          <AdminEmpty message="No landing assets yet." />
        ) : (
          <View style={styles.list}>
            {assets.map((asset) => {
              const busy = busyId === asset.id;
              return (
                <AdminCard key={asset.id}>
                  <View style={styles.preview}>
                    <Image
                      source={{ uri: asset.imageUrlAbsolute || asset.imageUrl }}
                      style={styles.previewImage}
                      contentFit="cover"
                    />
                    <View style={styles.previewTop}>
                      <Text
                        style={[
                          styles.badge,
                          asset.isCustom ? styles.badgeCustom : styles.badgeDefault,
                        ]}>
                        {asset.isCustom ? 'Custom' : 'Default'}
                      </Text>
                      <Text style={[styles.badge, styles.badgeGroup]}>
                        {asset.group}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.title}>{asset.label}</Text>
                  {asset.description ? (
                    <Text style={styles.sub} numberOfLines={3}>
                      {asset.description}
                    </Text>
                  ) : null}
                  <Text style={styles.meta} numberOfLines={1}>
                    {asset.slot} · {asset.defaultPath}
                  </Text>

                  <View style={styles.actions}>
                    <Button
                      title={busy ? 'Saving…' : 'Upload / replace'}
                      loading={busy}
                      disabled={busy}
                      onPress={() => void pickAndUpload(asset)}
                      style={{ flex: 1 }}
                    />
                    <Pressable
                      disabled={busy || !asset.isCustom}
                      onPress={() => confirmReset(asset)}
                      style={[
                        styles.resetBtn,
                        (busy || !asset.isCustom) && styles.resetDisabled,
                      ]}>
                      <Ionicons
                        name="refresh-outline"
                        size={16}
                        color={colors.foreground}
                      />
                      <Text style={styles.resetText}>Reset</Text>
                    </Pressable>
                  </View>
                </AdminCard>
              );
            })}
          </View>
        )
      ) : null}

      <AdminCard>
        <View style={styles.hintRow}>
          <Ionicons name="cloud-upload-outline" size={18} color={Brand.orange} />
          <Text style={styles.hint}>
            Uploads use the same secure image pipeline as Ads & Onboarding. Reset
            restores the original bundled file.
          </Text>
        </View>
      </AdminCard>
    </Screen>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
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
    },
    chipTextActive: { color: Brand.white },
    list: { gap: 12, paddingBottom: 12 },
    preview: {
      height: 220,
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
    badge: {
      overflow: 'hidden',
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 3,
      fontSize: 10,
      fontWeight: '800',
      color: Brand.white,
      textTransform: 'uppercase',
    },
    badgeCustom: { backgroundColor: Brand.success },
    badgeDefault: { backgroundColor: 'rgba(0,0,0,0.6)' },
    badgeGroup: { backgroundColor: 'rgba(0,0,0,0.6)' },
    title: { fontSize: 16, fontWeight: '800', color: colors.foreground },
    sub: { marginTop: 4, fontSize: 13, color: colors.mutedForeground, lineHeight: 18 },
    meta: {
      marginTop: 6,
      fontSize: 11,
      fontWeight: '600',
      color: colors.mutedForeground,
    },
    actions: { flexDirection: 'row', gap: 8, marginTop: 14, alignItems: 'center' },
    resetBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.muted,
      paddingHorizontal: 12,
      paddingVertical: 12,
    },
    resetDisabled: { opacity: 0.45 },
    resetText: { fontSize: 12, fontWeight: '700', color: colors.foreground },
    hintRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    hint: {
      flex: 1,
      fontSize: 13,
      lineHeight: 18,
      color: colors.mutedForeground,
      fontWeight: '500',
    },
  });
}
