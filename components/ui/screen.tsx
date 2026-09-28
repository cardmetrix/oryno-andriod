import type { ReactNode } from 'react';
import { useRef } from 'react';
import { useSegments } from 'expo-router';
import { RefreshControl, ScrollView, StyleSheet, View, type ViewProps } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Brand } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';

type Props = ViewProps & {
  scroll?: boolean;
  padded?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  /**
   * Soft content enter motion. Default: only on tab root screens.
   * Stack pushes rely on native transitions — JS enter animations fight them.
   */
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
  animate,
  header,
  footer,
  style,
  ...props
}: Props) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const segments = useSegments() as string[];
  const inTabs = segments.includes('(tabs)');
  /** Let native stack own motion on pushed screens. */
  const shouldAnimate = animate ?? inTabs;
  /** Enter once — remounting FadeIn on data refresh causes dashboard shake. */
  const enteredRef = useRef(false);
  const entering =
    shouldAnimate && !enteredRef.current
      ? FadeIn.duration(180)
      : undefined;
  if (shouldAnimate && !enteredRef.current) {
    enteredRef.current = true;
  }

  const content = (
    <Animated.View
      entering={entering}
      style={[padded && styles.padded, style]}
      {...props}>
      {children}
    </Animated.View>
  );

  const scrollBottomPad = footer
    ? 20
    : inTabs
      ? 108
      : 28;

  const scrollContentStyle = [
    styles.scrollContent,
    {
      paddingBottom: scrollBottomPad,
      paddingTop: header ? 12 : 0,
    },
  ];

  const scrollProps = {
    style: styles.flex,
    contentContainerStyle: scrollContentStyle,
    keyboardShouldPersistTaps: 'handled' as const,
    keyboardDismissMode: 'on-drag' as const,
    showsVerticalScrollIndicator: false,
    /**
     * Off for scroll screens — Android clipped-subview recycling
     * flickers/shakes when wallet + list content updates mid-refresh.
     */
    removeClippedSubviews: false as const,
  };

  const body = scroll ? (
    <ScrollView
      {...scrollProps}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={Boolean(refreshing)}
            onRefresh={onRefresh}
            tintColor={Brand.orange}
            colors={[Brand.orange]}
            progressBackgroundColor={colors.card}
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
      edges={['top', 'left', 'right']}>
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
