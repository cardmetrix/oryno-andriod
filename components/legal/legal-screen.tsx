import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PageHeader } from '@/components/app/page-header';
import { Screen } from '@/components/ui/screen';
import { Brand, type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';
import {
  LEGAL_EFFECTIVE_DATE,
  type LegalSection,
} from '@/lib/legal';

type Props = {
  title: string;
  intro: string;
  sections: LegalSection[];
  otherHref: string;
  otherLabel: string;
};

export function LegalScreen({
  title,
  intro,
  sections,
  otherHref,
  otherLabel,
}: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <Screen scroll>
      <PageHeader title={title} subtitle={`Effective ${LEGAL_EFFECTIVE_DATE}`} />
      <Text style={styles.intro}>{intro}</Text>

      <View style={styles.sections}>
        {sections.map((section) => (
          <View key={section.heading} style={styles.block}>
            <Text style={styles.heading}>{section.heading}</Text>
            {section.paragraphs.map((p) => (
              <Text key={p.slice(0, 40)} style={styles.body}>
                {p}
              </Text>
            ))}
            {section.bullets?.map((item) => (
              <Text key={item} style={styles.bullet}>
                • {item}
              </Text>
            ))}
          </View>
        ))}
      </View>

      <View style={styles.footerLinks}>
        <Pressable onPress={() => router.push(otherHref)} hitSlop={8}>
          <Text style={styles.link}>{otherLabel}</Text>
        </Pressable>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text style={styles.link}>Back</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    intro: {
      marginTop: 4,
      marginBottom: 18,
      fontSize: 14,
      lineHeight: 21,
      color: colors.mutedForeground,
    },
    sections: { gap: 18, paddingBottom: 8 },
    block: { gap: 8 },
    heading: {
      fontSize: 16,
      fontWeight: '800',
      color: colors.foreground,
    },
    body: {
      fontSize: 14,
      lineHeight: 21,
      color: colors.mutedForeground,
    },
    bullet: {
      fontSize: 14,
      lineHeight: 21,
      color: colors.mutedForeground,
      paddingLeft: 4,
    },
    footerLinks: {
      marginTop: 20,
      paddingTop: 16,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      gap: 12,
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
    },
    link: {
      color: Brand.orange,
      fontWeight: '700',
      fontSize: 14,
    },
  });
}
