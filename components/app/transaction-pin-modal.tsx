import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Brand, Radius, type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';

export type TransactionPinModalMode = 'confirm' | 'create';

type Props = {
  visible: boolean;
  mode: TransactionPinModalMode;
  loading?: boolean;
  error?: string | null;
  title?: string;
  description?: string;
  confirmLabel?: string;
  onClose: () => void;
  onConfirm: (payload: { pin: string; isCreate: boolean }) => void | Promise<void>;
};

export function TransactionPinModal({
  visible,
  mode,
  loading = false,
  error = null,
  title,
  description,
  confirmLabel,
  onClose,
  onConfirm,
}: Props) {
  const { colors, isDark } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);
  const isCreate = mode === 'create';
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      setPin('');
      setConfirmPin('');
      setLocalError(null);
    }
  }, [visible]);

  function digits(value: string) {
    return value.replace(/\D/g, '').slice(0, 6);
  }

  async function submit() {
    setLocalError(null);
    if (pin.length < 4) {
      setLocalError('PIN must be 4–6 digits.');
      return;
    }
    if (isCreate && pin !== confirmPin) {
      setLocalError('PINs do not match.');
      return;
    }
    await onConfirm({ pin, isCreate });
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={StyleSheet.absoluteFill} onPress={loading ? undefined : onClose} />
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Ionicons name="key" size={26} color={Brand.orange} />
          </View>
          <Text style={styles.title}>
            {title || (isCreate ? 'Create transaction PIN' : 'Enter transaction PIN')}
          </Text>
          <Text style={styles.body}>
            {description ||
              (isCreate
                ? 'Set a 4–6 digit PIN to authorize withdrawals and protect your wallet.'
                : 'Enter your transaction PIN to confirm this withdrawal.')}
          </Text>

          <Text style={styles.label}>{isCreate ? 'New PIN' : 'Transaction PIN'}</Text>
          <TextInput
            value={pin}
            onChangeText={(t) => setPin(digits(t))}
            secureTextEntry
            keyboardType="number-pad"
            maxLength={6}
            placeholder="••••"
            placeholderTextColor={colors.mutedForeground}
            style={styles.input}
            editable={!loading}
            autoFocus
          />

          {isCreate ? (
            <>
              <Text style={styles.label}>Confirm PIN</Text>
              <TextInput
                value={confirmPin}
                onChangeText={(t) => setConfirmPin(digits(t))}
                secureTextEntry
                keyboardType="number-pad"
                maxLength={6}
                placeholder="••••"
                placeholderTextColor={colors.mutedForeground}
                style={styles.input}
                editable={!loading}
              />
            </>
          ) : null}

          {localError || error ? (
            <Text style={styles.errorText}>{localError || error}</Text>
          ) : null}

          {!isCreate ? (
            <Pressable
              onPress={() => {
                onClose();
                router.push('/(app)/settings/security');
              }}
              hitSlop={8}
              style={styles.linkWrap}>
              <Text style={styles.linkText}>Forgot PIN? Change it in Security</Text>
            </Pressable>
          ) : null}

          <View style={styles.actions}>
            <Pressable
              style={[styles.ghostBtn, loading && styles.disabled]}
              onPress={onClose}
              disabled={loading}>
              <Text style={styles.ghostText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[
                styles.primaryBtn,
                (loading || pin.length < 4) && styles.disabled,
              ]}
              onPress={() => void submit()}
              disabled={loading || pin.length < 4}>
              {loading ? (
                <ActivityIndicator color={Brand.white} />
              ) : (
                <Text style={styles.primaryText}>
                  {confirmLabel || (isCreate ? 'Set PIN & continue' : 'Confirm')}
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function makeStyles(colors: ThemeColors, isDark: boolean) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: isDark ? 'rgba(0,0,0,0.72)' : 'rgba(28,28,30,0.55)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },
    card: {
      width: '100%',
      maxWidth: 360,
      borderRadius: Radius.xl,
      backgroundColor: colors.card,
      padding: 22,
    },
    iconWrap: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: colors.orangeMuted,
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'center',
    },
    title: {
      color: colors.foreground,
      fontSize: 18,
      fontWeight: '800',
      marginTop: 14,
      textAlign: 'center',
    },
    body: {
      color: colors.mutedForeground,
      fontSize: 13,
      lineHeight: 20,
      marginTop: 8,
      textAlign: 'center',
    },
    label: {
      marginTop: 14,
      fontSize: 13,
      fontWeight: '700',
      color: colors.foreground,
    },
    input: {
      marginTop: 8,
      height: 48,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.muted,
      paddingHorizontal: 14,
      fontSize: 20,
      fontWeight: '800',
      letterSpacing: 6,
      color: colors.foreground,
      textAlign: 'center',
    },
    errorText: {
      marginTop: 10,
      color: Brand.error,
      fontSize: 13,
      fontWeight: '600',
      textAlign: 'center',
    },
    linkWrap: { marginTop: 10, alignItems: 'center' },
    linkText: { color: Brand.orange, fontSize: 12, fontWeight: '700' },
    actions: { marginTop: 18, flexDirection: 'row', gap: 10 },
    ghostBtn: {
      flex: 1,
      height: 46,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.muted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ghostText: { color: colors.foreground, fontWeight: '700', fontSize: 14 },
    primaryBtn: {
      flex: 1.2,
      height: 46,
      borderRadius: Radius.md,
      backgroundColor: Brand.orange,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 8,
    },
    primaryText: { color: Brand.white, fontWeight: '800', fontSize: 13, textAlign: 'center' },
    disabled: { opacity: 0.65 },
  });
}
