import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Pressable,
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
import { SelectSheet } from '@/components/app/picker-sheet';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { Brand, type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';
import { adminApi, ApiError } from '@/lib/admin/api';
import {
  VIRTUAL_NUMBER_SERVICE_OPTIONS,
  type CompanyChargesConfig,
  type CompanyChargeSource,
} from '@/lib/admin/charge-types';
import { endpoints } from '@/lib/endpoints';
import { toast } from '@/lib/toast';

type SourceRow = {
  id: CompanyChargeSource;
  label: string;
  silent: boolean;
};

type FxRateRow = {
  currency: string;
  countryCode: string;
  countryName: string;
  symbol: string;
  midRate: number;
  provider: string;
  buyRate: number | null;
  sellRate: number | null;
  spreadPercent: number | null;
  customerBuy: number;
  customerSell: number;
  profitPerUsdBuy: number;
  profitPerUsdSell: number;
};

type Summary = {
  balances: Array<{
    currency: string;
    available: number;
    lifetimeRecognized: number;
    lifetimeWithdrawn: number;
  }>;
  last30d: { profitNgn: number; count: number };
  bySource: Array<{
    source: string;
    currency: string;
    profit: number;
    profitNgn: number;
    count: number;
  }>;
  recent: Array<{
    id: string;
    source: string;
    status: string;
    currency: string;
    grossIn: number;
    grossOut: number;
    profitAmount: number;
    profitNgn: number;
    chargeAmount: number;
    fxSpreadAmount: number;
    description: string | null;
    createdAt: string;
  }>;
  payouts: Array<{
    id: string;
    currency: string;
    amount: number;
    status: string;
    destinationLabel: string | null;
    createdAt: string;
  }>;
};

type RevenueResponse = {
  ok: true;
  config: CompanyChargesConfig;
  sources: SourceRow[];
  fxRates: FxRateRow[];
  summary: Summary;
};

const MODE_OPTIONS = [
  { id: 'flat', title: 'Flat ₦' },
  { id: 'percent', title: 'Percent %' },
];

const CURRENCY_OPTIONS = [
  { id: 'NGN', title: 'NGN' },
  { id: 'USD', title: 'USD' },
];

function money(n: number, currency = 'NGN') {
  try {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${currency} ${n.toFixed(2)}`;
  }
}

export default function AdminRevenueScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [data, setData] = useState<RevenueResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<CompanyChargesConfig | null>(null);
  const [saving, setSaving] = useState(false);

  const [serviceToAdd, setServiceToAdd] = useState(
    VIRTUAL_NUMBER_SERVICE_OPTIONS[0]?.slug || 'whatsapp',
  );
  const [customServiceSlug, setCustomServiceSlug] = useState('');
  const [vnMode, setVnMode] = useState<'flat' | 'percent'>('percent');
  const [vnValue, setVnValue] = useState('10');
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [editMode, setEditMode] = useState<'flat' | 'percent'>('percent');
  const [editValue, setEditValue] = useState('');
  const [editEnabled, setEditEnabled] = useState(true);

  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutCurrency, setPayoutCurrency] = useState('NGN');
  const [payoutLabel, setPayoutLabel] = useState('ORYNO business account');
  const [bankName, setBankName] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [bankCode, setBankCode] = useState('');
  const [payoutNotes, setPayoutNotes] = useState('');
  const [sendViaGateway, setSendViaGateway] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const json = await adminApi.get<RevenueResponse>(endpoints.admin.revenue);
      setData(json);
      setDraft({
        ...json.config,
        virtualNumberByService: json.config.virtualNumberByService ?? {},
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load revenue');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const ngnBalance = data?.summary.balances.find((b) => b.currency === 'NGN');
  const usdBalance = data?.summary.balances.find((b) => b.currency === 'USD');

  const sourceLabels = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of data?.sources ?? []) map.set(row.id, row.label);
    return map;
  }, [data?.sources]);

  const availableVnServices = useMemo(() => {
    if (!draft) return VIRTUAL_NUMBER_SERVICE_OPTIONS;
    return VIRTUAL_NUMBER_SERVICE_OPTIONS.filter(
      (c) => !draft.virtualNumberByService?.[c.slug],
    );
  }, [draft]);

  const vnSelectValue = useMemo(() => {
    if (availableVnServices.some((c) => c.slug === serviceToAdd)) {
      return serviceToAdd;
    }
    return availableVnServices[0]?.slug || '';
  }, [availableVnServices, serviceToAdd]);

  async function saveCharges(nextConfig?: CompanyChargesConfig) {
    const config = nextConfig ?? draft;
    if (!config) return;
    setSaving(true);
    try {
      const payload: CompanyChargesConfig = {
        ...config,
        virtualNumberByService: config.virtualNumberByService ?? {},
      };
      const json = await adminApi.patch<{
        config?: CompanyChargesConfig;
        error?: string;
      }>(endpoints.admin.revenue, { action: 'save_charges', config: payload });
      if (json.config) {
        setDraft(json.config);
      } else {
        setDraft(payload);
      }
      toast.success('Company charges and conversion rates saved');
      await load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function persistVnConfig(
    next: CompanyChargesConfig,
    successMessage: string,
  ) {
    setDraft(next);
    setSaving(true);
    try {
      const payload: CompanyChargesConfig = {
        ...next,
        virtualNumberByService: next.virtualNumberByService ?? {},
      };
      const json = await adminApi.patch<{
        config?: CompanyChargesConfig;
      }>(endpoints.admin.revenue, { action: 'save_charges', config: payload });
      const saved = json.config ?? payload;
      setDraft(saved);
      if (data) setData({ ...data, config: saved });
      toast.success(successMessage);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Save failed');
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function submitPayout() {
    setSaving(true);
    try {
      await adminApi.patch(endpoints.admin.revenue, {
        action: 'payout',
        payout: {
          currency: payoutCurrency,
          amount: Number(payoutAmount),
          destinationLabel: payoutLabel,
          bankName,
          accountName,
          accountNumber,
          bankCode,
          notes: payoutNotes,
          sendViaGateway,
        },
      });
      toast.success(
        sendViaGateway
          ? 'Profit payout sent via Flutterwave'
          : 'Profit withdrawal recorded on the company ledger',
      );
      setPayoutAmount('');
      await load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Payout failed');
    } finally {
      setSaving(false);
    }
  }

  function setService(
    id: CompanyChargeSource,
    patch: Partial<CompanyChargesConfig['services'][CompanyChargeSource]>,
  ) {
    if (!draft) return;
    setDraft({
      ...draft,
      services: {
        ...draft.services,
        [id]: { ...draft.services[id], ...patch },
      },
      withdrawFeeNgn:
        id === 'withdraw' && patch.value != null
          ? Number(patch.value)
          : draft.withdrawFeeNgn,
      virtualNumberByService: draft.virtualNumberByService ?? {},
    });
  }

  function setVnService(
    slug: string,
    patch: Partial<
      NonNullable<CompanyChargesConfig['virtualNumberByService']>[string]
    >,
  ): CompanyChargesConfig | null {
    if (!draft) return null;
    const key = slug.trim().toLowerCase();
    if (!key) return null;
    const current = draft.virtualNumberByService?.[key] ?? {
      mode: 'percent' as const,
      value: 0,
      enabled: true,
      label: key,
    };
    return {
      ...draft,
      virtualNumberByService: {
        ...(draft.virtualNumberByService ?? {}),
        [key]: { ...current, ...patch },
      },
    };
  }

  async function addVnService(preferredSlug?: string) {
    if (!draft) return;
    const custom = customServiceSlug
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '');
    const slug = custom || preferredSlug || serviceToAdd;
    if (!slug) {
      toast.error('Select a social media / app');
      return;
    }
    if (draft.virtualNumberByService?.[slug]) {
      toast.error('That app is already added — use Edit instead');
      return;
    }
    const value = Number(vnValue);
    if (!Number.isFinite(value) || value < 0) {
      toast.error('Enter a valid revenue amount');
      return;
    }
    if (vnMode === 'percent' && value > 100) {
      toast.error('Percent cannot be over 100');
      return;
    }
    const known = VIRTUAL_NUMBER_SERVICE_OPTIONS.find((c) => c.slug === slug);
    const next: CompanyChargesConfig = {
      ...draft,
      virtualNumberByService: {
        ...(draft.virtualNumberByService ?? {}),
        [slug]: {
          mode: vnMode,
          value,
          enabled: true,
          label: known?.label || slug,
        },
      },
    };
    const nextAvailable = VIRTUAL_NUMBER_SERVICE_OPTIONS.find(
      (c) => c.slug !== slug && !next.virtualNumberByService?.[c.slug],
    );
    if (nextAvailable) setServiceToAdd(nextAvailable.slug);
    setCustomServiceSlug('');
    setVnValue('10');
    setVnMode('percent');
    await persistVnConfig(next, `Saved ${known?.label || slug}`);
  }

  function startEditVn(slug: string) {
    if (!draft) return;
    const row = draft.virtualNumberByService?.[slug];
    if (!row) return;
    setEditingSlug(slug);
    setEditMode(row.mode);
    setEditValue(String(row.value));
    setEditEnabled(row.enabled);
  }

  function cancelEditVn() {
    setEditingSlug(null);
    setEditValue('');
  }

  async function saveEditVn() {
    if (!draft || !editingSlug) return;
    const value = Number(editValue);
    if (!Number.isFinite(value) || value < 0) {
      toast.error('Enter a valid revenue amount');
      return;
    }
    if (editMode === 'percent' && value > 100) {
      toast.error('Percent cannot be over 100');
      return;
    }
    const next = setVnService(editingSlug, {
      mode: editMode,
      value,
      enabled: editEnabled,
    });
    if (!next) return;
    cancelEditVn();
    await persistVnConfig(next, 'App revenue updated');
  }

  async function removeVnService(slug: string) {
    if (!draft) return;
    if (editingSlug === slug) cancelEditVn();
    const nextMap = { ...(draft.virtualNumberByService ?? {}) };
    delete nextMap[slug];
    await persistVnConfig(
      { ...draft, virtualNumberByService: nextMap },
      'App removed',
    );
  }

  function setFxCurrency(
    currency: string,
    patch: Partial<CompanyChargesConfig['fx']['currencies'][string]>,
  ) {
    if (!draft) return;
    const current = draft.fx.currencies[currency] ?? {
      buyRate: null,
      sellRate: null,
      spreadPercent: null,
    };
    setDraft({
      ...draft,
      fx: {
        ...draft.fx,
        currencies: {
          ...draft.fx.currencies,
          [currency]: { ...current, ...patch },
        },
      },
    });
  }

  const vnEntries = Object.entries(draft?.virtualNumberByService ?? {}).sort(
    ([a], [b]) => a.localeCompare(b),
  );

  return (
    <Screen
      scroll
      refreshing={loading || saving}
      onRefresh={load}
      header={
        <AdminPageHeader
          title="Revenue"
          subtitle="Company charges, conversion rates, and profit held separately from customer wallets"
        />
      }>
      {loading && !data ? <AdminLoading variant="stats" /> : null}
      {error ? <AdminError message={error} onRetry={load} /> : null}

      {data && draft ? (
        <>
          <View style={styles.stats}>
            <StatCard
              label="Company NGN available"
              value={money(ngnBalance?.available ?? 0, 'NGN')}
              change="Recognized profit not yet withdrawn"
              up
            />
            <StatCard
              label="Company USD available"
              value={money(usdBalance?.available ?? 0, 'USD')}
              change="USD-wallet service margin"
              up
            />
            <StatCard
              label="Profit last 30 days"
              value={money(data.summary.last30d.profitNgn, 'NGN')}
              change={`${data.summary.last30d.count} settled trades`}
              up
            />
            <StatCard
              label="Lifetime NGN recognized"
              value={money(ngnBalance?.lifetimeRecognized ?? 0, 'NGN')}
              change={`${money(ngnBalance?.lifetimeWithdrawn ?? 0, 'NGN')} withdrawn`}
            />
          </View>

          <AdminCard title="Company charges">
            <Text style={styles.sectionHint}>
              These amounts are added to the customer total with no “service
              charge” label, except withdrawals, which always show the ₦ fee.
              Flat charges are in Naira and converted for other countries.
            </Text>
            {data.sources
              .filter((source) => source.id !== 'virtual_number')
              .map((source) => {
                const charge = draft.services[source.id];
                const isWithdraw = source.id === 'withdraw';
                return (
                  <View key={source.id} style={styles.chargeRow}>
                    <Text style={styles.rowTitle}>{source.label}</Text>
                    <Text style={styles.rowSub}>
                      {source.silent
                        ? 'Silent — baked into the price the customer sees'
                        : 'Shown on the withdrawal screen'}
                    </Text>

                    <SelectSheet
                      label="Mode"
                      title="Charge mode"
                      value={isWithdraw ? 'flat' : charge.mode}
                      onChange={(v) => {
                        if (isWithdraw) return;
                        setService(source.id, {
                          mode: v as 'flat' | 'percent',
                        });
                      }}
                      disabled={isWithdraw}
                      fullScreen={false}
                      options={MODE_OPTIONS}
                    />

                    <Field
                      label="Value"
                      value={
                        isWithdraw
                          ? String(draft.withdrawFeeNgn)
                          : String(charge.value)
                      }
                      onChange={(raw) => {
                        const value = Number(raw);
                        if (isWithdraw) {
                          setDraft({
                            ...draft,
                            withdrawFeeNgn: value,
                            services: {
                              ...draft.services,
                              withdraw: {
                                ...draft.services.withdraw,
                                value,
                              },
                            },
                            virtualNumberByService:
                              draft.virtualNumberByService ?? {},
                          });
                          return;
                        }
                        setService(source.id, { value });
                      }}
                      keyboardType="decimal-pad"
                    />

                    <PrefRow
                      label="Enabled"
                      description={
                        charge.enabled ? 'Charge is active' : 'Charge is off'
                      }
                      control={
                        <Switch
                          value={charge.enabled}
                          onValueChange={(v) =>
                            setService(source.id, { enabled: v })
                          }
                          trackColor={{
                            false: colors.border,
                            true: Brand.orangeSoft,
                          }}
                          thumbColor={Brand.white}
                        />
                      }
                    />
                  </View>
                );
              })}
          </AdminCard>

          <AdminCard title="Virtual number revenue">
            <Text style={styles.sectionHint}>
              Choose a social media / app the numbers support, set the revenue
              (percent or flat ₦), then add it. Changes save immediately and
              apply for that app in every country.
            </Text>

            <View style={styles.addBox}>
              <Text style={styles.addTitle}>Add social media</Text>
              <SelectSheet
                label="Social media / app"
                title="Select app"
                value={vnSelectValue || 'none'}
                onChange={(v) => {
                  if (v !== 'none') setServiceToAdd(v);
                }}
                disabled={availableVnServices.length === 0}
                fullScreen={false}
                options={
                  availableVnServices.length === 0
                    ? [{ id: 'none', title: 'All listed added' }]
                    : availableVnServices.map((c) => ({
                        id: c.slug,
                        title: c.label,
                      }))
                }
              />
              <Field
                label="Custom slug (optional)"
                value={customServiceSlug}
                onChange={setCustomServiceSlug}
                placeholder="e.g. signal"
                autoCapitalize="none"
              />
              <SelectSheet
                label="Type"
                title="Revenue type"
                value={vnMode}
                onChange={(v) => setVnMode(v as 'flat' | 'percent')}
                fullScreen={false}
                options={MODE_OPTIONS}
              />
              <Field
                label="Revenue"
                value={vnValue}
                onChange={setVnValue}
                keyboardType="decimal-pad"
                placeholder={vnMode === 'percent' ? 'e.g. 15' : 'e.g. 50'}
              />
              <Button
                title={saving ? 'Saving…' : 'Add app'}
                loading={saving}
                disabled={saving}
                onPress={() => void addVnService(vnSelectValue)}
                style={{ marginTop: 8 }}
              />
            </View>

            {vnEntries.length === 0 ? (
              <AdminEmpty message="No apps yet. Add WhatsApp, Telegram, or another supported service above to charge revenue on those numbers." />
            ) : (
              vnEntries.map(([slug, row]) => {
                const isEditing = editingSlug === slug;
                return (
                  <View key={slug} style={styles.vnRow}>
                    <Text style={styles.rowTitle}>{row.label || slug}</Text>
                    <Text style={styles.rowSub}>
                      {slug} · all countries
                    </Text>

                    {isEditing ? (
                      <>
                        <SelectSheet
                          label="Type"
                          title="Revenue type"
                          value={editMode}
                          onChange={(v) =>
                            setEditMode(v as 'flat' | 'percent')
                          }
                          fullScreen={false}
                          options={MODE_OPTIONS}
                        />
                        <Field
                          label="Revenue"
                          value={editValue}
                          onChange={setEditValue}
                          keyboardType="decimal-pad"
                        />
                        <PrefRow
                          label="Enabled"
                          description={editEnabled ? 'On' : 'Off'}
                          control={
                            <Switch
                              value={editEnabled}
                              onValueChange={setEditEnabled}
                              trackColor={{
                                false: colors.border,
                                true: Brand.orangeSoft,
                              }}
                              thumbColor={Brand.white}
                            />
                          }
                        />
                        <View style={styles.actionRow}>
                          <Button
                            title="Save"
                            loading={saving}
                            disabled={saving}
                            onPress={() => void saveEditVn()}
                            style={styles.actionFlex}
                          />
                          <Button
                            title="Cancel"
                            variant="secondary"
                            onPress={cancelEditVn}
                            style={styles.actionFlex}
                          />
                        </View>
                      </>
                    ) : (
                      <>
                        <View style={styles.metaRow}>
                          <Text style={styles.metaText}>
                            {row.mode === 'percent' ? 'Percent' : 'Flat ₦'} ·{' '}
                            {row.mode === 'percent'
                              ? `${row.value}%`
                              : `₦${row.value}`}
                          </Text>
                          <StatusBadge
                            status={row.enabled ? 'Active' : 'Off'}
                          />
                        </View>
                        <View style={styles.actionRow}>
                          <Pressable
                            onPress={() => startEditVn(slug)}
                            style={styles.linkBtn}>
                            <Text style={styles.linkBtnText}>Edit</Text>
                          </Pressable>
                          <Pressable
                            disabled={saving}
                            onPress={() => void removeVnService(slug)}
                            style={styles.linkBtn}>
                            <Text
                              style={[
                                styles.linkBtnText,
                                { color: Brand.error },
                              ]}>
                              Remove
                            </Text>
                          </Pressable>
                        </View>
                      </>
                    )}
                  </View>
                );
              })
            )}
          </AdminCard>

          <AdminCard title="Conversion rates by country">
            <Text style={styles.sectionHint}>
              Live mid-market is what $1 is actually worth. Customer buy is what
              users pay per $1. The difference is ORYNO conversion profit. Leave
              buy/sell empty to use the default spread.
            </Text>

            <Field
              label="Default spread %"
              value={String(draft.fx.defaultSpreadPercent)}
              onChange={(v) =>
                setDraft({
                  ...draft,
                  fx: {
                    ...draft.fx,
                    defaultSpreadPercent: Number(v),
                  },
                })
              }
              keyboardType="decimal-pad"
            />

            {data.fxRates.map((row) => {
              const override = draft.fx.currencies[row.currency] ?? {
                buyRate: null,
                sellRate: null,
                spreadPercent: null,
              };
              return (
                <View key={row.currency} style={styles.fxRow}>
                  <Text style={styles.rowTitle}>
                    {row.countryName} · {row.currency}
                  </Text>
                  <Text style={styles.rowSub}>
                    {row.symbol} · {row.provider} · mid{' '}
                    {row.midRate ? row.midRate.toFixed(4) : '—'}
                  </Text>
                  <Field
                    label="Customer buy"
                    value={
                      override.buyRate != null ? String(override.buyRate) : ''
                    }
                    onChange={(v) =>
                      setFxCurrency(row.currency, {
                        buyRate: v ? Number(v) : null,
                      })
                    }
                    keyboardType="decimal-pad"
                    placeholder={row.customerBuy.toFixed(2)}
                  />
                  <Field
                    label="Customer sell"
                    value={
                      override.sellRate != null ? String(override.sellRate) : ''
                    }
                    onChange={(v) =>
                      setFxCurrency(row.currency, {
                        sellRate: v ? Number(v) : null,
                      })
                    }
                    keyboardType="decimal-pad"
                    placeholder={row.customerSell.toFixed(2)}
                  />
                  <Field
                    label="Spread %"
                    value={
                      override.spreadPercent != null
                        ? String(override.spreadPercent)
                        : ''
                    }
                    onChange={(v) =>
                      setFxCurrency(row.currency, {
                        spreadPercent: v ? Number(v) : null,
                      })
                    }
                    keyboardType="decimal-pad"
                    placeholder={String(draft.fx.defaultSpreadPercent)}
                  />
                  <Text style={styles.profitLine}>
                    Profit / $1 buy: {money(row.profitPerUsdBuy, row.currency)}
                  </Text>
                </View>
              );
            })}

            <Button
              title={saving ? 'Saving…' : 'Save charges & rates'}
              loading={saving}
              disabled={saving}
              onPress={() => void saveCharges()}
              style={{ marginTop: 12 }}
            />
          </AdminCard>

          <AdminCard title="Profit by service">
            {data.summary.bySource.length === 0 ? (
              <AdminEmpty message="No recognized company profit yet." />
            ) : (
              data.summary.bySource.map((row, i) => (
                <View
                  key={`${row.source}-${row.currency}-${i}`}
                  style={styles.listRow}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.rowTitle}>
                      {sourceLabels.get(row.source) || row.source}
                    </Text>
                    <Text style={styles.rowSub}>
                      {row.count} trades · {row.currency}
                    </Text>
                  </View>
                  <Text style={styles.amount}>
                    {money(row.profit, row.currency)}
                  </Text>
                </View>
              ))
            )}
          </AdminCard>

          <AdminCard title="Withdraw company profit">
            <Text style={styles.sectionHint}>
              This deducts the company ledger only. Cash still sits in
              Flutterwave / provider wallets until you move it. Record a
              withdrawal after you take funds from those dashboards, or send via
              Flutterwave to the business bank.
            </Text>

            <SelectSheet
              label="Currency"
              title="Payout currency"
              value={payoutCurrency}
              onChange={setPayoutCurrency}
              fullScreen={false}
              options={CURRENCY_OPTIONS}
            />
            <Field
              label="Amount"
              value={payoutAmount}
              onChange={setPayoutAmount}
              keyboardType="decimal-pad"
            />
            <Field
              label="Destination"
              value={payoutLabel}
              onChange={setPayoutLabel}
            />
            <Field label="Bank" value={bankName} onChange={setBankName} />
            <Field label="Bank code" value={bankCode} onChange={setBankCode} />
            <Field
              label="Account name"
              value={accountName}
              onChange={setAccountName}
            />
            <Field
              label="Account number"
              value={accountNumber}
              onChange={setAccountNumber}
              keyboardType="number-pad"
            />
            <Field label="Notes" value={payoutNotes} onChange={setPayoutNotes} />

            <PrefRow
              label="Send via Flutterwave"
              description="Uses the same merchant balance as customer payouts"
              control={
                <Switch
                  value={sendViaGateway}
                  onValueChange={setSendViaGateway}
                  trackColor={{ false: colors.border, true: Brand.orangeSoft }}
                  thumbColor={Brand.white}
                />
              }
            />

            <Button
              title={
                sendViaGateway
                  ? 'Send profit payout'
                  : 'Record profit withdrawal'
              }
              loading={saving}
              disabled={saving || !Number(payoutAmount)}
              onPress={() => void submitPayout()}
              style={{ marginTop: 12 }}
            />

            {data.summary.payouts.length > 0 ? (
              <View style={{ marginTop: 8 }}>
                {data.summary.payouts.map((row) => (
                  <View key={row.id} style={styles.listRow}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.rowTitle}>
                        {money(row.amount, row.currency)}
                      </Text>
                      <Text style={styles.rowSub}>
                        {row.destinationLabel || '—'}
                      </Text>
                    </View>
                    <StatusBadge status={row.status} />
                  </View>
                ))}
              </View>
            ) : null}
          </AdminCard>

          <AdminCard title="Recent company profit entries">
            {data.summary.recent.length === 0 ? (
              <AdminEmpty message="Profit entries appear here after a conversion, gift-card, number, boost, email, or withdrawal completes." />
            ) : (
              data.summary.recent.map((row) => (
                <View key={row.id} style={styles.listRow}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.rowTitle}>
                      {sourceLabels.get(row.source) || row.source}
                    </Text>
                    {row.description ? (
                      <Text style={styles.rowSub} numberOfLines={2}>
                        {row.description}
                      </Text>
                    ) : null}
                    <Text style={styles.metaText}>
                      {money(row.grossIn, row.currency)} →{' '}
                      {money(row.grossOut, row.currency)}
                    </Text>
                    <Text style={styles.amount}>
                      {money(row.profitAmount, row.currency)}
                    </Text>
                  </View>
                  <StatusBadge status={row.status} />
                </View>
              ))
            )}
          </AdminCard>
        </>
      ) : null}
    </Screen>
  );
}

function PrefRow({
  label,
  description,
  control,
}: {
  label: string;
  description: string;
  control: ReactNode;
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.prefRow}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.prefLabel}>{label}</Text>
        <Text style={styles.prefDesc}>{description}</Text>
      </View>
      {control}
    </View>
  );
}

function Field({
  label,
  value,
  onChange,
  keyboardType,
  autoCapitalize,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  keyboardType?: 'default' | 'decimal-pad' | 'number-pad';
  autoCapitalize?: 'none' | 'sentences';
  placeholder?: string;
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        style={styles.fieldInput}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
      />
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    stats: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      marginBottom: 4,
    },
    sectionHint: {
      marginBottom: 10,
      fontSize: 13,
      lineHeight: 18,
      color: colors.mutedForeground,
    },
    chargeRow: {
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      gap: 8,
    },
    rowTitle: { fontSize: 14, fontWeight: '700', color: colors.foreground },
    rowSub: {
      marginTop: 2,
      marginBottom: 4,
      fontSize: 12,
      color: colors.mutedForeground,
      lineHeight: 16,
    },
    addBox: {
      marginTop: 4,
      marginBottom: 8,
      borderRadius: 16,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: colors.border,
      backgroundColor: colors.muted,
      padding: 12,
      gap: 8,
    },
    addTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.foreground,
      marginBottom: 4,
    },
    vnRow: {
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      gap: 8,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    metaText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.mutedForeground,
    },
    actionRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
    actionFlex: { flex: 1 },
    linkBtn: {
      paddingVertical: 8,
      paddingHorizontal: 4,
    },
    linkBtnText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.foreground,
    },
    fxRow: {
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      gap: 8,
    },
    profitLine: {
      marginTop: 4,
      fontSize: 13,
      fontWeight: '700',
      color: colors.foreground,
    },
    listRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      paddingVertical: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    amount: {
      marginTop: 4,
      fontSize: 14,
      fontWeight: '800',
      color: Brand.orange,
    },
    prefRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 10,
      paddingVertical: 10,
      marginTop: 4,
      backgroundColor: colors.card,
    },
    prefLabel: { fontSize: 14, fontWeight: '700', color: colors.foreground },
    prefDesc: {
      marginTop: 2,
      fontSize: 12,
      color: colors.mutedForeground,
      lineHeight: 16,
    },
    field: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 10,
      paddingVertical: 12,
      backgroundColor: colors.card,
      marginTop: 4,
    },
    fieldLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.mutedForeground,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    fieldInput: {
      marginTop: 6,
      fontSize: 14,
      fontWeight: '700',
      color: colors.foreground,
      paddingVertical: 2,
    },
  });
}
