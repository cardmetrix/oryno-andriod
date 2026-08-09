import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';

import { Radius } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';

type Props = TextInputProps & {
  label?: string;
  error?: string;
  /** Show eye icon to toggle password visibility when secureTextEntry is used. */
  secureToggle?: boolean;
};

export function TextField({
  label,
  error,
  style,
  secureTextEntry,
  secureToggle,
  ...props
}: Props) {
  const { colors } = useAppTheme();
  const [visible, setVisible] = useState(false);
  const showToggle = Boolean(secureToggle && secureTextEntry);
  const isSecure = Boolean(secureTextEntry) && !(showToggle && visible);

  return (
    <View style={styles.wrap}>
      {label ? (
        <Text style={[styles.label, { color: colors.foreground }]}>{label}</Text>
      ) : null}
      <View style={styles.inputRow}>
        <TextInput
          placeholderTextColor={colors.mutedForeground}
          style={[
            styles.input,
            {
              backgroundColor: colors.muted,
              color: colors.foreground,
              borderColor: error ? colors.danger : 'transparent',
            },
            showToggle && styles.inputWithToggle,
            style,
          ]}
          secureTextEntry={isSecure}
          {...props}
        />
        {showToggle ? (
          <Pressable
            onPress={() => setVisible((v) => !v)}
            style={({ pressed }) => [styles.toggle, pressed && { opacity: 0.7 }]}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={visible ? 'Hide password' : 'Show password'}>
            <Ionicons
              name={visible ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={colors.mutedForeground}
            />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text style={[styles.error, { color: colors.danger }]}>{error}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  label: { fontSize: 13, fontWeight: '600' },
  inputRow: {
    position: 'relative',
    justifyContent: 'center',
  },
  input: {
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    borderWidth: 1.5,
  },
  inputWithToggle: {
    paddingRight: 40,
  },
  toggle: {
    position: 'absolute',
    right: 12,
    height: 36,
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
  },
  error: { fontSize: 12 },
});
