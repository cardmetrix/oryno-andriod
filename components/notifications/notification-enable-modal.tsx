import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Brand, Radius, type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';

type Props = {
  visible: boolean;
  loading?: boolean;
  onEnable: () => void;
  onDismiss: () => void;
};

export function NotificationEnableModal({ visible, loading, onEnable, onDismiss }: Props) {
  const { colors, isDark } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Ionicons name="notifications" size={28} color={Brand.orange} />
          </View>
          <Text style={styles.title}>Enable push alerts</Text>
          <Text style={styles.body}>
            Get instant alerts for wallet activity, orders, KYC updates, and account security —
            even when ORYNO is in the background.
          </Text>
          <Pressable
            style={[styles.primaryBtn, loading && styles.disabled]}
            onPress={onEnable}
            disabled={loading}>
            {loading ? (
              <ActivityIndicator color={Brand.white} />
            ) : (
              <Text style={styles.primaryText}>Enable notifications</Text>
            )}
          </Pressable>
          <Pressable style={styles.ghostBtn} onPress={onDismiss} disabled={loading}>
            <Text style={styles.ghostText}>Not now</Text>
          </Pressable>
        </View>
      </View>
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
      padding: 24,
      alignItems: 'center',
    },
    iconWrap: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.orangeMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      color: colors.foreground,
      fontSize: 18,
      fontWeight: '800',
      marginTop: 16,
      textAlign: 'center',
    },
    body: {
      color: colors.mutedForeground,
      fontSize: 14,
      lineHeight: 22,
      marginTop: 8,
      textAlign: 'center',
    },
    primaryBtn: {
      marginTop: 24,
      width: '100%',
      backgroundColor: Brand.orange,
      borderRadius: Radius.md,
      paddingVertical: 14,
      alignItems: 'center',
    },
    primaryText: {
      color: Brand.white,
      fontWeight: '800',
      fontSize: 15,
    },
    disabled: { opacity: 0.7 },
    ghostBtn: { marginTop: 10, paddingVertical: 10 },
    ghostText: { color: colors.mutedForeground, fontWeight: '700' },
  });
}
