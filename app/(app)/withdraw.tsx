import { Ionicons } from '@expo/vector-icons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  TransactionPinModal,
  type TransactionPinModalMode,
} from '@/components/app/transaction-pin-modal';
import { Brand, type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';
import { useInvalidateWallet } from '@/hooks/use-invalidate-wallet';
import { alert } from '@/lib/alert';
import { ApiError, api } from '@/lib/api';
import { endpoints } from '@/lib/endpoints';
import { formatNaira } from '@/lib/format';
import type { BankAccountSummary, BankOption } from '@/lib/types';

/** Paystack sometimes returns duplicate bank codes — keep first unique code. */
function dedupeBanks(options: BankOption[]) {
  const seen = new Set<string>();
  const unique: BankOption[] = [];
  for (const bank of options) {
    const code = String(bank.code ?? '').trim();
    if (!code || seen.has(code)) continue;
    seen.add(code);
    unique.push({ ...bank, code });
  }
  return unique;
}

type DestinationMode = 'saved' | 'new';

/**
 * Withdraw bottom sheet — amount + saved bank, or full Paystack bank list
 * → account number → auto/manual account name → withdraw.
 */
export default function WithdrawSheet() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const invalidateWallet = useInvalidateWallet();

  const [step, setStep] = useState<'form' | 'banks'>('form');
  const [amount, setAmount] = useState('');
  const [savedBanks, setSavedBanks] = useState<BankAccountSummary[]>([]);
  const [bankOptions, setBankOptions] = useState<BankOption[]>([]);
  const [mode, setMode] = useState<DestinationMode>('saved');
  const [selectedBankId, setSelectedBankId] = useState<string | null>(null);
  const [bankCode, setBankCode] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [nameManual, setNameManual] = useState(false);
  const [bankQuery, setBankQuery] = useState('');
  const [loadingBanks, setLoadingBanks] = useState(true);
  const [resolving, setResolving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasPin, setHasPin] = useState(false);
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [pinMode, setPinMode] = useState<TransactionPinModalMode>('confirm');
  const [pinError, setPinError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadingBanks(true);
    try {
      const [json, settings] = await Promise.all([
        api.get<{
          banks?: BankAccountSummary[];
          options?: BankOption[];
        }>(endpoints.wallet.banks),
        api
          .get<{ security?: { hasPin?: boolean } }>(endpoints.settings.root)
          .catch(() => null),
      ]);
      const banks = json.banks ?? [];
      const options = dedupeBanks(json.options ?? []);
      setSavedBanks(banks);
      setBankOptions(options);
      setHasPin(Boolean(settings?.security?.hasPin));
      const primary = banks.find((b) => b.isPrimary) ?? banks[0];
      if (primary) {
        setSelectedBankId(primary.id);
        setMode('saved');
      } else {
        setMode('new');
        setSelectedBankId(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load banks');
    } finally {
      setLoadingBanks(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Auto-resolve account name when bank + 10-digit account are set (unless user typed manually).
  useEffect(() => {
    if (mode !== 'new' || step !== 'form' || accountNumber.length < 10 || !bankCode) {
      return;
    }
    if (nameManual) return;

    const timer = setTimeout(async () => {
      setResolving(true);
      setError(null);
      try {
        const json = await api.post<{ accountName?: string }>(endpoints.wallet.banksResolve, {
          bankCode,
          accountNumber,
        });
        if (!nameManual) {
          setAccountName(json.accountName ?? '');
        }
      } catch (e) {
        if (!nameManual) setAccountName('');
        setError(e instanceof Error ? e.message : 'Could not verify account — enter name manually');
      } finally {
        setResolving(false);
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [mode, step, accountNumber, bankCode, nameManual]);

  const selectedBank = bankOptions.find((b) => b.code === bankCode);
  const selectedSaved = savedBanks.find((b) => b.id === selectedBankId);

  const bankList = useMemo(() => {
    const q = bankQuery.trim().toLowerCase();
    const filtered = q
      ? bankOptions.filter(
          (b) => b.name.toLowerCase().includes(q) || b.code.toLowerCase().includes(q),
        )
      : bankOptions;
    return filtered.map((bank, index) => ({
      ...bank,
      key: `${bank.code}__${index}`,
    }));
  }, [bankOptions, bankQuery]);

  const amountNumber = Number(amount.replace(/,/g, ''));
  const amountValid = Number.isFinite(amountNumber) && amountNumber > 0;

  const canWithdraw =
    !submitting &&
    !resolving &&
    amountValid &&
    (mode === 'saved'
      ? Boolean(selectedBankId)
      : accountNumber.length >= 10 && Boolean(bankCode) && Boolean(accountName.trim()));

  function selectSaved(id: string) {
    setMode('saved');
    setSelectedBankId(id);
    setError(null);
  }

  function useNewBank() {
    setMode('new');
    setSelectedBankId(null);
    setError(null);
  }

  function openPinModal() {
    if (!canWithdraw) return;
    setError(null);
    setPinError(null);
    setPinMode(hasPin ? 'confirm' : 'create');
    setPinModalOpen(true);
  }

  async function submitWithdrawWithPin(payload: { pin: string; isCreate: boolean }) {
    if (!canWithdraw && !submitting) return;
    setSubmitting(true);
    setError(null);
    setPinError(null);
    try {
      let bankAccountId = selectedBankId;

      if (mode === 'new') {
        const saved = await api.post<{ bank: BankAccountSummary }>(endpoints.wallet.banks, {
          bankCode,
          bankName: selectedBank?.name,
          accountName: accountName.trim(),
          accountNumber,
          makePrimary: savedBanks.length === 0,
        });
        bankAccountId = saved.bank.id;
        setSavedBanks((prev) => [saved.bank, ...prev.filter((b) => b.id !== saved.bank.id)]);
        setSelectedBankId(saved.bank.id);
        setMode('saved');
      }

      if (!bankAccountId) {
        throw new Error('Select a bank account');
      }

      const json = await api.post<{
        message?: string;
        amountFormatted?: string;
        pending?: boolean;
      }>(endpoints.wallet.withdraw, {
        amount: amountNumber,
        bankAccountId,
        pin: payload.pin,
        ...(payload.isCreate ? { newPin: payload.pin } : {}),
      });

      if (payload.isCreate) setHasPin(true);
      setPinModalOpen(false);
      invalidateWallet();
      alert.success(
        'Withdrawal submitted',
        json.message || `${json.amountFormatted ?? formatNaira(amountNumber)} processing`,
      );
      router.back();
    } catch (e) {
      if (e instanceof ApiError) {
        const body = (e.body ?? {}) as {
          error?: string;
          code?: string;
          hasPin?: boolean;
        };
        const code = typeof body.code === 'string' ? body.code : '';
        if (code.startsWith('pin_') || body.hasPin === false || e.status === 423) {
          if (typeof body.hasPin === 'boolean') setHasPin(body.hasPin);
          setPinError(body.error || e.message || 'PIN verification failed');
          return;
        }
        setPinModalOpen(false);
        setError(body.error || e.message || 'Withdrawal failed');
        return;
      }
      setPinModalOpen(false);
      setError(e instanceof Error ? e.message : 'Withdrawal failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.sheet}>
      {Platform.OS === 'android' ? (
        <View style={styles.handleWrap}>
          <View style={styles.handle} />
        </View>
      ) : (
        <View style={styles.handleSpacer} />
      )}

      <View style={styles.header}>
        <View style={styles.headerCopy}>
          {step === 'banks' ? (
            <Pressable onPress={() => setStep('form')} style={styles.backRow} hitSlop={8}>
              <Ionicons name="chevron-back" size={18} color={Brand.orange} />
              <Text style={styles.backText}>Back</Text>
            </Pressable>
          ) : null}
          <Text style={styles.title}>{step === 'banks' ? 'Select bank' : 'Withdraw'}</Text>
          <Text style={styles.subtitle}>
            {step === 'banks'
              ? 'Choose from Paystack-supported banks'
              : 'Send funds to your local bank account'}
          </Text>
        </View>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.75 }]}
          accessibilityLabel="Close"
          hitSlop={8}>
          <Ionicons name="close" size={18} color={colors.foreground} />
        </Pressable>
      </View>

      {step === 'banks' ? (
        <View style={styles.banksPane}>
          <View style={styles.searchWrap}>
            <Ionicons name="search" size={16} color={colors.mutedForeground} />
            <TextInput
              value={bankQuery}
              onChangeText={setBankQuery}
              placeholder="Search banks"
              placeholderTextColor={colors.mutedForeground}
              style={styles.searchInput}
              autoCorrect={false}
            />
          </View>
          {loadingBanks ? (
            <View style={styles.centered}>
              <ActivityIndicator color={Brand.orange} />
            </View>
          ) : (
            <FlatList
              data={bankList}
              keyExtractor={(item) => item.key}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) + 8 }}
              renderItem={({ item }) => (
                <Pressable
                  style={({ pressed }) => [styles.bankOption, pressed && styles.bankOptionPressed]}
                  onPress={() => {
                    setBankCode(item.code);
                    setAccountName('');
                    setNameManual(false);
                    setBankQuery('');
                    setMode('new');
                    setSelectedBankId(null);
                    setStep('form');
                  }}>
                  <View style={styles.bankOptionLeft}>
                    <View style={styles.bankOptionIcon}>
                      <MaterialIcons name="account-balance" size={16} color={Brand.orange} />
                    </View>
                    <Text style={styles.bankOptionText}>{item.name}</Text>
                  </View>
                  {item.code === bankCode ? (
                    <Ionicons name="checkmark-circle" size={20} color={Brand.orange} />
                  ) : null}
                </Pressable>
              )}
              ListEmptyComponent={
                <Text style={styles.emptyText}>No banks match your search.</Text>
              }
            />
          )}
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(insets.bottom, 16) + 12 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Text style={styles.fieldLabel}>Amount</Text>
          <View style={styles.amountWrap}>
            <Text style={styles.currencyPrefix}>₦</Text>
            <TextInput
              value={amount}
              onChangeText={(v) => setAmount(v.replace(/[^\d.]/g, ''))}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={colors.mutedForeground}
              style={styles.amountInput}
            />
          </View>

          {savedBanks.length > 0 ? (
            <>
              <Text style={styles.fieldLabel}>Saved accounts</Text>
              <View style={styles.savedList}>
                {savedBanks.map((b) => {
                  const active = mode === 'saved' && selectedBankId === b.id;
                  return (
                    <Pressable
                      key={b.id}
                      onPress={() => selectSaved(b.id)}
                      style={[styles.savedCard, active && styles.savedCardActive]}>
                      <View style={styles.savedIcon}>
                        <MaterialIcons name="account-balance" size={18} color={Brand.orange} />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.savedName} numberOfLines={1}>
                          {b.bankName}
                          {b.isPrimary ? ' · Primary' : ''}
                        </Text>
                        <Text style={styles.savedMeta} numberOfLines={1}>
                          {b.accountName} · {b.maskedNumber || b.accountNumber}
                        </Text>
                      </View>
                      {active ? (
                        <Ionicons name="checkmark-circle" size={20} color={Brand.orange} />
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : null}

          <Pressable
            onPress={useNewBank}
            style={[styles.newBankToggle, mode === 'new' && styles.newBankToggleActive]}>
            <Ionicons
              name={mode === 'new' ? 'radio-button-on' : 'radio-button-off'}
              size={18}
              color={mode === 'new' ? Brand.orange : colors.mutedForeground}
            />
            <Text
              style={[
                styles.newBankToggleText,
                mode === 'new' && { color: Brand.orange },
              ]}>
              {savedBanks.length ? 'Use another bank' : 'Add payout bank'}
            </Text>
          </Pressable>

          {mode === 'new' ? (
            <View style={styles.newBankBlock}>
              <Text style={styles.fieldLabel}>Bank</Text>
              <Pressable
                style={styles.select}
                onPress={() => setStep('banks')}
                disabled={loadingBanks}>
                <View style={styles.selectLeft}>
                  <MaterialIcons name="account-balance" size={18} color={Brand.orange} />
                  <Text style={styles.selectText} numberOfLines={1}>
                    {loadingBanks
                      ? 'Loading banks…'
                      : (selectedBank?.name ?? 'Select from Paystack list')}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
              </Pressable>

              <Text style={styles.fieldLabel}>Account number</Text>
              <TextInput
                value={accountNumber}
                onChangeText={(v) => {
                  setAccountNumber(v.replace(/[^\d]/g, '').slice(0, 10));
                  setNameManual(false);
                  setAccountName('');
                  setError(null);
                }}
                keyboardType="number-pad"
                placeholder="10-digit account number"
                placeholderTextColor={colors.mutedForeground}
                style={styles.input}
                maxLength={10}
              />

              <View style={styles.nameLabelRow}>
                <Text style={[styles.fieldLabel, { marginTop: 0 }]}>Account name</Text>
                {resolving ? (
                  <Text style={styles.autoHint}>Verifying…</Text>
                ) : accountName && !nameManual ? (
                  <Text style={styles.autoHint}>Auto-filled</Text>
                ) : (
                  <Text style={styles.autoHint}>Editable</Text>
                )}
              </View>
              <View style={styles.resolveWrap}>
                <TextInput
                  value={accountName}
                  onChangeText={(v) => {
                    setNameManual(true);
                    setAccountName(v);
                    setError(null);
                  }}
                  placeholder={
                    resolving
                      ? 'Looking up with Paystack…'
                      : 'Auto-filled, or type manually'
                  }
                  placeholderTextColor={colors.mutedForeground}
                  style={[styles.input, { paddingRight: 36 }]}
                  autoCapitalize="characters"
                />
                {resolving ? (
                  <ActivityIndicator style={styles.resolveSpinner} color={Brand.orange} size="small" />
                ) : accountName ? (
                  <Ionicons
                    name={nameManual ? 'create-outline' : 'checkmark-circle'}
                    size={18}
                    color={nameManual ? Brand.orange : Brand.success}
                    style={styles.resolveIcon}
                  />
                ) : null}
              </View>
            </View>
          ) : selectedSaved ? (
            <View style={styles.destSummary}>
              <Text style={styles.destLabel}>Paying to</Text>
              <Text style={styles.destValue}>
                {selectedSaved.accountName} · {selectedSaved.bankName}
              </Text>
            </View>
          ) : null}

          <Pressable
            style={[styles.submitBtn, !canWithdraw && { opacity: 0.5 }]}
            disabled={!canWithdraw}
            onPress={openPinModal}>
            {submitting ? (
              <ActivityIndicator color={Brand.white} />
            ) : (
              <Text style={styles.submitText}>
                {amountValid
                  ? `Withdraw ${formatNaira(amountNumber)}`
                  : 'Enter amount to withdraw'}
              </Text>
            )}
          </Pressable>
        </ScrollView>
      )}

      <TransactionPinModal
        visible={pinModalOpen}
        mode={pinMode}
        loading={submitting}
        error={pinError}
        confirmLabel={
          pinMode === 'create' ? 'Set PIN & withdraw' : 'Confirm withdrawal'
        }
        onClose={() => {
          if (!submitting) {
            setPinModalOpen(false);
            setPinError(null);
          }
        }}
        onConfirm={(payload) => void submitWithdrawWithPin(payload)}
      />
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    sheet: {
      flex: 1,
      backgroundColor: colors.card,
    },
    handleWrap: {
      alignItems: 'center',
      paddingTop: 10,
      paddingBottom: 4,
    },
    handle: {
      width: 40,
      height: 5,
      borderRadius: 3,
      backgroundColor: colors.border,
    },
    handleSpacer: { height: 10 },
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 12,
      paddingHorizontal: 12,
      paddingTop: 4,
      paddingBottom: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    headerCopy: { flex: 1, minWidth: 0 },
    backRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      marginBottom: 4,
    },
    backText: { fontSize: 13, fontWeight: '700', color: Brand.orange },
    title: {
      fontSize: 22,
      fontWeight: '800',
      color: colors.foreground,
      letterSpacing: -0.3,
    },
    subtitle: {
      marginTop: 3,
      fontSize: 13,
      fontWeight: '500',
      color: colors.mutedForeground,
    },
    closeBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: colors.muted,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 2,
    },
    scroll: { flex: 1 },
    scrollContent: {
      paddingHorizontal: 12,
      paddingTop: 12,
    },
    errorBox: {
      marginBottom: 10,
      borderRadius: 14,
      backgroundColor: 'rgba(255,59,48,0.08)',
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    errorText: { color: Brand.error, fontSize: 13, fontWeight: '600' },
    fieldLabel: {
      marginTop: 12,
      fontSize: 13,
      fontWeight: '700',
      color: colors.foreground,
    },
    amountWrap: {
      marginTop: 8,
      height: 52,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.muted,
      paddingHorizontal: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    currencyPrefix: {
      fontSize: 20,
      fontWeight: '800',
      color: colors.mutedForeground,
    },
    amountInput: {
      flex: 1,
      fontSize: 22,
      fontWeight: '800',
      color: colors.foreground,
      letterSpacing: -0.3,
    },
    savedList: { marginTop: 8, gap: 8 },
    savedCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.muted,
      paddingHorizontal: 10,
      paddingVertical: 10,
    },
    savedCardActive: {
      borderColor: Brand.orange,
      backgroundColor: Brand.orangeMuted,
    },
    savedIcon: {
      width: 36,
      height: 36,
      borderRadius: 12,
      backgroundColor: colors.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
    savedName: { fontSize: 14, fontWeight: '700', color: colors.foreground },
    savedMeta: { marginTop: 2, fontSize: 12, fontWeight: '500', color: colors.mutedForeground },
    newBankToggle: {
      marginTop: 14,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 8,
    },
    newBankToggleActive: {},
    newBankToggleText: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.mutedForeground,
    },
    newBankBlock: { marginTop: 2 },
    select: {
      marginTop: 8,
      height: 44,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.muted,
      paddingHorizontal: 10,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    selectLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 0 },
    selectText: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.foreground },
    input: {
      marginTop: 8,
      height: 44,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.muted,
      paddingHorizontal: 10,
      fontSize: 15,
      fontWeight: '600',
      color: colors.foreground,
    },
    nameLabelRow: {
      marginTop: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    autoHint: { fontSize: 11, fontWeight: '700', color: colors.mutedForeground },
    resolveWrap: { position: 'relative' },
    resolveSpinner: { position: 'absolute', right: 14, top: 24 },
    resolveIcon: { position: 'absolute', right: 14, top: 25 },
    destSummary: {
      marginTop: 12,
      borderRadius: 14,
      backgroundColor: colors.muted,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    destLabel: { fontSize: 11, fontWeight: '700', color: colors.mutedForeground },
    destValue: {
      marginTop: 2,
      fontSize: 14,
      fontWeight: '700',
      color: colors.foreground,
    },
    submitBtn: {
      marginTop: 16,
      height: 48,
      borderRadius: 16,
      backgroundColor: Brand.orange,
      alignItems: 'center',
      justifyContent: 'center',
    },
    submitText: { color: Brand.white, fontWeight: '800', fontSize: 15 },
    banksPane: { flex: 1, paddingHorizontal: 12, paddingTop: 12 },
    searchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      height: 44,
      borderRadius: 14,
      backgroundColor: colors.muted,
      paddingHorizontal: 12,
      marginBottom: 8,
    },
    searchInput: {
      flex: 1,
      fontSize: 14,
      fontWeight: '600',
      color: colors.foreground,
    },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    bankOption: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 10,
      paddingHorizontal: 4,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    bankOptionPressed: { backgroundColor: colors.orangeMuted, borderRadius: 12 },
    bankOptionLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 0 },
    bankOptionIcon: {
      width: 32,
      height: 32,
      borderRadius: 10,
      backgroundColor: Brand.orangeMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    bankOptionText: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.foreground },
    emptyText: {
      textAlign: 'center',
      color: colors.mutedForeground,
      fontWeight: '600',
      paddingVertical: 10,
    },
  });
}
