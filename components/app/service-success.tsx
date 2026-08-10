import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';

import { PickerSheet } from '@/components/app/picker-sheet';
import { Brand, type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';
import { toast } from '@/lib/toast';

export type ServiceSuccessAction = {
  label: string;
  onPress: () => void;
  icon?: 'receipt' | 'share' | 'plus' | 'home' | 'again';
};

export type ServiceSuccessProps = {
  variant?: 'success' | 'pending';
  title: string;
  subtitle: string;
  amountLabel?: string;
  amount?: string | null;
  reference?: string | null;
  primaryAction?: ServiceSuccessAction | null;
  secondaryAction?: ServiceSuccessAction | null;
  tertiaryAction?: ServiceSuccessAction | null;
  showFooter?: boolean;
  /** @deprecated Confetti removed — ignored. */
  confetti?: boolean;
  onDismiss?: () => void;
  children?: ReactNode;
};

function ActionRow({
  action,
  variant,
  colors,
  styles,
}: {
  action: ServiceSuccessAction;
  variant: 'primary' | 'secondary';
  colors: ThemeColors;
  styles: ReturnType<typeof makeStyles>;
}) {
  const iconName =
    action.icon === 'receipt'
      ? 'document-text-outline'
      : action.icon === 'share'
        ? 'share-outline'
        : action.icon === 'plus'
          ? 'add'
          : action.icon === 'home'
            ? 'home-outline'
            : 'refresh-outline';

  return (
    <Pressable
      onPress={action.onPress}
      style={({ pressed }) => [
        styles.actionBtn,
        variant === 'primary' ? styles.actionPrimary : styles.actionSecondary,
        pressed && { opacity: 0.92 },
      ]}>
      <View style={styles.actionLeft}>
        {action.icon !== 'plus' ? (
          <Ionicons
            name={iconName}
            size={18}
            color={variant === 'primary' ? Brand.white : colors.foreground}
          />
        ) : null}
        <Text
          style={[
            styles.actionText,
            variant === 'primary' && styles.actionTextPrimary,
          ]}>
          {action.label}
        </Text>
      </View>
      {action.icon === 'plus' ? (
        <View style={styles.plusBox}>
          <Ionicons name="add" size={16} color={colors.foreground} />
        </View>
      ) : (
        <Ionicons
          name="chevron-forward"
          size={16}
          color={
            variant === 'primary' ? 'rgba(255,255,255,0.8)' : colors.mutedForeground
          }
        />
      )}
    </Pressable>
  );
}

export function ServiceSuccess({
  variant = 'success',
  title,
  subtitle,
  amountLabel,
  amount,
  reference,
  primaryAction,
  secondaryAction,
  tertiaryAction,
  showFooter = true,
  onDismiss,
  children,
}: ServiceSuccessProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const isSuccess = variant === 'success';
  const [visible, setVisible] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setVisible(true);
  }, [title, reference, amount]);

  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(id);
  }, [copied]);

  async function copyReference() {
    if (!reference) return;
    try {
      await Clipboard.setStringAsync(reference);
      setCopied(true);
      toast.success('Reference copied');
    } catch {
      toast.error('Could not copy');
    }
  }

  const dismiss = () => {
    setVisible(false);
    onDismiss?.();
  };

  return (
    <PickerSheet
      visible={visible}
      title={title}
      subtitle={subtitle}
      onClose={dismiss}
      fullScreen>
      <View style={styles.body}>
        <View style={styles.iconWrap}>
          <View
            style={[
              styles.iconHalo,
              {
                backgroundColor: isSuccess
                  ? 'rgba(52,199,89,0.18)'
                  : 'rgba(245,158,11,0.16)',
              },
            ]}
          />
          <Animated.View
            entering={ZoomIn.springify().damping(14)}
            style={[
              styles.iconCircle,
              {
                backgroundColor: isSuccess ? Brand.success : '#F59E0B',
                shadowColor: isSuccess ? Brand.success : '#F59E0B',
              },
            ]}>
            <Ionicons
              name={isSuccess ? 'checkmark' : 'time'}
              size={32}
              color={Brand.white}
            />
          </Animated.View>
        </View>

        {amount || reference ? (
          <View style={styles.detailCard}>
            {amount ? (
              <View style={styles.amountRow}>
                <View
                  style={[
                    styles.walletBubble,
                    {
                      backgroundColor: isSuccess
                        ? 'rgba(52,199,89,0.15)'
                        : 'rgba(245,158,11,0.15)',
                    },
                  ]}>
                  <Ionicons
                    name="wallet"
                    size={20}
                    color={isSuccess ? Brand.success : '#D97706'}
                  />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.amountLabel}>
                    {(
                      amountLabel ||
                      (isSuccess ? 'Amount credited' : 'Expected amount')
                    ).toUpperCase()}
                  </Text>
                  <Text style={styles.amountValue} numberOfLines={1}>
                    {amount}
                  </Text>
                </View>
              </View>
            ) : null}

            {amount && reference ? <View style={styles.divider} /> : null}

            {reference ? (
              <View style={styles.refRow}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.refLabel}>Reference ID</Text>
                  <Text style={styles.refValue} numberOfLines={1} selectable>
                    {reference}
                  </Text>
                </View>
                <Pressable onPress={() => void copyReference()} style={styles.copyBtn}>
                  <Ionicons name="copy-outline" size={14} color={Brand.success} />
                  <Text style={styles.copyText}>{copied ? 'Copied' : 'Copy'}</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        ) : null}

        {children ? <View style={styles.children}>{children}</View> : null}

        <View style={styles.actions}>
          {primaryAction ? (
            <ActionRow
              action={primaryAction}
              variant="primary"
              colors={colors}
              styles={styles}
            />
          ) : null}
          {secondaryAction ? (
            <ActionRow
              action={secondaryAction}
              variant="secondary"
              colors={colors}
              styles={styles}
            />
          ) : null}
          {tertiaryAction ? (
            <ActionRow
              action={tertiaryAction}
              variant="secondary"
              colors={colors}
              styles={styles}
            />
          ) : null}
        </View>

        {showFooter ? (
          <View style={styles.footer}>
            <View style={styles.footerCol}>
              <Ionicons name="shield-checkmark" size={16} color={Brand.success} />
              <View style={{ flex: 1 }}>
                <Text style={styles.footerTitle}>100% Secure</Text>
                <Text style={styles.footerSub}>Your transactions are protected</Text>
              </View>
            </View>
            <View style={styles.footerDivider} />
            <Pressable
              style={styles.footerCol}
              onPress={() => router.push('/(app)/support' as never)}>
              <Ionicons name="headset" size={16} color={Brand.success} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.footerTitle, { color: colors.foreground }]}>
                  Need help?
                </Text>
                <Text
                  style={[styles.footerSub, { color: Brand.success, fontWeight: '700' }]}>
                  Contact support
                </Text>
              </View>
            </Pressable>
          </View>
        ) : null}
      </View>
    </PickerSheet>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    body: {
      flexGrow: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingBottom: 8,
      paddingTop: 12,
    },
    iconWrap: {
      width: 88,
      height: 88,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 4,
      marginTop: 4,
    },
    iconHalo: {
      ...StyleSheet.absoluteFillObject,
      borderRadius: 44,
    },
    iconCircle: {
      width: 68,
      height: 68,
      borderRadius: 34,
      alignItems: 'center',
      justifyContent: 'center',
      shadowOpacity: 0.35,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 6,
    },
    detailCard: {
      width: '100%',
      marginTop: 16,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.muted,
      overflow: 'hidden',
    },
    amountRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 14,
    },
    walletBubble: {
      width: 44,
      height: 44,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    amountLabel: {
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 0.8,
      color: colors.mutedForeground,
    },
    amountValue: {
      marginTop: 2,
      fontSize: 22,
      fontWeight: '800',
      color: colors.foreground,
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.border,
    },
    refRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    refLabel: { fontSize: 12, fontWeight: '500', color: colors.mutedForeground },
    refValue: {
      marginTop: 2,
      fontSize: 13,
      fontWeight: '700',
      fontVariant: ['tabular-nums'],
      color: colors.foreground,
    },
    copyBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 10,
      paddingVertical: 7,
      backgroundColor: colors.card,
    },
    copyText: { fontSize: 12, fontWeight: '700', color: Brand.success },
    children: { width: '100%', marginTop: 14 },
    actions: { width: '100%', marginTop: 18, gap: 10 },
    actionBtn: {
      height: 52,
      borderRadius: 16,
      paddingHorizontal: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    actionPrimary: {
      backgroundColor: Brand.orange,
      shadowColor: Brand.orange,
      shadowOpacity: 0.28,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 8 },
      elevation: 4,
    },
    actionSecondary: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.muted,
    },
    actionLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    actionText: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.foreground,
    },
    actionTextPrimary: { color: Brand.white },
    plusBox: {
      width: 28,
      height: 28,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.card,
    },
    footer: {
      width: '100%',
      marginTop: 20,
      paddingTop: 16,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      flexDirection: 'row',
      gap: 10,
    },
    footerCol: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
    },
    footerDivider: {
      width: StyleSheet.hairlineWidth,
      backgroundColor: colors.border,
    },
    footerTitle: {
      fontSize: 12,
      fontWeight: '800',
      color: Brand.success,
    },
    footerSub: {
      marginTop: 2,
      fontSize: 11,
      fontWeight: '500',
      color: colors.mutedForeground,
      lineHeight: 15,
    },
  });
}
