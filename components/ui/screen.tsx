import type { ReactNode } from 'react';
import { useSegments } from 'expo-router';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type ViewProps,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme } from '@/context/theme-context';

type Props = ViewProps & {
  scroll?: boolean;
  padded?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  /** Soft content enter motion (default true). */
  animate?: boolean;
  /** Fixed bottom bar (e.g. primary CTA). Stays pinned while content scrolls. */
  footer?: ReactNode;
};

export function Screen({
  children,
  scroll,
  padded = true,
  refreshing,
  onRefresh,
  animate = true,
  footer,
  style,
  ...props
}: Props) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const segments = useSegments() as string[];
  const inTabs = segments.includes('(tabs)');
  const inAdmin =
    segments.includes('admin') && !segments.includes('login');
  const content = (
    <Animated.View
      entering={
        animate
          ? FadeInDown.duration(inAdmin ? 200 : 280)
              .springify()
              .damping(inAdmin ? 20 : 18)
          : undefined
      }
      style={[padded && styles.padded, style]}
      {...props}>
      {children}
    </Animated.View>
  );

  const scrollBottomPad = footer
    ? 20
    : inTabs || inAdmin
      ? 108
      : 28;

  const body = scroll ? (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[styles.scrollContent, { paddingBottom: scrollBottomPad }]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={Boolean(refreshing)}
            onRefresh={onRefresh}
            tintColor={colors.orange}
          />
        ) : undefined
      }>
      {content}
    </ScrollView>
  ) : (
    <View style={styles.flex}>{content}</View>
  );

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.background }]}
      edges={inAdmin ? ['left', 'right'] : ['top', 'left', 'right']}>
      {footer ? (
        <View style={styles.flex}>
          {body}
          <View
            style={[
              styles.footer,
              {
                paddingBottom: Math.max(insets.bottom, 10),
                backgroundColor: colors.background,
                borderTopColor: colors.border,
              },
            ]}>
            {footer}
          </View>
        </View>
      ) : (
        body
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  padded: { paddingHorizontal: 16 },
  scrollContent: { flexGrow: 1 },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
