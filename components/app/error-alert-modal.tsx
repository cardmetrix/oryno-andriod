import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Brand, Radius, type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';
import { api } from '@/lib/api';
import { endpoints } from '@/lib/endpoints';
import { publicServiceError } from '@/lib/service-errors';

type Props = {
  error: string | null;
  onClose: () => void;
  /** Short context shown in the modal and support email subject */
  page?: string;
};

/**
 * Service error modal — matches website `ErrorAlertModal`:
 * sanitized error details, optional note, contact support (+ mailto fallback).
 */
export function ErrorAlertModal({
  error,
  onClose,
  page = 'ORYNO',
}: Props) {
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);
  const displayError = error ? publicServiceError(error) : null;
  const open = Boolean(error);

  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (!open) {
      setNote('');
      setSending(false);
      setSent(false);
      setSendError(null);
      setKeyboardHeight(0);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const showEvent =
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent =
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const onShow = Keyboard.addListener(showEvent, (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const onHide = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });
    return () => {
      onShow.remove();
      onHide.remove();
    };
  }, [open]);

  async function openMailtoFallback(reason?: string) {
    const support = 'support@oryno.com';
    const subject = encodeURIComponent(`[ORYNO Error] ${page}`);
    const body = encodeURIComponent(
      [
        'Hi ORYNO Support,',
        '',
        'I ran into an error in the app:',
        error ?? '',
        '',
        note.trim() ? `Additional details:\n${note.trim()}\n` : '',
        `Page: ${page}`,
        '',
        'Thanks,',
      ]
        .filter(Boolean)
        .join('\n'),
    );
    await Linking.openURL(`mailto:${support}?subject=${subject}&body=${body}`);
    setSendError(
      reason
        ? `${reason}. Opening your email app instead…`
        : 'Opening your email app instead…',
    );
  }

  async function contactSupport() {
    if (!error || sending) return;
    setSending(true);
    setSendError(null);
    try {
      await api.post(endpoints.support.errorReport, {
        errorMessage: error,
        page,
        userNote: note.trim() || undefined,
        url: `oryno-app://${page}`,
      });
      setSent(true);
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'Failed to contact support';
      try {
        await openMailtoFallback(message);
      } catch {
        setSendError(message);
      }
    } finally {
      setSending(false);
    }
  }

  const bottomPad =
    keyboardHeight > 0
      ? Math.max(12, keyboardHeight - insets.bottom + 12)
      : Math.max(insets.bottom, 24);

  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent>
      <View style={styles.root}>
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
          accessibilityLabel="Dismiss"
        />

        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          bounces={false}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: insets.top + 16,
              paddingBottom: bottomPad,
              justifyContent: keyboardHeight > 0 ? 'flex-end' : 'center',
            },
          ]}>
          <View style={styles.card}>
            <Pressable
              onPress={onClose}
              style={styles.closeBtn}
              accessibilityLabel="Close"
              hitSlop={10}>
              <Ionicons
                name="close"
                size={18}
                color={colors.mutedForeground}
              />
            </Pressable>

            <View style={styles.iconWrap}>
              <Ionicons name="warning" size={26} color={Brand.error} />
            </View>

            <Text style={styles.title}>Something went wrong</Text>
            <Text style={styles.description}>
              {page} couldn’t complete that action. You can dismiss this or
              contact ORYNO support with the details below.
            </Text>

            <View style={styles.errorBox}>
              <Text style={styles.errorLabel}>Error details</Text>
              <Text style={styles.errorBody}>{displayError}</Text>
            </View>

            {sent ? (
              <View style={styles.sentBox}>
                <Text style={styles.sentText}>
                  Report sent to ORYNO support. We’ll reply to your account email
                  soon.
                </Text>
              </View>
            ) : (
              <View>
                <Text style={styles.noteLabel}>Add a note (optional)</Text>
                <TextInput
                  value={note}
                  onChangeText={setNote}
                  placeholder="What were you trying to do?"
                  placeholderTextColor={colors.mutedForeground}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                  style={styles.noteInput}
                  editable={!sending}
                />
              </View>
            )}

            {sendError ? (
              <Text style={styles.sendError}>{sendError}</Text>
            ) : null}

            <View style={styles.actions}>
              {!sent ? (
                <Pressable
                  style={[styles.primaryBtn, sending && styles.disabled]}
                  onPress={() => void contactSupport()}
                  disabled={sending}>
                  {sending ? (
                    <>
                      <ActivityIndicator color={Brand.white} />
                      <Text style={styles.primaryText}>Sending…</Text>
                    </>
                  ) : (
                    <>
                      <Ionicons
                        name="headset"
                        size={18}
                        color={Brand.white}
                      />
                      <Text style={styles.primaryText}>
                        Contact ORYNO support
                      </Text>
                    </>
                  )}
                </Pressable>
              ) : (
                <Pressable
                  style={styles.secondaryBtn}
                  onPress={() =>
                    void Linking.openURL('mailto:support@oryno.com')
                  }>
                  <Ionicons
                    name="mail"
                    size={18}
                    color={colors.foreground}
                  />
                  <Text style={styles.secondaryText}>
                    Email support@oryno.com
                  </Text>
                </Pressable>
              )}

              <Pressable style={styles.closeAction} onPress={onClose}>
                <Text style={styles.closeActionText}>Close</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

