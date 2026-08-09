import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInUp, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Brand, Radius } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';
import {
  dismissAlert,
  setAlertListener,
  type AlertButton,
  type AlertPayload,
  type AlertTone,
} from '@/lib/alert';

const TONE: Record<
  AlertTone,
  {
    icon: keyof typeof Ionicons.glyphMap;
    color: string;
    well: string;
  }
> = {
  error: {
    icon: 'close-circle',
    color: Brand.error,
    well: 'rgba(255,59,48,0.12)',
  },
  success: {
    icon: 'checkmark-circle',
    color: Brand.success,
    well: 'rgba(52,199,89,0.12)',
  },
  warning: {
    icon: 'warning',
    color: '#E6A100',
    well: 'rgba(255,204,0,0.18)',
  },
  info: {
    icon: 'information-circle',
    color: Brand.orange,
    well: Brand.orangeMuted,
  },
  confirm: {
    icon: 'help-circle',
    color: Brand.orange,
    well: Brand.orangeMuted,
  },
};

function buttonVariant(btn: AlertButton, index: number, total: number) {
  if (btn.style === 'cancel') return 'ghost' as const;
  if (btn.style === 'destructive') return 'destructive' as const;
  if (index === total - 1 || btn.style === 'default') return 'primary' as const;
  return 'secondary' as const;
}

/** Global alert / error sheet host — mount once near the root. */
export function AlertSheetHost() {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const [payload, setPayload] = useState<AlertPayload | null>(null);

  useEffect(() => {
    setAlertListener(setPayload);
    return () => setAlertListener(null);
  }, []);

  const visible = Boolean(payload);
  const tone = payload ? TONE[payload.tone] : TONE.info;
  const buttons = payload?.buttons ?? [];

  const onDismiss = () => {
    if (payload?.dismissible === false) return;
    dismissAlert();
  };

  const onPressButton = (btn: AlertButton) => {
    dismissAlert();
    requestAnimationFrame(() => {
      btn.onPress?.();
    });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
      statusBarTranslucent>
      {payload ? (
        <View
          style={[
            styles.root,
            {
              paddingTop: insets.top + 24,
              paddingBottom: Math.max(insets.bottom, 24),
            },
          ]}>
          <Animated.View
            entering={FadeIn.duration(180)}
            exiting={FadeOut.duration(140)}
            style={StyleSheet.absoluteFill}>
            <Pressable
              style={styles.backdrop}
              onPress={onDismiss}
              accessibilityLabel="Dismiss alert"
            />
          </Animated.View>

          <Animated.View
            key={payload.id}
            entering={FadeInUp.duration(280).springify().damping(16)}
            style={[
              styles.card,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}>
            <Pressable
              onPress={onDismiss}
              style={({ pressed }) => [
                styles.closeBtn,
                { backgroundColor: colors.muted },
                pressed && { opacity: 0.7 },
              ]}
              accessibilityLabel="Close"
              hitSlop={10}>
              <Ionicons name="close" size={18} color={colors.mutedForeground} />
            </Pressable>

            <View style={styles.logoWrap}>
              <View style={[styles.logoBorder, { borderColor: colors.border }]}>
                <Image
                  source={require('@/assets/images/oryno-icon.png')}
                  style={styles.logo}
                  contentFit="cover"
                />
              </View>
            </View>

            <Text style={[styles.title, { color: colors.foreground }]}>{payload.title}</Text>
            {payload.message ? (
              <Text style={[styles.message, { color: colors.mutedForeground }]}>
                {payload.message}
              </Text>
            ) : null}

            <View style={styles.actions}>
              {buttons.map((btn, index) => {
                const variant = buttonVariant(btn, index, buttons.length);
                return (
                  <Pressable
                    key={`${btn.text}-${index}`}
                    onPress={() => onPressButton(btn)}
                    style={({ pressed }) => [
                      styles.btn,
                      variant === 'primary' && styles.btnPrimary,
                      variant === 'secondary' && { backgroundColor: colors.muted },
                      variant === 'destructive' && styles.btnDestructive,
                      variant === 'ghost' && {
                        backgroundColor: 'transparent',
                        borderWidth: 1,
                        borderColor: colors.border,
                      },
                      pressed && styles.btnPressed,
                    ]}>
                    <Text
                      style={[
                        styles.btnText,
                        variant === 'primary' && { color: Brand.white },
                        variant === 'secondary' && { color: colors.foreground },
                        variant === 'destructive' && { color: Brand.white },
                        variant === 'ghost' && {
                          color: colors.mutedForeground,
                          fontWeight: '600',
                        },
                      ]}>
                      {btn.text}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Animated.View>
        </View>
      ) : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(28,28,30,0.55)',
  },
  card: {
    borderRadius: 28,
    paddingHorizontal: 12,
    paddingTop: 14,
    paddingBottom: 14,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#0F0F12',
    shadowOpacity: 0.2,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 16 },
    elevation: 20,
  },
  closeBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  logoWrap: {
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoBorder: {
    width: 72,
    height: 72,
    borderRadius: 18,
    borderWidth: 2,
    overflow: 'hidden',
    backgroundColor: Brand.orange,
  },
  logo: {
    width: '100%',
    height: '100%',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  message: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    textAlign: 'center',
    paddingHorizontal: 4,
    maxWidth: 280,
  },
  actions: {
    marginTop: 14,
    width: '100%',
    gap: 10,
    alignItems: 'stretch',
  },
  btn: {
    minHeight: 44,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  btnPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.985 }],
  },
  btnPrimary: {
    backgroundColor: Brand.orange,
    shadowColor: Brand.orange,
    shadowOpacity: 0.3,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  btnDestructive: {
    backgroundColor: Brand.error,
    shadowColor: Brand.error,
    shadowOpacity: 0.22,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  btnText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
});
