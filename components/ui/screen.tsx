import { useSegments } from 'expo-router';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type ViewProps,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppTheme } from '@/context/theme-context';

type Props = ViewProps & {
  scroll?: boolean;
  padded?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  /** Soft content enter motion (default true). */
  animate?: boolean;
};

export function Screen({
  children,
  scroll,
  padded = true,
  refreshing,
  onRefresh,
  animate = true,
  style,
  ...props
}: Props) {
  const { colors } = useAppTheme();
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

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.background }]}
      edges={inAdmin ? ['left', 'right'] : ['top', 'left', 'right']}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: inTabs || inAdmin ? 118 : 32 },
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
        content
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  padded: { paddingHorizontal: 20 },
  scrollContent: { flexGrow: 1 },
});
