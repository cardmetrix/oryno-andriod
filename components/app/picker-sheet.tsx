import { Ionicons } from '@expo/vector-icons';
import { useState, type ReactNode } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ServiceLogo } from '@/components/app/service-logo';
import { Brand } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';

type PickerSheetProps = {
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  /** Optional header accessory (e.g. filter chips) rendered under the title row. */
  headerExtra?: ReactNode;
  /** Full-screen sheet (services). Default is a bottom sheet. */
  fullScreen?: boolean;
};

/** Bottom sheet chrome matching notifications / add-bank form sheets. */
export function PickerSheet({
  visible,
  title,
  subtitle,
  onClose,
  children,
  headerExtra,
  fullScreen = false,
}: PickerSheetProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={!fullScreen}
      presentationStyle={fullScreen ? 'fullScreen' : 'overFullScreen'}
      onRequestClose={onClose}
      statusBarTranslucent>
      <View style={[styles.root, fullScreen && styles.rootFull]}>
        {!fullScreen ? (
          <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Dismiss" />
        ) : null}
        <View
          style={[
            styles.sheet,
            fullScreen && styles.sheetFull,
            {
              backgroundColor: colors.card,
              paddingTop: fullScreen ? Math.max(insets.top, 8) : 0,
              paddingBottom: Math.max(insets.bottom, 12),
            },
          ]}>
          {!fullScreen ? (
            Platform.OS === 'android' ? (
              <View style={styles.handleWrap}>
                <View style={[styles.handle, { backgroundColor: colors.mutedForeground }]} />
              </View>
            ) : (
              <View style={styles.handleSpacer} />
            )
          ) : (
            <View style={styles.handleSpacerFull} />
          )}

          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <View style={styles.headerCopy}>
              <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
              {subtitle ? (
                <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
                  {subtitle}
                </Text>
              ) : null}
            </View>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [
                styles.closeBtn,
                { backgroundColor: colors.muted },
                pressed && { opacity: 0.75 },
              ]}
              accessibilityLabel="Close"
              hitSlop={8}>
              <Ionicons name="close" size={18} color={colors.foreground} />
            </Pressable>
          </View>

          {headerExtra ? <View style={styles.headerExtra}>{headerExtra}</View> : null}

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[
              styles.scrollContent,
              fullScreen && styles.scrollContentFull,
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export type PickerOption = {
  id: string;
  title: string;
  subtitle?: string;
  image?: string | null;
  domain?: string | null;
  imageFallbacks?: string[] | null;
  trailing?: string;
};

type OptionListProps = {
  options: PickerOption[];
  value: string;
  onChange: (id: string) => void;
  emptyText?: string;
  loading?: boolean;
};

export function PickerOptionList({
  options,
  value,
  onChange,
  emptyText = 'No options available',
  loading,
}: OptionListProps) {
  const { colors, isDark } = useAppTheme();

  if (loading) {
    return (
      <View style={styles.list}>
        {Array.from({ length: 5 }).map((_, i) => (
          <View key={i} style={[styles.skelRow, { backgroundColor: colors.muted }]}>
            <View
              style={[
                styles.skelAvatar,
                { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(28,28,30,0.08)' },
              ]}
            />
            <View style={styles.skelLines}>
              <View
                style={[
                  styles.skelLineWide,
                  { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(28,28,30,0.1)' },
                ]}
              />
              <View
                style={[
                  styles.skelLineNarrow,
                  { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(28,28,30,0.08)' },
                ]}
              />
            </View>
          </View>
        ))}
      </View>
    );
  }

  if (!options.length) {
    return (
      <View style={styles.empty}>
        <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>{emptyText}</Text>
      </View>
    );
  }

  return (
    <View style={styles.list}>
      {options.map((option) => {
        const selected = value === option.id;
        return (
          <Pressable
            key={option.id}
            onPress={() => onChange(option.id)}
            style={({ pressed }) => [
              styles.row,
              {
                borderColor: selected ? Brand.orange : colors.border,
                backgroundColor: selected ? Brand.orangeMuted : colors.card,
              },
              pressed && { opacity: 0.92 },
            ]}>
            {option.image !== undefined ? (
              <ServiceLogo
                src={option.image}
                alt={option.title}
                domain={option.domain}
                fallbacks={option.imageFallbacks}
                fallback={option.title}
                size={40}
              />
            ) : null}
            <View style={styles.rowBody}>
              <Text style={[styles.rowTitle, { color: colors.foreground }]} numberOfLines={2}>
                {option.title}
              </Text>
              {option.subtitle ? (
                <Text style={[styles.rowSub, { color: colors.mutedForeground }]} numberOfLines={1}>
                  {option.subtitle}
                </Text>
              ) : null}
            </View>
            {option.trailing ? (
              <Text style={styles.rowTrailing}>{option.trailing}</Text>
            ) : null}
            {selected ? (
              <View style={styles.check}>
                <Ionicons name="checkmark" size={14} color={Brand.white} />
              </View>
            ) : (
              <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

type TriggerProps = {
  label: string;
  valueLabel?: string;
  hint?: string;
  loading?: boolean;
  disabled?: boolean;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  /** Optional provider/network logo shown on the closed field. */
  image?: string | null;
  domain?: string | null;
  imageFallbacks?: string[] | null;
  showLogo?: boolean;
};

/** Compact field that opens a picker sheet. */
export function PickerTrigger({
  label,
  valueLabel,
  hint,
  loading,
  disabled,
  onPress,
  icon = 'chevron-down',
  image,
  domain,
  imageFallbacks,
  showLogo,
}: TriggerProps) {
  const { colors } = useAppTheme();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.trigger,
        { borderColor: colors.border, backgroundColor: colors.muted },
        (disabled || loading) && styles.triggerDisabled,
        pressed && !disabled && { opacity: 0.92 },
      ]}>
      {showLogo ? (
        <ServiceLogo
          key={`${valueLabel || label}-${image || domain || 'fallback'}`}
          src={image}
          alt={valueLabel || label}
          domain={domain}
          fallbacks={imageFallbacks}
          fallback={valueLabel || label}
          size={36}
        />
      ) : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[styles.triggerLabel, { color: colors.mutedForeground }]}>{label}</Text>
        {loading ? (
          <View style={styles.triggerSkel}>
            <View style={[styles.triggerSkelBar, { backgroundColor: colors.border }]} />
          </View>
        ) : (
          <Text style={[styles.triggerValue, { color: colors.foreground }]} numberOfLines={1}>
            {valueLabel || hint || 'Tap to select'}
          </Text>
        )}
      </View>
      <Ionicons name={icon} size={18} color={Brand.orange} />
    </Pressable>
  );
}

/** Convenience: trigger + sheet + option list with local open state. */
export function SelectSheet({
  label,
  title,
  subtitle,
  hint,
  options,
  value,
  valueLabel,
  onChange,
  loading,
  disabled,
  emptyText,
  headerExtra,
  fullScreen = true,
}: {
  label: string;
  title: string;
  subtitle?: string;
  hint?: string;
  options: PickerOption[];
  value: string;
  /** Override trigger label when the selected item isn’t in the current options list. */
  valueLabel?: string;
  onChange: (id: string) => void;
  loading?: boolean;
  disabled?: boolean;
  emptyText?: string;
  headerExtra?: ReactNode;
  /** Services use full-screen pickers by default. */
  fullScreen?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.id === value);
  const showLogo = options.some((o) => o.image !== undefined);

  return (
    <>
      <PickerTrigger
        label={label}
        valueLabel={valueLabel ?? selected?.title}
        hint={hint}
        loading={loading}
        disabled={disabled}
        onPress={() => setOpen(true)}
        showLogo={showLogo && Boolean(value)}
        image={selected?.image}
        domain={selected?.domain}
        imageFallbacks={selected?.imageFallbacks}
      />
      <PickerSheet
        visible={open}
        title={title}
        subtitle={subtitle}
        onClose={() => setOpen(false)}
        headerExtra={headerExtra}
        fullScreen={fullScreen}>
        <PickerOptionList
          options={options}
          value={value}
          loading={loading}
          emptyText={emptyText}
          onChange={(id) => {
            onChange(id);
            setOpen(false);
          }}
        />
      </PickerSheet>
    </>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  rootFull: {
    justifyContent: 'flex-start',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(28,28,30,0.45)',
  },
  sheet: {
    height: '78%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
  },
  sheetFull: {
    flex: 1,
    height: '100%',
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
  },
  handleWrap: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 4,
  },
  handle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    opacity: 0.35,
  },
  handleSpacer: { height: 10 },
  handleSpacerFull: { height: 4 },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 12,
    paddingTop: 4,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerCopy: { flex: 1, minWidth: 0 },
  title: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  subtitle: {
    marginTop: 3,
    fontSize: 13,
    fontWeight: '500',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerExtra: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 4,
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 12,
    flexGrow: 1,
  },
  scrollContentFull: {
    paddingBottom: 24,
  },
  list: { gap: 8 },
  skelRow: {
    height: 64,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
  },
  skelAvatar: {
    width: 40,
    height: 40,
    borderRadius: 16,
  },
  skelLines: { flex: 1, gap: 8 },
  skelLineWide: {
    height: 12,
    width: '72%',
    borderRadius: 6,
  },
  skelLineNarrow: {
    height: 10,
    width: '44%',
    borderRadius: 6,
  },
  triggerSkel: { marginTop: 4 },
  triggerSkelBar: {
    height: 14,
    width: '55%',
    borderRadius: 7,
  },
  empty: { paddingVertical: 28, alignItems: 'center' },
  emptyText: { fontSize: 14, fontWeight: '600' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  rowBody: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 14, fontWeight: '700' },
  rowSub: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  rowTrailing: { fontSize: 13, fontWeight: '800', color: Brand.orange },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Brand.orange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  triggerDisabled: { opacity: 0.6 },
  triggerLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  triggerValue: {
    marginTop: 3,
    fontSize: 15,
    fontWeight: '700',
  },
});
