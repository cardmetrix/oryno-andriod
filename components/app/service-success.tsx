import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { StatusMarkIcon } from '@/components/app/status-mark-icon';
import { Brand, type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';
import { hrefToAppRoute } from '@/lib/push-notifications/navigation';
import { toast } from '@/lib/toast';

export type ServiceSuccessAction = {
  label: string;
  href?: string;
  onClick?: () => void;
  /** Mobile callers; runs after `onClick` when both are set. */
  onPress?: () => void;
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

  const handlePress = () => {
    action.onClick?.();
    action.onPress?.();
    if (action.href) {
      router.push(hrefToAppRoute(action.href) as never);
    }
  };

  return (
    <Pressable
      onPress={handlePress}
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

/** Centered success dialog matching website `ServiceSuccess` (Dialog). */
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
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const isSuccess = variant === 'success';
  const [visible, setVisible] = useState(true);
  const [copied, setCopied] = useState(false);
  const maxCardHeight = Math.min(windowHeight * 0.88, 720);

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
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      presentationStyle="overFullScreen"
      onRequestClose={dismiss}
      statusBarTranslucent>
      <View style={[styles.root, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }]}>
        <Pressable style={styles.backdrop} onPress={dismiss} accessibilityLabel="Dismiss" />
        <Animated.View entering={FadeIn.duration(180)} style={styles.cardWrap}>
          <View
            style={[
              styles.card,
              { backgroundColor: colors.card, maxHeight: maxCardHeight },
            ]}>
            <Pressable
              onPress={dismiss}
              style={({ pressed }) => [
                styles.closeBtn,
                { backgroundColor: colors.muted },
                pressed && { opacity: 0.75 },
              ]}
              accessibilityLabel="Close"
              hitSlop={8}>
              <Ionicons name="close" size={18} color={colors.foreground} />
            </Pressable>

            <ScrollView
              bounces={false}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.body}
              keyboardShouldPersistTaps="handled">
              <StatusMarkIcon
                status={isSuccess ? 'Successful' : 'Pending'}
                style={styles.statusMark}
              />

              <Text style={styles.title}>{title}</Text>
              <Text style={styles.subtitle}>{subtitle}</Text>

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
                          {amountLabel ||
                            (isSuccess ? 'Amount credited' : 'Expected amount')}
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
                      <Pressable
                        onPress={() => void copyReference()}
                        style={styles.copyBtn}>
                        <Ionicons name="copy-outline" size={14} color={Brand.success} />
                        <Text style={styles.copyText}>
                          {copied ? 'Copied' : 'Copy'}
                        </Text>
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
                      <Text style={styles.footerSub}>
                        Your transactions are protected
                      </Text>
                    </View>
                  </View>
                  <View style={styles.footerDivider} />
                  <Pressable
                    style={styles.footerCol}
                    onPress={() => router.push('/(app)/support' as never)}>
                    <Ionicons name="headset" size={16} color={Brand.success} />
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[styles.footerTitle, { color: colors.foreground }]}>
                        Need help?
                      </Text>
                      <Text
                        style={[
                          styles.footerSub,
                          { color: Brand.success, fontWeight: '700' },
                        ]}>
                        Contact support
                      </Text>
                    </View>
                  </Pressable>
                </View>
              ) : null}
            </ScrollView>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 16,
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.55)',
    },
    cardWrap: {
      width: '100%',
      maxWidth: 420,
      zIndex: 1,
    },
    card: {
      borderRadius: 28,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOpacity: 0.22,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 12 },
      elevation: 12,
    },
    closeBtn: {
      position: 'absolute',
      top: 12,
      right: 12,
      zIndex: 2,
      width: 32,
      height: 32,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    body: {
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: 28,
      paddingBottom: 22,
    },
    statusMark: {
      marginTop: -4,
      marginBottom: 4,
    },
    title: {
      marginTop: 12,
      fontSize: 24,
      fontWeight: '800',
      letterSpacing: -0.3,
      color: colors.foreground,
      textAlign: 'center',
    },
    subtitle: {
      marginTop: 8,
      maxWidth: 320,
      fontSize: 14,
      fontWeight: '500',
      lineHeight: 20,
      color: colors.mutedForeground,
      textAlign: 'center',
    },
    detailCard: {
      width: '100%',
      marginTop: 24,
      borderRadius: 16,
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
      letterSpacing: 1.4,
      textTransform: 'uppercase',
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
    actions: { width: '100%', marginTop: 24, gap: 10 },
    actionBtn: {
      height: 48,
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
      marginTop: 28,
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
