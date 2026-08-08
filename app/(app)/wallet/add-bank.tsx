import { Ionicons } from '@expo/vector-icons';
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

import { Brand, type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';
import { useInvalidateWallet } from '@/hooks/use-invalidate-wallet';
import { api } from '@/lib/api';
import { endpoints } from '@/lib/endpoints';
import type { BankOption } from '@/lib/types';

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

/**
 * Add bank form sheet — same presentation pattern as notifications.
 */
export default function AddBankSheet() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const invalidateWallet = useInvalidateWallet();
  const [step, setStep] = useState<'form' | 'banks'>('form');
  const [bankOptions, setBankOptions] = useState<BankOption[]>([]);
  const [bankCode, setBankCode] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [loadingBanks, setLoadingBanks] = useState(true);
  const [resolving, setResolving] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bankQuery, setBankQuery] = useState('');

  const loadBanks = useCallback(async () => {
    setLoadingBanks(true);
    try {
      const json = await api.get<{ options?: BankOption[] }>(endpoints.wallet.banks);
      const options = dedupeBanks(json.options ?? []);
      setBankOptions(options);
      setBankCode((prev) => {
        if (prev && options.some((b) => b.code === prev)) return prev;
        return options[0]?.code || '';
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load banks');
    } finally {
      setLoadingBanks(false);
    }
  }, []);

  useEffect(() => {
    void loadBanks();
  }, [loadBanks]);

  useEffect(() => {
    if (step !== 'form' || accountNumber.length < 10 || !bankCode) return;
    const timer = setTimeout(async () => {
      setResolving(true);
      setError(null);
      try {
        const json = await api.post<{ accountName?: string }>(endpoints.wallet.banksResolve, {
          bankCode,
          accountNumber,
        });
        setAccountName(json.accountName ?? '');
      } catch (e) {
        setAccountName('');
        setError(e instanceof Error ? e.message : 'Could not verify account');
      } finally {
        setResolving(false);
      }
    }, 450);
    return () => clearTimeout(timer);
  }, [step, accountNumber, bankCode]);

  const selectedBank = bankOptions.find((b) => b.code === bankCode);

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

  const canSave =
    !saving && !resolving && accountNumber.length >= 10 && Boolean(accountName) && Boolean(bankCode);

  async function onSave() {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      await api.post(endpoints.wallet.banks, {
        bankCode,
        bankName: selectedBank?.name,
        accountName,
        accountNumber,
      });
      invalidateWallet();
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save bank');
    } finally {
      setSaving(false);
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
            <Pressable
              onPress={() => setStep('form')}
              style={styles.backRow}
              hitSlop={8}>
              <Ionicons name="chevron-back" size={18} color={Brand.orange} />
              <Text style={styles.backText}>Back</Text>
            </Pressable>
          ) : null}
          <Text style={styles.title}>{step === 'banks' ? 'Select bank' : 'Add bank'}</Text>
          <Text style={styles.subtitle}>
            {step === 'banks'
              ? 'Choose a Paystack-supported bank'
              : 'Verify a payout account for withdrawals'}
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
                    setBankQuery('');
                    setStep('form');
                  }}>
                  <Text style={styles.bankOptionText}>{item.name}</Text>
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

          <Text style={styles.fieldLabel}>Bank</Text>
          <Pressable
            style={styles.select}
            onPress={() => setStep('banks')}
            disabled={loadingBanks}>
            <Text style={styles.selectText} numberOfLines={1}>
              {loadingBanks ? 'Loading banks…' : (selectedBank?.name ?? 'Select bank')}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
          </Pressable>

          <Text style={styles.fieldLabel}>Account number</Text>
          <TextInput
            value={accountNumber}
            onChangeText={(v) => {
              setAccountNumber(v.replace(/[^\d]/g, '').slice(0, 10));
              setAccountName('');
              setError(null);
            }}
            keyboardType="number-pad"
            placeholder="10-digit account number"
            placeholderTextColor={colors.mutedForeground}
            style={styles.input}
            maxLength={10}
          />

          <Text style={styles.fieldLabel}>Account name</Text>
          <View style={styles.resolveWrap}>
            <TextInput
              value={accountName}
              editable={false}
              placeholder={
                resolving ? 'Verifying with Paystack…' : 'Resolved after account number'
              }
              placeholderTextColor={colors.mutedForeground}
              style={[styles.input, { paddingRight: 40 }]}
            />
            {resolving ? (
              <ActivityIndicator style={styles.resolveSpinner} color={Brand.orange} size="small" />
            ) : accountName ? (
              <Ionicons
                name="checkmark-circle"
                size={18}
                color={Brand.success}
                style={styles.resolveIcon}
              />
            ) : null}
          </View>

          <Pressable
            style={[styles.saveBtn, !canSave && { opacity: 0.5 }]}
            disabled={!canSave}
            onPress={() => void onSave()}>
            {saving ? (
              <ActivityIndicator color={Brand.white} />
            ) : (
              <Text style={styles.saveText}>Verify & save bank</Text>
            )}
          </Pressable>

          <View style={styles.hintCard}>
            <Ionicons name="shield-checkmark-outline" size={18} color={Brand.orange} />
            <Text style={styles.hintText}>
              We verify the account name with Paystack before saving. Only use an account that
              matches your records.
            </Text>
          </View>
        </ScrollView>
      )}
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
      paddingHorizontal: 20,
      paddingTop: 4,
      paddingBottom: 14,
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
      paddingHorizontal: 20,
      paddingTop: 16,
    },
    errorBox: {
      marginBottom: 12,
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
    select: {
      marginTop: 8,
      height: 52,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.muted,
      paddingHorizontal: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    selectText: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.foreground },
    input: {
      marginTop: 8,
      height: 52,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.muted,
      paddingHorizontal: 14,
      fontSize: 15,
      fontWeight: '600',
      color: colors.foreground,
    },
    resolveWrap: { position: 'relative' },
    resolveSpinner: { position: 'absolute', right: 14, top: 24 },
    resolveIcon: { position: 'absolute', right: 14, top: 25 },
    saveBtn: {
      marginTop: 20,
      height: 52,
      borderRadius: 16,
      backgroundColor: Brand.orange,
      alignItems: 'center',
      justifyContent: 'center',
    },
    saveText: { color: Brand.white, fontWeight: '800', fontSize: 15 },
    hintCard: {
      marginTop: 16,
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      borderRadius: 16,
      backgroundColor: colors.orangeMuted,
      padding: 14,
    },
    hintText: {
      flex: 1,
      fontSize: 12,
      lineHeight: 18,
      color: colors.foreground,
      fontWeight: '500',
    },
    banksPane: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },
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
      paddingVertical: 14,
      paddingHorizontal: 4,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    bankOptionPressed: { backgroundColor: colors.orangeMuted, borderRadius: 12 },
    bankOptionText: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.foreground },
    emptyText: {
      textAlign: 'center',
      color: colors.mutedForeground,
      fontWeight: '600',
      paddingVertical: 28,
    },
  });
}
