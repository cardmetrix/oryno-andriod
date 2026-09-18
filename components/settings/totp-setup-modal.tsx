import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OtpInput } from '@/components/auth/otp-input';
import { Button } from '@/components/ui/button';
import { Brand, Radius, type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';
import { api } from '@/lib/api';
import { endpoints } from '@/lib/endpoints';
import { setTwoFactorToken } from '@/lib/two-factor';
import { toast } from '@/lib/toast';

type Props = {
  visible: boolean;
  onClose: () => void;
  onEnabled: () => void;
};

export function TotpSetupModal({ visible, onClose, onEnabled }: Props) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [secret, setSecret] = useState('');
  const [uri, setUri] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [started, setStarted] = useState(false);

  function reset() {
    setSecret('');
    setUri('');
    setCode('');
    setError(false);
    setStarted(false);
  }

  async function startEnrollment() {
    setLoading(true);
    setError(false);
    try {
      const totp = await api.post<{ secret?: string; uri?: string }>(
        endpoints.settings.twoFactorSetup,
      );
      setSecret(totp.secret || '');
      setUri(totp.uri || '');
      setStarted(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not start authenticator setup');
    } finally {
      setLoading(false);
    }
  }

  async function verify(otp = code) {
    if (otp.length < 6) return;
    setVerifying(true);
    setError(false);
    try {
      const json = await api.post<{ token?: string }>(endpoints.settings.twoFactorEnable, {
        code: otp.trim(),
      });
      if (json.token) await setTwoFactorToken(json.token);
      toast.success('2FA enabled', {
        description: 'Google Authenticator is now required at sign-in.',
      });
      reset();
      onEnabled();
      onClose();
    } catch (e) {
      setError(true);
      setCode('');
      toast.error(e instanceof Error ? e.message : 'Invalid authenticator code');
    } finally {
      setVerifying(false);
    }
  }

  async function copySecret() {
    if (!secret) return;
    await Clipboard.setStringAsync(secret);
    toast.success('Secret copied');
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.modal, { paddingTop: Math.max(insets.top, 12) }]}>
        <View style={styles.head}>
          <Text style={styles.title}>Google Authenticator</Text>
          <Pressable
            onPress={() => {
              reset();
              onClose();
            }}
            hitSlop={10}>
            <Ionicons name="close" size={22} color={colors.foreground} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.body}>
          <Text style={styles.lead}>
            Scan this QR code in Google Authenticator (or any TOTP app), then enter the 6-digit
            code to finish.
          </Text>

          {!started ? (
            <Button
              title={loading ? 'Preparing…' : 'Generate QR code'}
              onPress={() => void startEnrollment()}
              loading={loading}
            />
          ) : (
            <>
              <View style={styles.qrCard}>
                {uri ? (
                  <QRCode value={uri} size={180} backgroundColor={Brand.white} color={Brand.charcoal} />
                ) : (
                  <ActivityIndicator color={Brand.orange} />
                )}
              </View>

              {secret ? (
                <Pressable onPress={() => void copySecret()} style={styles.secretRow}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.secretLabel}>Can’t scan? Enter this key</Text>
                    <Text style={styles.secret} selectable>
                      {secret}
                    </Text>
                  </View>
                  <Ionicons name="copy-outline" size={18} color={Brand.orange} />
                </Pressable>
              ) : null}

              <Text style={styles.verifyLabel}>Enter the 6-digit code</Text>
              <OtpInput
                value={code}
                onChange={(v) => {
                  setError(false);
                  setCode(v);
                }}
                error={error}
                onComplete={(otp) => void verify(otp)}
              />

              <Button
                title={verifying ? 'Verifying…' : 'Enable 2FA'}
                onPress={() => void verify()}
                loading={verifying}
                disabled={code.length < 6 || verifying}
                style={{ marginTop: 8 }}
              />
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

export function TotpDisableModal({
  visible,
  onClose,
  onDisabled,
}: {
  visible: boolean;
  onClose: () => void;
  onDisabled: () => void;
}) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [code, setCode] = useState('');
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);

  async function disable(otp = code) {
    if (otp.length < 6) return;
    setSaving(true);
    setError(false);
    try {
      await api.post(endpoints.settings.twoFactorDisable, { code: otp.trim() });
      const { clearTwoFactorToken } = await import('@/lib/two-factor');
      await clearTwoFactorToken();
      toast.success('2FA disabled', {
        description: 'Authenticator codes are no longer required at sign-in.',
      });
      setCode('');
      onDisabled();
      onClose();
    } catch (e) {
      setError(true);
      setCode('');
      toast.error(e instanceof Error ? e.message : 'Could not disable 2FA');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.modal, { paddingTop: Math.max(insets.top, 12) }]}>
        <View style={styles.head}>
          <Text style={styles.title}>Turn off 2FA</Text>
          <Pressable onPress={onClose} hitSlop={10}>
            <Ionicons name="close" size={22} color={colors.foreground} />
          </Pressable>
        </View>
        <View style={styles.body}>
          <Text style={styles.lead}>
            Enter the current 6-digit code from Google Authenticator to confirm.
          </Text>
          <OtpInput
            value={code}
            onChange={(v) => {
              setError(false);
              setCode(v);
            }}
            error={error}
            onComplete={(otp) => void disable(otp)}
          />
          <Button
            title={saving ? 'Turning off…' : 'Turn off 2FA'}
            onPress={() => void disable()}
            loading={saving}
            disabled={code.length < 6 || saving}
          />
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    modal: { flex: 1, backgroundColor: colors.background },
    head: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingBottom: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    title: { fontSize: 18, fontWeight: '800', color: colors.foreground },
    body: { padding: 16, gap: 16, paddingBottom: 40 },
    lead: {
      fontSize: 14,
      lineHeight: 20,
      fontWeight: '500',
      color: colors.mutedForeground,
    },
    qrCard: {
      alignSelf: 'center',
      backgroundColor: Brand.white,
      borderRadius: 20,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    secretRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderRadius: Radius.lg,
      backgroundColor: colors.muted,
      padding: 12,
    },
    secretLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.mutedForeground,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    secret: {
      marginTop: 4,
      fontSize: 13,
      fontWeight: '700',
      color: colors.foreground,
      letterSpacing: 0.6,
    },
    verifyLabel: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.foreground,
    },
  });
}