function makeStyles(colors: ThemeColors, isDark: boolean) {
  return StyleSheet.create({
    root: { flex: 1 },
    backdrop: {
      ...StyleSheet.absoluteFill,
      backgroundColor: isDark ? 'rgba(0,0,0,0.72)' : 'rgba(28,28,30,0.55)',
    },
    scrollContent: {
      flexGrow: 1,
      paddingHorizontal: 20,
      alignItems: 'center',
    },
    card: {
      width: '100%',
      maxWidth: 420,
      borderRadius: 24,
      backgroundColor: colors.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      overflow: 'hidden',
      paddingTop: 22,
      shadowColor: '#0F0F12',
      shadowOpacity: 0.18,
      shadowRadius: 28,
      shadowOffset: { width: 0, height: 14 },
      elevation: 16,
    },
    closeBtn: {
      position: 'absolute',
      top: 14,
      right: 14,
      width: 36,
      height: 36,
      borderRadius: 18,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2,
    },
    iconWrap: {
      marginLeft: 22,
      width: 48,
      height: 48,
      borderRadius: 16,
      backgroundColor: isDark ? 'rgba(255,59,48,0.16)' : 'rgba(255,59,48,0.1)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      marginTop: 14,
      paddingHorizontal: 22,
      paddingRight: 52,
      fontSize: 20,
      fontWeight: '800',
      letterSpacing: -0.3,
      color: colors.foreground,
    },
    description: {
      marginTop: 8,
      paddingHorizontal: 22,
      paddingRight: 40,
      fontSize: 13,
      lineHeight: 20,
      color: colors.mutedForeground,
    },
    errorBox: {
      marginTop: 16,
      marginHorizontal: 22,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,59,48,0.28)' : 'rgba(255,59,48,0.18)',
      backgroundColor: isDark ? 'rgba(255,59,48,0.12)' : 'rgba(255,59,48,0.08)',
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    errorLabel: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      color: isDark ? 'rgba(255,120,110,0.9)' : 'rgba(176,0,32,0.75)',
    },
    errorBody: {
      marginTop: 4,
      fontSize: 14,
      lineHeight: 20,
      fontWeight: '600',
      color: Brand.error,
    },
    noteLabel: {
      marginTop: 14,
      marginHorizontal: 22,
      fontSize: 14,
      fontWeight: '700',
      color: colors.foreground,
    },
    noteInput: {
      marginTop: 8,
      marginHorizontal: 22,
      minHeight: 84,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
      lineHeight: 20,
      color: colors.foreground,
    },
    sentBox: {
      marginTop: 14,
      marginHorizontal: 22,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(52,199,89,0.3)' : 'rgba(52,199,89,0.25)',
      backgroundColor: isDark ? 'rgba(52,199,89,0.12)' : 'rgba(52,199,89,0.1)',
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    sentText: {
      fontSize: 13,
      lineHeight: 19,
      fontWeight: '600',
      color: isDark ? '#7DDEA0' : '#1B7A3D',
    },
    sendError: {
      marginTop: 10,
      marginHorizontal: 22,
      fontSize: 12,
      color: colors.mutedForeground,
    },
    actions: {
      marginTop: 16,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
      paddingHorizontal: 16,
      paddingVertical: 14,
      gap: 10,
    },
    primaryBtn: {
      minHeight: 44,
      borderRadius: Radius.md,
      backgroundColor: Brand.orange,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingHorizontal: 12,
    },
    primaryText: {
      color: Brand.white,
      fontSize: 14,
      fontWeight: '800',
    },
    secondaryBtn: {
      minHeight: 44,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.muted,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingHorizontal: 12,
    },
    secondaryText: {
      color: colors.foreground,
      fontSize: 14,
      fontWeight: '700',
    },
    closeAction: {
      minHeight: 44,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.muted,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 12,
    },
    closeActionText: {
      color: colors.foreground,
      fontSize: 14,
      fontWeight: '700',
    },
    disabled: { opacity: 0.65 },
  });
}
