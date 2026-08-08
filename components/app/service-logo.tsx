import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';

import { Brand } from '@/constants/theme';

type Props = {
  src?: string | null;
  alt: string;
  fallback?: string;
  size?: number;
};

/** Provider logo from VTpass CDN with letter fallback. */
export function ServiceLogo({ src, alt, fallback, size = 40 }: Props) {
  const [failed, setFailed] = useState(false);
  const letter = (fallback || alt).trim().slice(0, 1).toUpperCase() || '?';

  if (!src || failed) {
    return (
      <View style={[styles.fallback, { width: size, height: size, borderRadius: size * 0.4 }]}>
        <Text style={styles.letter}>{letter}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.wrap, { width: size, height: size, borderRadius: size * 0.4 }]}>
      <Image
        source={{ uri: src }}
        style={styles.img}
        contentFit="cover"
        cachePolicy="memory-disk"
        recyclingKey={src}
        onError={() => setFailed(true)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: 'hidden',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  img: { width: '100%', height: '100%' },
  fallback: {
    backgroundColor: Brand.orangeMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  letter: { fontSize: 14, fontWeight: '800', color: Brand.orange },
});
