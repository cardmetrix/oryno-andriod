import { Ionicons } from '@expo/vector-icons';
import * as Contacts from 'expo-contacts';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { PickerSheet } from '@/components/app/picker-sheet';
import { Brand, type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';
import { api } from '@/lib/api';
import { endpoints } from '@/lib/endpoints';

export type BeneficiaryOption = {
  id: string;
  phone: string;
  label: string | null;
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

function normalizeTel(raw: string) {
  return raw.replace(/[^\d+]/g, '');
}

/** Phone input with saved beneficiaries + device contacts — matches website `PhoneNumberField`. */
export function PhoneNumberField({
  value,
  onChange,
  placeholder = 'Phone number',
}: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [picking, setPicking] = useState(false);
  const [beneficiaries, setBeneficiaries] = useState<BeneficiaryOption[]>([]);
  const [loaded, setLoaded] = useState(false);

  const loadBeneficiaries = useCallback(async () => {
    if (loaded) return;
    setLoading(true);
    try {
      const json = await api.get<{ items?: BeneficiaryOption[] }>(
        endpoints.beneficiaries,
      );
      setBeneficiaries(json.items ?? []);
      setLoaded(true);
    } catch {
      // Typing / contacts still work if the list fails.
    } finally {
      setLoading(false);
    }
  }, [loaded]);

  useEffect(() => {
    if (open) void loadBeneficiaries();
  }, [open, loadBeneficiaries]);

  const pickContact = useCallback(async () => {
    setPicking(true);
    setOpen(false);
    try {
      const contact = await Contacts.presentContactPickerAsync();
      const tel =
        contact?.phoneNumbers?.find((p) => p.number)?.number ??
        contact?.phoneNumbers?.[0]?.number;
      if (tel) onChange(normalizeTel(tel));
    } catch {
      // User cancelled or unsupported — ignore.
    } finally {
      setPicking(false);
    }
  }, [onChange]);

  return (
    <View>
      <View style={styles.inputWrap}>
        <TextInput
          value={value}
          onChangeText={onChange}
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          placeholder={placeholder}
          placeholderTextColor={colors.mutedForeground}
          style={styles.input}
        />
        <Pressable
          onPress={() => setOpen(true)}
          disabled={picking}
          style={({ pressed }) => [
            styles.pickBtn,
            (pressed || picking) && { opacity: 0.6 },
          ]}
          accessibilityLabel="Choose beneficiary"
          hitSlop={6}>
          <Ionicons name="person-add-outline" size={20} color={colors.mutedForeground} />
        </Pressable>
      </View>

      <PickerSheet
        visible={open}
        title="Saved beneficiaries"
        subtitle="Pick a number you’ve used before"
        onClose={() => setOpen(false)}>
        {loading ? (
          <View style={styles.sheetState}>
            <ActivityIndicator color={Brand.orange} />
            <Text style={styles.sheetMuted}>Loading…</Text>
          </View>
        ) : beneficiaries.length === 0 ? (
          <View style={styles.sheetState}>
            <Text style={styles.sheetMuted}>No saved beneficiaries yet</Text>
            <Pressable onPress={() => void pickContact()} hitSlop={8}>
              <Text style={styles.pickLink}>Pick from contacts</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.list}>
            {beneficiaries.map((item) => {
              const active = value === item.phone;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => {
                    onChange(item.phone);
                    setOpen(false);
                  }}
                  style={[styles.item, active && styles.itemActive]}>
                  <Text style={styles.itemTitle} numberOfLines={1}>
                    {item.label?.trim() || item.phone}
                  </Text>
                  {item.label?.trim() ? (
                    <Text style={styles.itemSub} numberOfLines={1}>
                      {item.phone}
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}
            <Pressable
              onPress={() => void pickContact()}
              style={({ pressed }) => [styles.footerPick, pressed && { opacity: 0.75 }]}>
              <Text style={styles.pickLink}>Pick from contacts</Text>
            </Pressable>
          </View>
        )}
      </PickerSheet>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    inputWrap: {
      position: 'relative',
      justifyContent: 'center',
    },
    input: {
      height: 56,
      borderRadius: 16,
      backgroundColor: colors.muted,
      paddingHorizontal: 16,
      paddingRight: 56,
      fontSize: 15,
      fontWeight: '500',
      color: colors.foreground,
    },
    pickBtn: {
      position: 'absolute',
      right: 8,
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sheetState: {
      paddingVertical: 28,
      alignItems: 'center',
      gap: 10,
    },
    sheetMuted: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.mutedForeground,
      textAlign: 'center',
    },
    pickLink: {
      fontSize: 12,
      fontWeight: '700',
      color: Brand.orange,
    },
    list: {
      gap: 4,
      paddingBottom: 8,
    },
    footerPick: {
      marginTop: 4,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    item: {
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    itemActive: {
      backgroundColor: Brand.orangeMuted,
    },
    itemTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.foreground,
    },
    itemSub: {
      marginTop: 2,
      fontSize: 12,
      color: colors.mutedForeground,
    },
  });
}
