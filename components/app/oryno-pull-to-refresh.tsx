import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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
 *
 * Pull distance + slot height stay on the UI thread so React does not
 * re-layout the dashboard on every pan frame (avoids shake on refresh).
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
  removeClippedSubviews = false,
}: Props) {
  const [localRefreshing, setLocalRefreshing] = useState(false);
  const busyRef = useRef(false);
  const atTop = useSharedValue(true);
  const pull = useSharedValue(0);
  const refreshingSV = useSharedValue(false);

  const refreshing = localRefreshing || refreshingProp;

  useEffect(() => {
    refreshingSV.value = refreshing;
  }, [refreshing, refreshingSV]);

  const resetPull = useCallback(() => {
    pull.value = withTiming(0, { duration: 220 });
  }, [pull]);

  const triggerRefresh = useCallback(() => {
    if (busyRef.current || !onRefresh) return;
    busyRef.current = true;
    pull.value = THRESHOLD;
    refreshingSV.value = true;
    setLocalRefreshing(true);

    void (async () => {
      try {
        await onRefresh();
        await new Promise((r) => setTimeout(r, 350));
      } finally {
        busyRef.current = false;
        refreshingSV.value = false;
        setLocalRefreshing(false);
        resetPull();
      }
    })();
  }, [onRefresh, pull, refreshingSV, resetPull]);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => {
      atTop.value = e.contentOffset.y <= 2;
    },
  });

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY(10)
        .failOffsetX([-20, 20])
        .enabled(Boolean(onRefresh) && !refreshing)
        .onUpdate((e) => {
          'worklet';
          if (!atTop.value || e.translationY <= 0) {
            if (pull.value !== 0) {
              pull.value = 0;
            }
            return;
          }
          pull.value = Math.min(MAX_PULL, e.translationY * 0.55);
        })
        .onEnd(() => {
          'worklet';
          if (pull.value >= THRESHOLD) {
            runOnJS(triggerRefresh)();
            return;
          }
          pull.value = withTiming(0, { duration: 200 });
        }),
    [atTop, onRefresh, pull, refreshing, triggerRefresh],
  );

  const native = useMemo(() => Gesture.Native(), []);
  const composed = useMemo(
    () => Gesture.Simultaneous(pan, native),
    [native, pan],
  );

  const slotStyle = useAnimatedStyle(() => {
    const active = refreshingSV.value;
    const p = active ? THRESHOLD : pull.value;
    const show = active || p > 4;
    const height = active
      ? INDICATOR_SLOT
      : show
        ? Math.min(Math.max(p * 0.85, 0), INDICATOR_SLOT + 16)
        : 0;
    return {
      height,
      opacity: show ? 1 : 0,
    };
  });

  const contentShift = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: refreshingSV.value
          ? 0
          : Math.min(pull.value * 0.12, 10),
      },
    ],
  }));

  return (
    <View style={[styles.flex, style]}>
      <Animated.View style={[styles.slot, slotStyle]} pointerEvents="none">
        <OrynoRefreshIcon
          pull={pull}
          refreshing={refreshing}
          threshold={THRESHOLD}
          size={40}
        />
      </Animated.View>

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
