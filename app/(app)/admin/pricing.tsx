import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AdminCard } from '@/components/admin/admin-card';
import { AdminEmpty, AdminError, AdminLoading } from '@/components/admin/admin-state';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { Screen } from '@/components/ui/screen';
import { Brand, Radius, type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';
import { adminApi } from '@/lib/admin/api';
import { endpoints } from '@/lib/endpoints';
import { toast } from '@/lib/toast';

type ProviderKey = 'jap' | 'herosms' | 'reloadly' | 'sogo' | 'vtpass';

type ProviderPricing = {
  markup: number;
  payoutShare?: number;
  enabled: boolean;
};

type PricingConfig = {
  fxCommission: number;
  providers: Record<ProviderKey, ProviderPricing>;
};

type OverrideRow = {
  id: string;
  provider: ProviderKey;
  serviceKey: string;
  label: string | null;
  mode: 'markup' | 'fixed' | 'percent';
  value: number;
  active: boolean;
};

type PricingResponse = {
  ok: true;
  config: PricingConfig;
  overrides: OverrideRow[];
};

type CatalogItem = {
  serviceKey: string;
  title: string;
  subtitle: string;
  details: string;
  currency: string;
  costUsd: number | null;
  costLocal: number | null;
  retailLocal: number;
  listLocal: number;
  override: OverrideRow | null;
};

type CatalogFilterField = {
  key: string;
  label: string;
  options: Array<{ id: string; label: string }>;
};

type CatalogResponse = {
  ok: true;
  provider: ProviderKey;
  currency: string;
  filters: {
    fields: CatalogFilterField[];
    applied: Record<string, string>;
  };
  items: CatalogItem[];
  demo: boolean;
  hint?: string;
};

type EditState = {
  mode: OverrideRow['mode'];
  value: string;
};

const LABELS: Record<ProviderKey, string> = {
  jap: 'Social (JAP)',
  herosms: 'Numbers & Emails',
  reloadly: 'Gift cards buy',
  sogo: 'Gift cards sell',
  vtpass: 'Airtime / Data / Bills',
};

function money(n: number) {
  return `₦${n.toLocaleString('en-NG', { maximumFractionDigits: 2 })}`;
}

export default function AdminPricingScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [data, setData] = useState<PricingResponse | null>(null);
  const [draft, setDraft] = useState<PricingConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bulkProvider, setBulkProvider] = useState<ProviderKey>('jap');
  const [bulkPercent, setBulkPercent] = useState('5');

  const [catalogProvider, setCatalogProvider] = useState<ProviderKey>('jap');
  const [catalogFilters, setCatalogFilters] = useState<Record<string, string>>({
    platform: 'All',
    channel: 'numbers',
    identifier: 'data',
    countryCode: 'US',
  });
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, EditState>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const json = await adminApi.get<PricingResponse>(endpoints.admin.pricing);
      setData(json);
      setDraft(json.config);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load pricing');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCatalog = useCallback(async () => {
    setCatalogLoading(true);
    setCatalogError(null);
    try {
      const qs = new URLSearchParams({ provider: catalogProvider });
      for (const [k, v] of Object.entries(catalogFilters)) {
        if (v) qs.set(k, v);
      }
      if (catalogSearch.trim()) qs.set('q', catalogSearch.trim());
      const json = await adminApi.get<CatalogResponse>(
        `${endpoints.admin.pricingCatalog}?${qs.toString()}`,
      );
      setCatalog(json);
      const nextEdits: Record<string, EditState> = {};
      for (const item of json.items) {
        nextEdits[item.serviceKey] = item.override
          ? { mode: item.override.mode, value: String(item.override.value) }
          : { mode: 'fixed', value: String(item.retailLocal) };
      }
      setEdits(nextEdits);
    } catch (e) {
      setCatalogError(e instanceof Error ? e.message : 'Failed to load catalog');
      setCatalog(null);
    } finally {
      setCatalogLoading(false);
    }
  }, [catalogProvider, catalogFilters, catalogSearch]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadCatalog();
    // Reload when provider/filter picks change — search uses the Search button.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    catalogProvider,
    catalogFilters.platform,
    catalogFilters.channel,
    catalogFilters.service,
    catalogFilters.site,
    catalogFilters.countryCode,
    catalogFilters.identifier,
    catalogFilters.serviceID,
  ]);

  const visibleFilterFields = useMemo(() => {
    const fields = catalog?.filters.fields ?? [];
    return fields.filter((field) => {
      if (
        catalogProvider === 'herosms' &&
        field.key === 'service' &&
        (catalogFilters.channel || 'numbers') === 'emails'
      ) {
        return false;
      }
      if (
        catalogProvider === 'herosms' &&
        field.key === 'site' &&
        (catalogFilters.channel || 'numbers') !== 'emails'
      ) {
        return false;
      }
      return true;
    });
  }, [catalog?.filters.fields, catalogProvider, catalogFilters.channel]);

  async function saveGroup() {
    if (!draft) return;
    setSaving(true);
    try {
      await adminApi.patch(endpoints.admin.pricing, {
        action: 'save_config',
        config: draft,
      });
      toast.success('Group pricing saved');
      await load();
      await loadCatalog();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function applyBulk() {
    setSaving(true);
    try {
      await adminApi.patch(endpoints.admin.pricing, {
        action: 'bulk_percent',
        provider: bulkProvider,
        percent: Number(bulkPercent),
      });
      toast.success(`Adjusted ${LABELS[bulkProvider]} by ${bulkPercent}%`);
      await load();
      await loadCatalog();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Bulk adjust failed');
    } finally {
      setSaving(false);
    }
  }

  function setFilter(key: string, value: string) {
    setCatalogFilters((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'channel') {
        delete next.service;
        delete next.site;
        if (value === 'emails') next.site = 'telegram.com';
      }
      if (key === 'identifier') delete next.serviceID;
      return next;
    });
  }

  async function saveItem(item: CatalogItem) {
    const edit = edits[item.serviceKey];
    if (!edit) return;
    const value = Number(edit.value);
    if (!Number.isFinite(value)) {
      toast.error('Enter a valid value');
      return;
    }
    setSaving(true);
    try {
      await adminApi.patch(endpoints.admin.pricing, {
        action: 'upsert_override',
        override: {
          provider: catalogProvider,
          serviceKey: item.serviceKey,
          label: item.title,
          mode: edit.mode,
          value,
          active: true,
        },
      });
      toast.success(`Updated ${item.title}`);
      await load();
      await loadCatalog();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Override failed');
    } finally {
      setSaving(false);
    }
  }

  async function clearItem(item: CatalogItem) {
    if (!item.override?.id) return;
    setSaving(true);
    try {
      await adminApi.patch(endpoints.admin.pricing, {
        action: 'delete_override',
        deleteOverrideId: item.override.id,
      });
      toast.success('Override cleared');
      await load();
      await loadCatalog();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setSaving(false);
    }
  }

  async function removeOverride(id: string) {
    setSaving(true);
    try {
      await adminApi.patch(endpoints.admin.pricing, {
        action: 'delete_override',
        deleteOverrideId: id,
      });
      await load();
      await loadCatalog();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen scroll refreshing={loading || catalogLoading} onRefresh={() => {
      void load();
      void loadCatalog();
    }}>
      <AdminPageHeader
        title="Service pricing"
        subtitle="Select a service to browse live prices, then update any item."
      />

      {loading && !data ? <AdminLoading variant="cards" /> : null}
      {error ? <AdminError message={error} onRetry={load} /> : null}

      {draft ? (
        <AdminCard title="Group markups">
          {(Object.keys(draft.providers) as ProviderKey[]).map((key) => {
            const row = draft.providers[key];
            return (
              <View key={key} style={styles.field}>
                <Text style={styles.label}>{LABELS[key]}</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="decimal-pad"
                  value={String(key === 'sogo' ? row.payoutShare ?? 1 : row.markup)}
                  onChangeText={(v) => {
                    const n = Number(v);
                    setDraft({
                      ...draft,
                      providers: {
                        ...draft.providers,
                        [key]:
                          key === 'sogo'
                            ? { ...row, payoutShare: n }
                            : { ...row, markup: n },
                      },
                    });
                  }}
                />
                <Text style={styles.hint}>
                  {key === 'sogo'
                    ? 'Payout share 0–1 (1 = pass-through)'
                    : `Markup × (1.25 = +25%)`}
                </Text>
              </View>
            );
          })}
          <Pressable
            style={[styles.btn, saving && styles.btnDisabled]}
            disabled={saving}
            onPress={() => void saveGroup()}>
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>Save group pricing</Text>
            )}
          </Pressable>
        </AdminCard>
      ) : null}

      <AdminCard title="Bulk percent (group)">
        <Text style={styles.hint}>Adjust a provider’s group markup by ±%</Text>
        <View style={styles.chipRow}>
          {(Object.keys(LABELS) as ProviderKey[]).map((k) => (
            <Pressable
              key={k}
              onPress={() => setBulkProvider(k)}
              style={[styles.chip, bulkProvider === k && styles.chipOn]}>
              <Text style={[styles.chipText, bulkProvider === k && styles.chipTextOn]}>
                {LABELS[k]}
              </Text>
            </Pressable>
          ))}
        </View>
        <TextInput
          style={styles.input}
          keyboardType="numbers-and-punctuation"
          value={bulkPercent}
          onChangeText={setBulkPercent}
          placeholder="+5 or -10"
          placeholderTextColor={colors.mutedForeground}
        />
        <Pressable style={styles.btnSecondary} onPress={() => void applyBulk()}>
          <Text style={styles.btnSecondaryText}>Apply bulk %</Text>
        </Pressable>
      </AdminCard>

      <AdminCard title="Individual price update">
        <Text style={styles.hint}>
          Pick a category, browse full live prices, then edit any row.
        </Text>

        <View style={styles.chipRow}>
          {(Object.keys(LABELS) as ProviderKey[]).map((k) => (
            <Pressable
              key={k}
              onPress={() => {
                setCatalogProvider(k);
                setCatalogSearch('');
              }}
              style={[styles.chip, catalogProvider === k && styles.chipOn]}>
              <Text style={[styles.chipText, catalogProvider === k && styles.chipTextOn]}>
                {LABELS[k]}
              </Text>
            </Pressable>
          ))}
        </View>

        {visibleFilterFields.map((field) => (
          <View key={field.key} style={{ marginTop: 12 }}>
            <Text style={styles.label}>{field.label}</Text>
            <View style={styles.chipRow}>
              {field.options.slice(0, 24).map((opt) => {
                const active =
                  (catalogFilters[field.key] || field.options[0]?.id) === opt.id;
                return (
                  <Pressable
                    key={opt.id}
                    onPress={() => setFilter(field.key, opt.id)}
                    style={[styles.chip, active && styles.chipOn]}>
                    <Text style={[styles.chipText, active && styles.chipTextOn]}>
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}

        {(catalogProvider === 'jap' || catalogProvider === 'reloadly') && (
          <View style={styles.searchRow}>
            <TextInput
              style={[styles.input, { flex: 1, marginTop: 0 }]}
              value={catalogSearch}
              onChangeText={setCatalogSearch}
              placeholder="Search by name…"
              placeholderTextColor={colors.mutedForeground}
            />
            <Pressable style={styles.searchBtn} onPress={() => void loadCatalog()}>
              <Text style={styles.searchBtnText}>Search</Text>
            </Pressable>
          </View>
        )}

        {catalog?.hint ? <Text style={styles.hint}>{catalog.hint}</Text> : null}
        {catalog?.demo ? (
          <Text style={[styles.hint, { color: Brand.orange }]}>
            Demo catalog — live keys needed for production prices.
          </Text>
        ) : null}

        {catalogLoading ? <AdminLoading variant="cards" /> : null}
        {catalogError ? (
          <AdminError message={catalogError} onRetry={loadCatalog} />
        ) : null}
        {!catalogLoading && catalog && !catalog.items.length ? (
          <AdminEmpty message="No priced services for this selection." />
        ) : null}

        {catalog?.items.map((item) => {
          const edit = edits[item.serviceKey] || {
            mode: 'fixed' as const,
            value: String(item.retailLocal),
          };
          return (
            <View key={item.serviceKey} style={styles.itemCard}>
              <Text style={styles.itemTitle}>{item.title}</Text>
              <Text style={styles.itemSub}>{item.subtitle}</Text>
              <Text style={styles.itemDetails}>{item.details}</Text>
              <View style={styles.priceRow}>
                {item.costUsd != null ? (
                  <Text style={styles.priceMeta}>Cost ${item.costUsd.toFixed(4)}</Text>
                ) : null}
                {item.costLocal != null ? (
                  <Text style={styles.priceMeta}>Provider {money(item.costLocal)}</Text>
                ) : null}
                <Text style={styles.priceRetail}>Retail {money(item.retailLocal)}</Text>
              </View>
              {item.override ? (
                <Text style={styles.overrideBadge}>
                  Override · {item.override.mode} {item.override.value}
                </Text>
              ) : (
                <Text style={styles.hint}>Using group markup</Text>
              )}

              <View style={styles.chipRow}>
                {(['fixed', 'percent', 'markup'] as const).map((m) => (
                  <Pressable
                    key={m}
                    onPress={() =>
                      setEdits((prev) => ({
                        ...prev,
                        [item.serviceKey]: { ...edit, mode: m },
                      }))
                    }
                    style={[styles.chip, edit.mode === m && styles.chipOn]}>
                    <Text style={[styles.chipText, edit.mode === m && styles.chipTextOn]}>
                      {m}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <TextInput
                style={styles.input}
                keyboardType="numbers-and-punctuation"
                value={edit.value}
                onChangeText={(value) =>
                  setEdits((prev) => ({
                    ...prev,
                    [item.serviceKey]: { ...edit, value },
                  }))
                }
                placeholder={edit.mode === 'fixed' ? 'Fixed local price' : 'Value'}
                placeholderTextColor={colors.mutedForeground}
              />
              <View style={styles.itemActions}>
                <Pressable
                  style={[styles.btn, styles.btnFlex, saving && styles.btnDisabled]}
                  disabled={saving}
                  onPress={() => void saveItem(item)}>
                  <Text style={styles.btnText}>Save price</Text>
                </Pressable>
                {item.override ? (
                  <Pressable
                    style={[styles.btnSecondary, styles.btnFlex]}
                    onPress={() => void clearItem(item)}>
                    <Text style={[styles.btnSecondaryText, { color: Brand.error }]}>
                      Clear
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          );
        })}
      </AdminCard>

      <AdminCard title="Active overrides">
        {!data?.overrides?.length ? (
          <AdminEmpty message="No individual overrides — group markups still apply." />
        ) : (
          data.overrides.map((row) => (
            <View key={row.id} style={styles.overrideRow}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.overrideTitle}>
                  {row.label || LABELS[row.provider]} · {row.mode} {row.value}
                </Text>
                <Text style={styles.overrideKey}>{row.serviceKey}</Text>
              </View>
              <Pressable onPress={() => void removeOverride(row.id)}>
                <Text style={styles.remove}>Remove</Text>
              </Pressable>
            </View>
          ))
        )}
      </AdminCard>
    </Screen>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
  field: { marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '700', color: colors.foreground, marginBottom: 6 },
  hint: { marginTop: 4, fontSize: 12, color: colors.mutedForeground },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.foreground,
    backgroundColor: colors.card,
    marginTop: 8,
  },
  btn: {
    marginTop: 12,
    backgroundColor: Brand.orange,
    borderRadius: Radius.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  btnFlex: { flex: 1 },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: Brand.white, fontWeight: '800', fontSize: 14 },
  btnSecondary: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: Radius.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  btnSecondaryText: { color: colors.foreground, fontWeight: '700', fontSize: 14 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.muted,
  },
  chipOn: { backgroundColor: Brand.orange, borderColor: Brand.orange },
  chipText: { fontSize: 11, fontWeight: '700', color: colors.mutedForeground },
  chipTextOn: { color: Brand.white },
  searchRow: { flexDirection: 'row', gap: 8, marginTop: 12, alignItems: 'center' },
  searchBtn: {
    backgroundColor: Brand.orange,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  searchBtnText: { color: Brand.white, fontWeight: '700', fontSize: 13 },
  itemCard: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  itemTitle: { fontSize: 14, fontWeight: '800', color: colors.foreground },
  itemSub: { marginTop: 2, fontSize: 12, fontWeight: '600', color: colors.mutedForeground },
  itemDetails: { marginTop: 4, fontSize: 11, color: colors.mutedForeground, lineHeight: 16 },
  priceRow: { marginTop: 8, gap: 2 },
  priceMeta: { fontSize: 12, color: colors.mutedForeground },
  priceRetail: { fontSize: 14, fontWeight: '800', color: Brand.orange, marginTop: 2 },
  overrideBadge: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '700',
    color: '#0F7B46',
  },
  itemActions: { flexDirection: 'row', gap: 8 },
  overrideRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  overrideTitle: { fontSize: 13, fontWeight: '700', color: colors.foreground },
  overrideKey: { marginTop: 2, fontSize: 11, fontFamily: 'Menlo', color: colors.mutedForeground },
  remove: { color: Brand.error, fontWeight: '700', fontSize: 13 },
});
}

