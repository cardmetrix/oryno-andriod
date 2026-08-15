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
  /** Fixed top bar (e.g. PageHeader). Stays pinned while content scrolls. */
  header?: ReactNode;
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
  header,
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
      contentContainerStyle={[
        styles.scrollContent,
        {
          paddingBottom: scrollBottomPad,
          paddingTop: header ? 12 : 0,
        },
      ]}
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
    <View style={[styles.flex, header ? styles.bodyAfterHeader : null]}>{content}</View>
  );

  const shell = (
    <View style={styles.flex}>
      {header ? (
        <View
          style={[
            styles.headerBar,
            padded && styles.padded,
            {
              backgroundColor: colors.background,
              borderBottomColor: colors.border,
            },
          ]}>
          {header}
        </View>
      ) : null}
      {body}
      {footer ? (
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
      ) : null}
    </View>
  );

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.background }]}
      edges={inAdmin ? ['left', 'right'] : ['top', 'left', 'right']}>
      {header || footer ? shell : body}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  padded: { paddingHorizontal: 16 },
  scrollContent: { flexGrow: 1 },
  bodyAfterHeader: { paddingTop: 12 },
  headerBar: {
    paddingTop: 2,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    zIndex: 20,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
