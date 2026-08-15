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
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { Brand, Radius, type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';
import { useAdminQuery } from '@/hooks/use-admin-query';
import { adminApi, ApiError } from '@/lib/admin/api';
import { endpoints } from '@/lib/endpoints';
import { toast } from '@/lib/toast';

type CountryStatus = 'live' | 'beta' | 'disabled';

type Country = {
  code: string;
  name: string;
  currency: string;
  currencySymbol: string;
  flagEmoji: string | null;
  services: string[];
  servicesLabel: string;
  gateway: string;
  status: CountryStatus;
  statusLabel: string;
  giftCardsEnabled: boolean;
};

type Preset = {
  code: string;
  name: string;
  currency: string;
  currencySymbol: string;
  flagEmoji: string;
};

type StatusOption = {
  value: CountryStatus;
  label: string;
  description: string;
};

type Response = {
  countries: Country[];
  presets: Preset[];
  statusOptions: StatusOption[];
};

const DEFAULT_COUNTRY_SERVICES = [
  'wallet',
  'airtime',
  'data',
  'bills',
  'virtual_numbers',
  'social',
  'gift_cards',
];

const FALLBACK_STATUS: StatusOption[] = [
  { value: 'live', label: 'Live', description: 'Fully available to users' },
  { value: 'beta', label: 'Suspended', description: 'Paused / soft hold (beta)' },
  { value: 'disabled', label: 'Disabled', description: 'Hidden and unavailable' },
];

export default function AdminCountriesScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const { data, loading, error, reload } = useAdminQuery<Response>(
    endpoints.admin.countries,
  );
  const [addOpen, setAddOpen] = useState(false);
  const [busyCode, setBusyCode] = useState<string | null>(null);

  const statusOptions = data?.statusOptions?.length
    ? data.statusOptions
    : FALLBACK_STATUS;

  async function setStatus(code: string, status: CountryStatus) {
    setBusyCode(code);
    try {
      const json = await adminApi.patch<{
        country?: { statusLabel?: string };
      }>(endpoints.admin.country(code), { status });
      toast.success(`${code} is now ${json.country?.statusLabel || status}`);
      await reload();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Failed to update');
    } finally {
      setBusyCode(null);
    }
  }

  return (
    <Screen
      scroll
      refreshing={loading}
      onRefresh={reload}
      header={
        <AdminPageHeader
          title="Countries"
          subtitle="Add markets and set Live, Suspended, or Disabled"
          actions={
            <Pressable
              onPress={() => setAddOpen(true)}
              style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.92 }]}>
              <Ionicons name="add" size={16} color={Brand.white} />
              <Text style={styles.addBtnText}>Add country</Text>
            </Pressable>
          }
        />
      }>
      {loading && !data ? <AdminLoading variant="cards" /> : null}
      {error ? <AdminError message={error} onRetry={reload} /> : null}

      {data ? (
        <AdminCard>
          {data.countries.length === 0 ? (
            <AdminEmpty message="No countries yet. Add your first market." />
          ) : (
            <View style={styles.grid}>
              {data.countries.map((country) => (
                <View key={country.code} style={styles.card}>
                  <View style={styles.cardTop}>
                    <Text style={styles.cardTitle} numberOfLines={1}>
                      {country.flagEmoji ? `${country.flagEmoji} ` : ''}
                      {country.name}
                    </Text>
                    <StatusBadge status={country.statusLabel} />
                  </View>
                  <Text style={styles.meta}>
                    {country.code} · {country.currencySymbol || country.currency} ·{' '}
                    {country.gateway}
                  </Text>
                  <Text style={styles.services} numberOfLines={2}>
                    {country.servicesLabel}
                  </Text>

                  <View style={styles.statusRow}>
                    {statusOptions.map((opt) => {
                      const active = country.status === opt.value;
                      const disabled = busyCode === country.code || active;
                      return (
                        <Pressable
                          key={opt.value}
                          disabled={disabled}
                          onPress={() => void setStatus(country.code, opt.value)}
                          style={[
                            styles.statusBtn,
                            active && styles.statusBtnOn,
                            disabled && !active && styles.statusBtnDisabled,
                          ]}>
                          <Text
                            style={[
                              styles.statusBtnText,
                              active && styles.statusBtnTextOn,
                            ]}>
                            {opt.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ))}
            </View>
          )}
        </AdminCard>
      ) : null}

      <AddCountrySheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        presets={data?.presets || []}
        existingCodes={new Set(data?.countries.map((c) => c.code) || [])}
        statusOptions={statusOptions}
        onCreated={async () => {
          setAddOpen(false);
          await reload();
        }}
      />
    </Screen>
  );
}

function AddCountrySheet({
  open,
  onClose,
  presets,
  existingCodes,
  statusOptions,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  presets: Preset[];
  existingCodes: Set<string>;
  statusOptions: StatusOption[];
  onCreated: () => Promise<void>;
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const insets = useSafeAreaInsets();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('');
  const [currencySymbol, setCurrencySymbol] = useState('');
  const [flagEmoji, setFlagEmoji] = useState('');
  const [status, setStatus] = useState<CountryStatus>('beta');
  const [giftCardsEnabled, setGiftCardsEnabled] = useState(false);
  const [saving, setSaving] = useState(false);

  const availablePresets = useMemo(
    () => presets.filter((p) => !existingCodes.has(p.code)),
    [presets, existingCodes],
  );

  function applyPreset(preset: Preset) {
    setCode(preset.code);
    setName(preset.name);
    setCurrency(preset.currency);
    setCurrencySymbol(preset.currencySymbol);
    setFlagEmoji(preset.flagEmoji);
  }

  function resetForm() {
    setCode('');
    setName('');
    setCurrency('');
    setCurrencySymbol('');
    setFlagEmoji('');
    setStatus('beta');
    setGiftCardsEnabled(false);
  }

  async function onSubmit() {
    if (!code.trim() || !name.trim() || !currency.trim()) {
      toast.error('Code, name, and currency are required');
      return;
    }
    setSaving(true);
    try {
      const json = await adminApi.post<{ country?: { name?: string } }>(
        endpoints.admin.countries,
        {
          code,
          name,
          currency,
          currencySymbol,
          flagEmoji,
          status,
          giftCardsEnabled,
          enabledServices: DEFAULT_COUNTRY_SERVICES,
        },
      );
      toast.success(`${json.country?.name || code} added`);
      resetForm();
      await onCreated();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to add country');
    } finally {
      setSaving(false);
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
              <Text style={styles.sheetTitle}>Add country</Text>
              <Text style={styles.sheetSub}>
                Create a market with ISO code, currency, and availability status.
              </Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={8}>
              <Ionicons name="close" size={20} color={colors.foreground} />
            </Pressable>
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 14 }}>
            {availablePresets.length ? (
              <View style={styles.presets}>
                {availablePresets.slice(0, 10).map((p) => (
                  <Pressable
                    key={p.code}
                    onPress={() => applyPreset(p)}
                    style={styles.presetChip}>
                    <Text style={styles.presetText}>
                      {p.flagEmoji} {p.code}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            <View style={styles.formRow}>
              <Field
                label="ISO code"
                value={code}
                onChange={(v) => setCode(v.toUpperCase().slice(0, 2))}
                placeholder="NG"
                autoCapitalize="characters"
              />
              <Field
                label="Currency"
                value={currency}
                onChange={(v) => setCurrency(v.toUpperCase().slice(0, 3))}
                placeholder="NGN"
                autoCapitalize="characters"
              />
            </View>
            <Field
              label="Country name"
              value={name}
              onChange={setName}
              placeholder="Nigeria"
              full
              autoCapitalize="words"
            />
            <View style={styles.formRow}>
              <Field
                label="Symbol"
                value={currencySymbol}
                onChange={setCurrencySymbol}
                placeholder="₦"
                autoCapitalize="none"
              />
              <Field
                label="Flag emoji"
                value={flagEmoji}
                onChange={setFlagEmoji}
                placeholder="🇳🇬"
                autoCapitalize="none"
              />
            </View>

            <Text style={styles.fieldLabel}>Status</Text>
            <View style={styles.statusRow}>
              {statusOptions.map((o) => {
                const on = status === o.value;
                return (
                  <Pressable
                    key={o.value}
                    onPress={() => setStatus(o.value)}
                    style={[styles.statusBtn, on && styles.statusBtnOn]}>
                    <Text style={[styles.statusBtnText, on && styles.statusBtnTextOn]}>
                      {o.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.giftRow}>
              <Text style={styles.giftLabel}>Enable gift cards for this country</Text>
              <Switch
                value={giftCardsEnabled}
                onValueChange={setGiftCardsEnabled}
                trackColor={{ false: colors.border, true: Brand.orangeSoft }}
                thumbColor={Brand.white}
              />
            </View>

            <Button
              title={saving ? 'Adding…' : 'Add country'}
              loading={saving}
              disabled={saving}
              onPress={() => void onSubmit()}
              style={{ marginTop: 12 }}
            />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  full,
  autoCapitalize = 'sentences',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  full?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={[styles.field, full && { width: '100%' }]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        autoCapitalize={autoCapitalize}
        style={styles.input}
      />
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
  addBtn: {
    height: 42,
    paddingHorizontal: 10,
    borderRadius: Radius.md,
    backgroundColor: Brand.orange,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addBtnText: { fontSize: 13, fontWeight: '700', color: Brand.white },
  grid: { gap: 10 },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.muted,
    padding: 10,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardTitle: { flex: 1, fontSize: 14, fontWeight: '800', color: colors.foreground },
  meta: { marginTop: 8, fontSize: 12, color: colors.mutedForeground },
  services: { marginTop: 6, fontSize: 12, color: colors.mutedForeground, lineHeight: 16 },
  statusRow: { flexDirection: 'row', gap: 6, marginTop: 12 },
  statusBtn: {
    flex: 1,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBtnOn: { backgroundColor: Brand.orange, borderColor: Brand.orange },
  statusBtnDisabled: { opacity: 0.55 },
  statusBtnText: { fontSize: 11, fontWeight: '700', color: colors.mutedForeground },
  statusBtnTextOn: { color: Brand.white },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(28,28,30,0.4)' },
  sheet: {
    maxHeight: '92%',
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 12,
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
  sheetHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 12 },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: colors.foreground },
  sheetSub: { marginTop: 2, fontSize: 12, color: colors.mutedForeground, lineHeight: 17 },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  presetChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.muted,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  presetText: { fontSize: 12, fontWeight: '700', color: colors.foreground },
  formRow: { flexDirection: 'row', gap: 10 },
  field: { flex: 1, marginBottom: 12 },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.mutedForeground,
    marginBottom: 6,
  },
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
  giftRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  giftLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.foreground },
});
}

