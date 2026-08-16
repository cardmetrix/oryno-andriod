import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Brand } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';
import {
  dismissToast,
  setToastListener,
  type ToastPayload,
  type ToastTone,
} from '@/lib/toast';

function getToneStyles(
  tone: ToastTone,
  isDark: boolean,
  colors: { card: string; border: string },
) {
  if (tone === 'success') {
    return {
      bg: isDark ? 'rgba(52,199,89,0.16)' : '#ECFDF3',
      border: 'rgba(52,199,89,0.28)',
      icon: 'checkmark-circle' as const,
      color: Brand.success,
    };
  }
  if (tone === 'error') {
    return {
      bg: isDark ? 'rgba(255,59,48,0.16)' : '#FEF3F2',
      border: 'rgba(255,59,48,0.28)',
      icon: 'alert-circle' as const,
      color: Brand.error,
    };
  }
  return {
    bg: colors.card,
    border: colors.border,
    icon: 'information-circle' as const,
    color: Brand.orange,
  };
}

/** Global toast host — mount once near the root (Sonner-equivalent). */
export function Toaster() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useAppTheme();
  const [toast, setToast] = useState<ToastPayload | null>(null);

  useEffect(() => {
    setToastListener(setToast);
    return () => setToastListener(null);
  }, []);

  if (!toast) return null;

  const tone = getToneStyles(toast.tone, isDark, colors);

  return (
    <View
      pointerEvents="box-none"
      style={[styles.host, { paddingTop: Math.max(insets.top, 12) + 8 }]}>
      <Animated.View
        key={toast.id}
        entering={FadeInUp.duration(220)}
        exiting={FadeOutUp.duration(180)}
        style={[styles.card, { backgroundColor: tone.bg }]}>
        <Ionicons name={tone.icon} size={20} color={tone.color} />
        <View style={styles.copy}>
          <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={2}>
            {toast.title}
          </Text>
          {toast.description ? (
            <Text
              style={[styles.description, { color: colors.mutedForeground }]}
              numberOfLines={3}>
              {toast.description}
            </Text>
          ) : null}
        </View>
        <Pressable
          onPress={dismissToast}
          hitSlop={8}
          style={styles.close}
          accessibilityLabel="Dismiss">
          <Ionicons name="close" size={16} color={colors.mutedForeground} />
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    elevation: 9999,
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: '#1C1C1E',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  copy: { flex: 1, minWidth: 0 },
  title: {
    fontSize: 14,
    fontWeight: '800',
  },
  description: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 17,
  },
  close: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
