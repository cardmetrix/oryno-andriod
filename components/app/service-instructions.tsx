import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Brand, type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';
import {
  SERVICE_INSTRUCTIONS,
  type ServiceInstructionId,
} from '@/lib/service-instructions';

type Props = {
  service: ServiceInstructionId;
};

export function ServiceInstructions({ service }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const content = SERVICE_INSTRUCTIONS[service];

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Instructions</Text>
      <Text style={styles.subtitle}>{content.subtitle}</Text>
      <View style={styles.steps}>
        {content.steps.map((step, index) => (
          <View key={step} style={styles.stepRow}>
            <View style={styles.stepBadge}>
              <Text style={styles.stepNum}>{index + 1}</Text>
            </View>
            <Text style={styles.stepText}>{step}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: {
      borderRadius: 16,
      backgroundColor: colors.card,
      padding: 12,
      marginBottom: 4,
    },
    title: { fontSize: 14, fontWeight: '700', color: colors.foreground },
    subtitle: {
      marginTop: 2,
      fontSize: 11,
      fontWeight: '500',
      color: colors.mutedForeground,
    },
    steps: { marginTop: 8, gap: 8 },
    stepRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
    stepBadge: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: colors.orangeMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepNum: { fontSize: 11, fontWeight: '800', color: Brand.orange },
    stepText: {
      flex: 1,
      paddingTop: 2,
      fontSize: 12,
      lineHeight: 17,
      fontWeight: '500',
      color: colors.foreground,
    },
  });
}
