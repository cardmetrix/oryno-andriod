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
      borderRadius: 22,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      padding: 20,
    },
    title: { fontSize: 16, fontWeight: '700', color: colors.foreground },
    subtitle: {
      marginTop: 4,
      fontSize: 12,
      fontWeight: '500',
      color: colors.mutedForeground,
    },
    steps: { marginTop: 16, gap: 12 },
    stepRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
    stepBadge: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.orangeMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepNum: { fontSize: 12, fontWeight: '800', color: Brand.orange },
    stepText: {
      flex: 1,
      paddingTop: 4,
      fontSize: 13,
      lineHeight: 20,
      fontWeight: '500',
      color: colors.foreground,
    },
  });
}
