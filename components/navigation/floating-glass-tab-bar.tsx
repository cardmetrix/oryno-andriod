import { Ionicons } from '@expo/vector-icons';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { Radius } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';

/** Lucide `Home` paths (same glyph as `lucide-react`). */
function LucideHome({
  size,
  color,
  strokeWidth,
}: {
  size: number;
  color: string;
  strokeWidth: number;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M15 20v-7a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v7"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="butt"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  cards: 'card',
  services: 'grid',
  history: 'time',
  profile: 'person',
};

const OUTLINE: Record<string, keyof typeof Ionicons.glyphMap> = {
  cards: 'card-outline',
  services: 'grid-outline',
  history: 'time-outline',
  profile: 'person-outline',
};

export function FloatingGlassTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useAppTheme();
  const bottom = Math.max(insets.bottom, 10);

  const shell = {
    borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.65)',
    backgroundColor: isDark ? colors.card : 'rgba(255,255,255,0.55)',
    shadowOpacity: isDark ? 0.5 : 0.14,
  };

  const glassFill = isDark ? 'rgba(23,23,27,0.94)' : 'rgba(255,255,255,0.88)';
  const glassTint = isDark ? 'rgba(15,15,18,0.45)' : 'rgba(255,255,255,0.28)';

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { paddingBottom: bottom }]}>
      <View style={[styles.shadow, { shadowOpacity: shell.shadowOpacity }]}>
        <View
          style={[
            styles.clip,
            {
              borderColor: shell.borderColor,
              backgroundColor: shell.backgroundColor,
            },
          ]}>
          {Platform.OS === 'web' ? (
            <View style={[styles.glass, { backgroundColor: glassFill }]} />
          ) : (
            <BlurView
              intensity={isDark ? 36 : 56}
              tint={isDark ? 'dark' : 'light'}
              experimentalBlurMethod="dimezisBlurView"
              style={StyleSheet.absoluteFill}
            />
          )}
          <View style={[styles.glassTint, { backgroundColor: glassTint }]} />
          <View style={styles.row}>
            {state.routes.map((route, index) => {
              const { options } = descriptors[route.key];
              const label =
                typeof options.tabBarLabel === 'string'
                  ? options.tabBarLabel
                  : options.title ?? route.name;
              const focused = state.index === index;
              const color = focused ? colors.tint : colors.mutedForeground;
              const icon =
                route.name === 'index' ? (
                  <LucideHome size={22} color={color} strokeWidth={focused ? 2.25 : 1.75} />
                ) : (
                  <Ionicons
                    name={
                      focused
                        ? ICONS[route.name] ?? 'ellipse'
                        : OUTLINE[route.name] ?? 'ellipse-outline'
                    }
                    size={22}
                    color={color}
                  />
                );

              const onPress = () => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!focused && !event.defaultPrevented) {
                  if (process.env.EXPO_OS === 'ios') {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }
                  navigation.navigate(route.name, route.params);
                }
              };

              return (
                <TabItem
                  key={route.key}
                  label={label}
                  icon={icon}
                  focused={focused}
                  onPress={onPress}
                  activeColor={colors.tint}
                  inactiveColor={colors.mutedForeground}
                  pillColor={colors.orangeMuted}
                />
              );
            })}
          </View>
        </View>
      </View>
    </View>
  );
}

function TabItem({
  label,
  icon,
  focused,
  onPress,
  activeColor,
  inactiveColor,
  pillColor,
}: {
  label: string;
  icon: ReactNode;
  focused: boolean;
  onPress: () => void;
  activeColor: string;
  inactiveColor: string;
  pillColor: string;
}) {
  const scale = useSharedValue(1);

  const anim = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={focused ? { selected: true } : {}}
      onPress={onPress}
      onPressIn={() => {
        scale.value = withSpring(0.92, { damping: 16, stiffness: 320 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 14, stiffness: 260 });
      }}
      style={styles.item}>
      <Animated.View style={[styles.itemInner, anim]}>
        {focused ? (
          <Animated.View
            entering={FadeIn.duration(180)}
            style={[styles.activePill, { backgroundColor: pillColor }]}
          />
        ) : null}
        {icon}
        <Text
          style={[
            styles.label,
            { color: focused ? activeColor : inactiveColor },
            focused && styles.labelActive,
          ]}
          numberOfLines={1}>
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 18,
    backgroundColor: 'transparent',
  },
  shadow: {
    borderRadius: Radius.phone,
    shadowColor: '#0F0F12',
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 14,
  },
  clip: {
    borderRadius: Radius.phone,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  glass: {
    ...StyleSheet.absoluteFillObject,
  },
  glassTint: {
    ...StyleSheet.absoluteFillObject,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
    paddingVertical: 8,
    minHeight: 66,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemInner: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 18,
    minWidth: 58,
  },
  activePill: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 18,
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  labelActive: {
    fontWeight: '700',
  },
});
