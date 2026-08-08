import { useEffect, useRef } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Brand, Radius } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';

type Props = {
  value: string;
  onChange: (code: string) => void;
  length?: number;
  autoFocus?: boolean;
  error?: boolean;
  onComplete?: (code: string) => void;
};

export function OtpInput({
  value,
  onChange,
  length = 6,
  autoFocus = true,
  error,
  onComplete,
}: Props) {
  const inputRef = useRef<TextInput>(null);
  const completedRef = useRef('');
  const digits = value.padEnd(length, ' ').slice(0, length).split('');

  const setDigit = (text: string) => {
    const cleaned = text.replace(/\D/g, '').slice(0, length);
    onChange(cleaned);
    if (cleaned.length === length && cleaned !== completedRef.current) {
      completedRef.current = cleaned;
      onComplete?.(cleaned);
    }
    if (cleaned.length < length) completedRef.current = '';
  };

  return (
    <Pressable style={styles.wrap} onPress={() => inputRef.current?.focus()}>
      <View style={styles.row}>
        {digits.map((digit, index) => (
          <OtpBox
            key={index}
            digit={digit === ' ' ? '' : digit}
            focused={value.length === index}
            filled={digit !== ' '}
            error={Boolean(error)}
          />
        ))}
      </View>
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={setDigit}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        maxLength={length}
        autoFocus={autoFocus}
        caretHidden
        style={styles.hidden}
      />
    </Pressable>
  );
}

function OtpBox({
  digit,
  focused,
  filled,
  error,
}: {
  digit: string;
  focused: boolean;
  filled: boolean;
  error: boolean;
}) {
  const { colors } = useAppTheme();
  const progress = useSharedValue(0);
  const scale = useSharedValue(1);
  const shake = useSharedValue(0);
  const caret = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(focused ? 1 : filled ? 0.55 : 0, {
      duration: 180,
      easing: Easing.out(Easing.cubic),
    });
  }, [focused, filled, progress]);

  useEffect(() => {
    if (!filled) return;
    scale.value = withSequence(
      withSpring(1.1, { damping: 12, stiffness: 240 }),
      withSpring(1, { damping: 14, stiffness: 200 }),
    );
  }, [filled, digit, scale]);

  useEffect(() => {
    if (focused) {
      caret.value = withRepeat(
        withSequence(withTiming(1, { duration: 420 }), withTiming(0, { duration: 420 })),
        -1,
        false,
      );
    } else {
      caret.value = withTiming(0, { duration: 120 });
    }
  }, [focused, caret]);

  useEffect(() => {
    if (!error) return;
    shake.value = withSequence(
      withTiming(-6, { duration: 40 }),
      withTiming(6, { duration: 40 }),
      withTiming(-4, { duration: 40 }),
      withTiming(4, { duration: 40 }),
      withTiming(0, { duration: 40 }),
    );
  }, [error, shake]);

  const boxStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shake.value }, { scale: scale.value }],
    borderColor: error
      ? Brand.error
      : interpolateColor(
          progress.value,
          [0, 0.55, 1],
          [colors.border, Brand.orangeSoft, Brand.orange],
        ),
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      [colors.muted, colors.orangeMuted],
    ),
    shadowOpacity: progress.value * 0.2,
  }));

  const caretStyle = useAnimatedStyle(() => ({
    opacity: caret.value,
  }));

  return (
    <Animated.View style={[styles.box, boxStyle]}>
      {digit ? (
        <Text style={[styles.digit, { color: colors.foreground }]}>{digit}</Text>
      ) : focused ? (
        <Animated.View style={[styles.caret, caretStyle]} />
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%' },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  box: {
    flex: 1,
    aspectRatio: 0.85,
    maxWidth: 52,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Brand.orange,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  digit: {
    fontSize: 24,
    fontWeight: '800',
  },
  caret: {
    width: 2,
    height: 22,
    borderRadius: 2,
    backgroundColor: Brand.orange,
  },
  hidden: {
    position: 'absolute',
    opacity: 0,
    height: 1,
    width: 1,
  },
});
