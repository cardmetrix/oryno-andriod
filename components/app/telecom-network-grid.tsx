import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { ServiceLogo } from '@/components/app/service-logo';
import type { VtpassServiceOption } from '@/components/app/vtpass-service-picker';
import { Brand, type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';

type Props = {
  services: VtpassServiceOption[];
  value: string;
  onChange: (serviceID: string) => void;
  loading?: boolean;
};

const GAP = 10;
const H_PAD = 0;

/** Compact logo tiles matching website `TelecomNetworkGrid`. */
export function TelecomNetworkGrid({
  services,
  value,
  onChange,
  loading,
}: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { width: windowWidth } = useWindowDimensions();
  const columns = services.length <= 2 ? 2 : services.length === 3 ? 3 : 4;
  // Screen content typically has ~16–20px horizontal padding from Screen.
  const contentWidth = Math.max(windowWidth - 40, 280);
  const tileWidth = (contentWidth - GAP * (columns - 1) - H_PAD) / columns;

  if (loading) {
    return (
      <View style={styles.grid}>
        {Array.from({ length: 4 }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.skel,
              { width: (contentWidth - GAP * 3) / 4, aspectRatio: 1 },
            ]}
          />
        ))}
      </View>
    );
  }

  if (!services.length) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No networks available</Text>
      </View>
    );
  }

  return (
    <View style={styles.grid}>
      {services.map((service, index) => {
        const selected = value === service.serviceID;
        return (
          <Animated.View
            key={service.serviceID}
            entering={FadeInDown.delay(Math.min(index * 30, 200)).duration(280)}
            style={{ width: tileWidth }}>
            <Pressable
              onPress={() => onChange(service.serviceID)}
              style={({ pressed }) => [
                styles.tile,
                selected ? styles.tileSelected : styles.tileIdle,
                pressed && { opacity: 0.92, transform: [{ scale: 0.97 }] },
              ]}>
              <View style={styles.logoWrap}>
                <ServiceLogo
                  src={service.image}
                  alt={service.name}
                  domain={service.domain}
                  fallbacks={service.imageFallbacks}
                  fallback={service.name}
                  size={44}
                />
              </View>
              <Text
                style={[styles.name, selected && styles.nameSelected]}
                numberOfLines={1}>
                {service.name}
              </Text>
            </Pressable>
          </Animated.View>
        );
      })}
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: GAP,
    },
    tile: {
      alignItems: 'center',
      gap: 8,
      borderRadius: 16,
      paddingHorizontal: 8,
      paddingVertical: 12,
      borderWidth: 2,
    },
    tileIdle: {
      borderColor: 'transparent',
      backgroundColor: colors.muted,
    },
    tileSelected: {
      borderColor: Brand.orange,
      backgroundColor: 'rgba(255,106,0,0.12)',
    },
    skel: {
      borderRadius: 16,
      backgroundColor: colors.muted,
    },
    logoWrap: {
      width: 48,
      height: 48,
      borderRadius: 12,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    name: {
      maxWidth: '100%',
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.4,
      textTransform: 'uppercase',
      color: colors.foreground,
      textAlign: 'center',
    },
    nameSelected: { color: Brand.orange },
    empty: {
      borderRadius: 16,
      backgroundColor: colors.muted,
      paddingHorizontal: 16,
      paddingVertical: 28,
      alignItems: 'center',
    },
    emptyText: {
      fontSize: 13,
      fontWeight: '500',
      color: colors.mutedForeground,
    },
  });
}
