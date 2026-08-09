import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { PageHeader } from '@/components/app/page-header';
import { PickerSheet } from '@/components/app/picker-sheet';
import { ServiceInstructions } from '@/components/app/service-instructions';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { Brand, Radius, type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';
import { useInvalidateWallet } from '@/hooks/use-invalidate-wallet';
import { useProfile } from '@/hooks/use-profile';
import { api } from '@/lib/api';
import { endpoints } from '@/lib/endpoints';
import { formatCountryMoney } from '@/lib/format';

type Domain = {
  name: string;
  costUsd: number;
  costLocal: number;
  currency: string;
  count: number;
};

const SITES = [
  { id: 'telegram.com', label: 'Telegram' },
  { id: 'google.com', label: 'Google' },
  { id: 'instagram.com', label: 'Instagram' },
  { id: 'facebook.com', label: 'Facebook' },
  { id: 'discord.com', label: 'Discord' },
  { id: 'openai.com', label: 'OpenAI' },
  { id: 'other', label: 'Other site' },
] as const;

export default function EmailsScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { countryCode } = useProfile();
  const invalidateWallet = useInvalidateWallet();
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [domain, setDomain] = useState('');
  const [domainOpen, setDomainOpen] = useState(false);
  const [domainQuery, setDomainQuery] = useState('');
  const [site, setSite] = useState('telegram.com');
  const [customSite, setCustomSite] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [success, setSuccess] = useState(false);
  const [email, setEmail] = useState('');
  const [emailId, setEmailId] = useState('');
  const [code, setCode] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);
  const [receipt, setReceipt] = useState('');

  const selected = domains.find((d) => d.name === domain);
  const siteValue = site === 'other' ? customSite.trim() : site;
  const money = (n: number) => formatCountryMoney(n, countryCode);

  const filteredDomains = useMemo(() => {
    const q = domainQuery.trim().toLowerCase().replace(/^@/, '');
    if (!q) return domains;
    return domains.filter((d) => d.name.toLowerCase().includes(q));
  }, [domains, domainQuery]);

  const canSubmit = Boolean(domain && siteValue && selected && !submitting);

  useEffect(() => {
    let cancelled = false;
    const siteForDomains = siteValue.trim().toLowerCase();

    if (!siteForDomains) {
      setDomains([]);
      setDomain('');
      setLoading(false);
      return;
    }

    const timer = setTimeout(
      async () => {
        setLoading(true);
        setDomains([]);
        setDomain('');
        setDomainOpen(false);
        setDomainQuery('');
        setError(null);
        try {
          const data = await api.get<{ domains?: Domain[] }>(
            `${endpoints.services.emailsDomains}?site=${encodeURIComponent(siteForDomains)}`,
          );
          if (cancelled) return;
          const list = data.domains ?? [];
          setDomains(list);
          if (list[0]?.name) setDomain(list[0].name);
        } catch (e) {
          if (!cancelled) {
            setDomains([]);
            setError(e instanceof Error ? e.message : 'Failed to load domains');
          }
        } finally {
          if (!cancelled) setLoading(false);
        }
      },
      site === 'other' ? 400 : 0,
    );

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [siteValue, site]);

  useEffect(() => {
    if (!success || !emailId || code) return;
    let cancelled = false;
    let tries = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function tick() {
      if (cancelled || tries > 40) return;
      tries += 1;
      setPolling(true);
      try {
        const data = await api.get<{
          data?: {
            value?: string;
            code?: string;
            message?: string;
            status?: string;
          };
        }>(endpoints.services.emailsStatus(emailId));
        const value = data.data?.value || data.data?.code;
        if (value) {
          setCode(String(value));
          setMessage(data.data?.message || null);
          setPolling(false);
          return;
        }
        if (data.data?.status === 'OK' && data.data?.message) {
          setMessage(data.data.message);
        }
      } catch {
        // keep polling
      }
      setPolling(false);
      if (!cancelled) timer = setTimeout(tick, 5000);
    }

    void tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [success, emailId, code]);

  async function onSubmit() {
    if (!canSubmit || !selected) return;
    setSubmitting(true);
    setError(null);
    try {
      const data = await api.post<{
        email?: string;
        emailId?: string;
        amountFormatted?: string;
      }>(endpoints.services.emailsPurchase, {
        site: siteValue,
        domain: selected.name,
        priceUsd: selected.costUsd,
        priceLocal: selected.costLocal,
      });
      setEmail(data.email || '');
      setEmailId(data.emailId || '');
      setReceipt(data.amountFormatted || money(selected.costLocal));
      setCode(null);
      setMessage(null);
      invalidateWallet();
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Purchase failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function copyValue(value: string) {
    if (!value || value === '—' || value.includes('Waiting')) return;
    await Clipboard.setStringAsync(value);
  }

  if (success) {
    const codeLabel =
      code || message || (polling ? 'Waiting for email…' : '—');
    return (
      <Screen scroll>
        <PageHeader
          title="Rent Email"
          subtitle="Temporary inboxes for OTP & sign-ups"
          showBack
        />
        <Animated.View entering={FadeInDown.duration(280)} style={styles.successCard}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark-circle" size={32} color={Brand.orange} />
          </View>
          <Text style={styles.successTitle}>Email reserved</Text>
          <Text style={styles.successSub}>
            Copy the address and watch for codes · {receipt}
          </Text>

          <View style={styles.copyStack}>
            <CopyRow
              label="Email address"
              value={email}
              onCopy={() => void copyValue(email)}
            />
            <CopyRow
              label="Code / message"
              value={codeLabel}
              muted={!code && !message}
              onCopy={() => void copyValue(codeLabel)}
            />
            {polling && !code ? (
              <View style={styles.pollingRow}>
                <Text style={styles.pollingText}>Checking inbox for codes…</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.successActions}>
            <Button
              title="Rent another email"
              onPress={() => {
                setSuccess(false);
                setEmail('');
                setEmailId('');
                setCode(null);
                setMessage(null);
              }}
            />
            <Button
              title="Back to Home"
              variant="secondary"
              onPress={() => router.replace('/(app)/(tabs)')}
            />
          </View>
        </Animated.View>
      </Screen>
    );
  }

  return (
    <Screen
      scroll
      footer={
        <Button
          title={
            submitting
              ? 'Reserving…'
              : selected
                ? `Rent email · ${money(selected.costLocal)}`
                : 'Continue'
          }
          disabled={!canSubmit}
          loading={submitting}
          onPress={() => void onSubmit()}
        />
      }>
      <PageHeader
        title="Rent Email"
        subtitle="Temporary inboxes for OTP & sign-ups"
        showBack
      />

      {error ? (
        <View style={styles.errorBanner}>
          <View style={{ flex: 1 }}>
            <Text style={styles.errorTitle}>Something went wrong</Text>
            <Text style={styles.errorText}>{error}</Text>
          </View>
          <Pressable onPress={() => setError(null)} hitSlop={8}>
            <Ionicons name="close" size={18} color={colors.mutedForeground} />
          </Pressable>
        </View>
      ) : null}

      <Animated.View entering={FadeInDown.duration(280)} style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.iconBubble}>
            <Ionicons name="mail-outline" size={20} color={Brand.orange} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Where will you use it?</Text>
            <Text style={styles.cardSub}>Site that needs email verification</Text>
          </View>
        </View>

        <View style={styles.chipWrap}>
          {SITES.map((s) => {
            const active = site === s.id;
            return (
              <Pressable
                key={s.id}
                onPress={() => setSite(s.id)}
                style={[styles.chip, active && styles.chipActive]}>
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {s.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {site === 'other' ? (
          <TextInput
            value={customSite}
            onChangeText={setCustomSite}
            placeholder="example.com"
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.customSiteInput}
          />
        ) : null}
      </Animated.View>

      <Animated.View
        entering={FadeInDown.delay(40).duration(280)}
        style={styles.card}>
        <Text style={styles.cardTitle}>Email domain</Text>
        <Text style={styles.sectionSub}>
          Search and pick a domain for {siteValue || 'your site'}
        </Text>

        {loading ? (
          <View style={styles.triggerSkel} />
        ) : (
          <Pressable
            disabled={!domains.length}
            onPress={() => {
              setDomainQuery('');
              setDomainOpen(true);
            }}
            style={({ pressed }) => [
              styles.domainTrigger,
              !domains.length && styles.triggerDisabled,
              pressed && domains.length ? { opacity: 0.92 } : null,
            ]}>
            <Ionicons name="mail-open-outline" size={18} color={Brand.orange} />
            <Text
              style={[
                styles.domainTriggerText,
                !selected && styles.domainTriggerPlaceholder,
              ]}
              numberOfLines={1}>
              {selected
                ? `@${selected.name}`
                : domains.length
                  ? 'Select a domain'
                  : siteValue
                    ? 'No domains in stock'
                    : 'Enter a site first'}
            </Text>
            {selected ? (
              <Text style={styles.price}>{money(selected.costLocal)}</Text>
            ) : null}
            <Ionicons name="chevron-down" size={18} color={colors.mutedForeground} />
          </Pressable>
        )}

        {!loading && !domains.length && siteValue ? (
          <Text style={styles.hint}>
            No domains in stock for {siteValue}. Try another site.
          </Text>
        ) : null}
      </Animated.View>

      <Animated.View
        entering={FadeInDown.delay(70).duration(280)}
        style={styles.card}>
        <Text style={styles.cardTitle}>Order summary</Text>
        <View style={styles.summary}>
          <SummaryRow label="Site" value={siteValue || '—'} />
          <SummaryRow label="Domain" value={domain ? `@${domain}` : '—'} />
          <SummaryRow
            label="Amount"
            value={selected ? money(selected.costLocal) : money(0)}
            accent
          />
          <View style={styles.walletRow}>
            <Ionicons name="wallet-outline" size={16} color={Brand.orange} />
            <Text style={styles.walletText}>Pay from wallet</Text>
          </View>
        </View>
      </Animated.View>

      <ServiceInstructions service="emails" />

      <PickerSheet
        visible={domainOpen}
        title="Select domain"
        subtitle="Search and choose an email domain"
        onClose={() => {
          setDomainOpen(false);
          setDomainQuery('');
        }}
        headerExtra={
          <View style={styles.searchWrap}>
            <Ionicons name="search" size={16} color={colors.mutedForeground} />
            <TextInput
              value={domainQuery}
              onChangeText={setDomainQuery}
              placeholder="Search domains…"
              placeholderTextColor={colors.mutedForeground}
              style={styles.searchInput}
              autoCorrect={false}
              autoCapitalize="none"
              autoFocus
            />
          </View>
        }>
        {filteredDomains.length ? (
          <View style={styles.domainList}>
            {filteredDomains.map((d) => {
              const active = d.name === domain;
              return (
                <Pressable
                  key={d.name}
                  onPress={() => {
                    setDomain(d.name);
                    setDomainOpen(false);
                    setDomainQuery('');
                  }}
                  style={({ pressed }) => [
                    styles.domainRow,
                    active && styles.domainRowActive,
                    pressed && { opacity: 0.92 },
                  ]}>
                  <Ionicons
                    name="mail-open-outline"
                    size={18}
                    color={Brand.orange}
                  />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.domainName} numberOfLines={1}>
                      @{d.name}
                    </Text>
                    {d.count > 0 ? (
                      <Text style={styles.domainMeta}>
                        {d.count.toLocaleString()} in stock
                      </Text>
                    ) : null}
                  </View>
                  <Text style={styles.price}>{money(d.costLocal)}</Text>
                  {active ? (
                    <View style={styles.check}>
                      <Ionicons name="checkmark" size={14} color={Brand.white} />
                    </View>
                  ) : (
                    <View style={styles.checkSpacer} />
                  )}
                </Pressable>
              );
            })}
          </View>
        ) : (
          <View style={styles.emptySheet}>
            <Text style={styles.emptyText}>
              {domainQuery.trim()
                ? 'No domains match your search'
                : 'No domains available for this site'}
            </Text>
          </View>
        )}
      </PickerSheet>
    </Screen>
  );
}

function SummaryRow({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text
        style={[styles.summaryValue, accent && styles.summaryAccent]}
        numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

function CopyRow({
  label,
  value,
  muted,
  onCopy,
}: {
  label: string;
  value: string;
  muted?: boolean;
  onCopy: () => void;
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const canCopy = Boolean(value) && value !== '—' && !value.includes('Waiting');
  return (
    <View style={styles.copyRow}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.copyLabel}>{label}</Text>
        <Text
          style={[styles.copyValue, muted && styles.copyMuted]}
          numberOfLines={2}>
          {value}
        </Text>
      </View>
      {canCopy ? (
        <Pressable
          onPress={onCopy}
          style={({ pressed }) => [styles.copyBtn, pressed && { opacity: 0.85 }]}
          accessibilityLabel={`Copy ${label}`}>
          <Ionicons name="copy-outline" size={16} color={colors.foreground} />
        </Pressable>
      ) : null}
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    errorBanner: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      marginBottom: 8,
      padding: 10,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: 'rgba(255,59,48,0.25)',
      backgroundColor: 'rgba(255,59,48,0.08)',
    },
    errorTitle: { fontSize: 13, fontWeight: '800', color: Brand.error },
    errorText: {
      marginTop: 3,
      fontSize: 12,
      fontWeight: '500',
      color: colors.charcoal,
    },
    card: {
      marginBottom: 8,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: colors.grayDivider,
      backgroundColor: colors.card,
      padding: 10,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 8,
    },
    iconBubble: {
      width: 40,
      height: 40,
      borderRadius: 14,
      backgroundColor: Brand.orangeMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardTitle: { fontSize: 16, fontWeight: '700', color: colors.charcoal },
    cardSub: {
      marginTop: 2,
      fontSize: 12,
      fontWeight: '500',
      color: colors.grayMedium,
    },
    sectionSub: {
      marginTop: 2,
      marginBottom: 12,
      fontSize: 12,
      fontWeight: '500',
      color: colors.grayMedium,
    },
    chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      paddingHorizontal: 10,
      paddingVertical: 9,
      borderRadius: 99,
      backgroundColor: colors.grayLight,
    },
    chipActive: { backgroundColor: Brand.orange },
    chipText: { fontSize: 13, fontWeight: '700', color: colors.charcoal },
    chipTextActive: { color: Brand.white },
    customSiteInput: {
      marginTop: 12,
      height: 48,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.grayDivider,
      backgroundColor: colors.card,
      paddingHorizontal: 10,
      fontSize: 14,
      fontWeight: '600',
      color: colors.charcoal,
    },
    triggerSkel: {
      height: 44,
      borderRadius: 14,
      backgroundColor: colors.grayLight,
    },
    domainTrigger: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      minHeight: 44,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.grayDivider,
      backgroundColor: colors.card,
      paddingHorizontal: 10,
      paddingVertical: 12,
    },
    triggerDisabled: { opacity: 0.55 },
    domainTriggerText: {
      flex: 1,
      fontSize: 14,
      fontWeight: '700',
      color: colors.charcoal,
    },
    domainTriggerPlaceholder: { color: colors.grayMedium },
    price: { fontSize: 14, fontWeight: '800', color: Brand.orange },
    hint: {
      marginTop: 10,
      fontSize: 12,
      fontWeight: '500',
      color: colors.grayMedium,
    },
    summary: { gap: 10, marginTop: 10 },
    summaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: 12,
    },
    summaryLabel: { fontSize: 13, fontWeight: '500', color: colors.grayMedium },
    summaryValue: {
      flex: 1,
      textAlign: 'right',
      fontSize: 13,
      fontWeight: '700',
      color: colors.charcoal,
    },
    summaryAccent: { color: Brand.orange },
    walletRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 4,
      paddingTop: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.grayDivider,
    },
    walletText: { fontSize: 13, fontWeight: '700', color: colors.charcoal },
    searchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      height: 44,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.grayDivider,
      backgroundColor: colors.card,
      paddingHorizontal: 12,
    },
    searchInput: {
      flex: 1,
      fontSize: 14,
      fontWeight: '600',
      color: colors.charcoal,
      paddingVertical: 0,
    },
    domainList: { gap: 8 },
    domainRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      minHeight: 56,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.grayDivider,
      backgroundColor: colors.card,
      paddingHorizontal: 10,
      paddingVertical: 12,
    },
    domainRowActive: {
      borderColor: Brand.orange,
      backgroundColor: Brand.orangeMuted,
    },
    domainName: { fontSize: 14, fontWeight: '700', color: colors.charcoal },
    domainMeta: {
      marginTop: 2,
      fontSize: 12,
      fontWeight: '500',
      color: colors.grayMedium,
    },
    check: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: Brand.orange,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkSpacer: { width: 24, height: 24 },
    emptySheet: { paddingVertical: 28, alignItems: 'center' },
    emptyText: { fontSize: 13, fontWeight: '600', color: colors.grayMedium },
    successCard: {
      borderRadius: 28,
      borderWidth: 1,
      borderColor: colors.grayDivider,
      backgroundColor: colors.card,
      padding: 12,
      alignItems: 'center',
    },
    successIcon: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: Brand.orangeMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    successTitle: {
      marginTop: 12,
      fontSize: 22,
      fontWeight: '800',
      color: colors.charcoal,
    },
    successSub: {
      marginTop: 8,
      fontSize: 13,
      fontWeight: '500',
      color: colors.grayMedium,
      textAlign: 'center',
    },
    copyStack: { width: '100%', gap: 10, marginTop: 14 },
    copyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.grayDivider,
      backgroundColor: colors.grayLight,
      paddingHorizontal: 10,
      paddingVertical: 12,
    },
    copyLabel: { fontSize: 11, fontWeight: '600', color: colors.grayMedium },
    copyValue: {
      marginTop: 2,
      fontSize: 15,
      fontWeight: '800',
      color: colors.charcoal,
    },
    copyMuted: { color: colors.grayMedium },
    copyBtn: {
      width: 36,
      height: 36,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.grayDivider,
      backgroundColor: colors.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pollingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    pollingText: { fontSize: 12, fontWeight: '500', color: colors.grayMedium },
    successActions: { width: '100%', gap: 10, marginTop: 14 },
  });
}
