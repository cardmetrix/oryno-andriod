import { useCallback, useRef, useState, type ReactNode } from 'react';
import {
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
  type ScrollViewProps,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { OrynoRefreshIcon } from '@/components/app/oryno-refresh-icon';

const THRESHOLD = 72;
const MAX_PULL = 120;
const INDICATOR_SLOT = 56;

type Props = {
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void | Promise<void>;
  contentContainerStyle?: ScrollViewProps['contentContainerStyle'];
  style?: StyleProp<ViewStyle>;
  keyboardShouldPersistTaps?: ScrollViewProps['keyboardShouldPersistTaps'];
  keyboardDismissMode?: ScrollViewProps['keyboardDismissMode'];
  showsVerticalScrollIndicator?: boolean;
  removeClippedSubviews?: ScrollViewProps['removeClippedSubviews'];
};

/**
 * Branded pull-to-refresh — same behaviour as website `PullToRefresh`:
 * indicator sits in a slot above content (never overlays it).
 */
export function OrynoPullToRefresh({
  children,
  refreshing: refreshingProp = false,
  onRefresh,
  contentContainerStyle,
  style,
  keyboardShouldPersistTaps = 'handled',
  keyboardDismissMode,
  showsVerticalScrollIndicator = false,
  removeClippedSubviews,
}: Props) {
  const [localRefreshing, setLocalRefreshing] = useState(false);
  const busyRef = useRef(false);
  const atTop = useSharedValue(true);
  const pull = useSharedValue(0);
  const [pullUi, setPullUi] = useState(0);

  const refreshing = localRefreshing || refreshingProp;

  const syncPullUi = useCallback((value: number) => {
    setPullUi(value);
  }, []);

  const resetPull = useCallback(() => {
    pull.value = withTiming(0, { duration: 220 });
    setPullUi(0);
  }, [pull]);

  const triggerRefresh = useCallback(() => {
    if (busyRef.current || !onRefresh) return;
    busyRef.current = true;
    pull.value = THRESHOLD;
    setPullUi(THRESHOLD);
    setLocalRefreshing(true);

    void (async () => {
      try {
        await onRefresh();
        await new Promise((r) => setTimeout(r, 350));
      } finally {
        busyRef.current = false;
        setLocalRefreshing(false);
        resetPull();
      }
    })();
  }, [onRefresh, pull, resetPull]);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => {
      atTop.value = e.contentOffset.y <= 2;
    },
  });

  const pan = Gesture.Pan()
    .activeOffsetY(10)
    .failOffsetX([-20, 20])
    .enabled(Boolean(onRefresh) && !refreshing)
    .onUpdate((e) => {
      'worklet';
      if (!atTop.value || e.translationY <= 0) {
        if (pull.value !== 0) {
          pull.value = 0;
          runOnJS(syncPullUi)(0);
        }
        return;
      }
      const resisted = Math.min(MAX_PULL, e.translationY * 0.55);
      pull.value = resisted;
      runOnJS(syncPullUi)(resisted);
    })
    .onEnd(() => {
      'worklet';
      if (pull.value >= THRESHOLD) {
        runOnJS(triggerRefresh)();
        return;
      }
      pull.value = withTiming(0, { duration: 200 });
      runOnJS(syncPullUi)(0);
    });

  const native = Gesture.Native();
  const composed = Gesture.Simultaneous(pan, native);

  const progress = Math.min(1, (refreshing ? THRESHOLD : pullUi) / THRESHOLD);
  const show = refreshing || pullUi > 4;
  const slotHeight = refreshing
    ? INDICATOR_SLOT
    : show
      ? Math.min(Math.max(pullUi * 0.85, 0), INDICATOR_SLOT + 16)
      : 0;

  const contentShift = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: refreshing ? 0 : Math.min(pull.value * 0.12, 10),
      },
    ],
  }));

  return (
    <View style={[styles.flex, style]}>
      <View
        style={[
          styles.slot,
          {
            height: slotHeight,
            opacity: show ? 1 : 0,
          },
        ]}
        pointerEvents="none">
        <OrynoRefreshIcon
          progress={progress}
          refreshing={refreshing}
          size={40}
        />
      </View>

      <GestureDetector gesture={composed}>
        <Animated.ScrollView
          style={styles.flex}
          contentContainerStyle={contentContainerStyle}
          keyboardShouldPersistTaps={keyboardShouldPersistTaps}
          keyboardDismissMode={keyboardDismissMode}
          showsVerticalScrollIndicator={showsVerticalScrollIndicator}
          removeClippedSubviews={removeClippedSubviews}
          scrollEventThrottle={16}
          onScroll={scrollHandler}
          bounces={!onRefresh}
          overScrollMode={onRefresh ? 'never' : 'auto'}>
          <Animated.View style={contentShift}>{children}</Animated.View>
        </Animated.ScrollView>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  slot: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
