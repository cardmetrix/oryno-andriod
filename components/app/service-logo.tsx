import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';

import { Brand } from '@/constants/theme';
import { serviceLogoSources } from '@/lib/brand-logos';

type Props = {
  src?: string | null;
  alt: string;
  domain?: string | null;
  fallbacks?: string[] | null;
  fallback?: string;
  size?: number;
};

/** Provider logo with open favicon/logo API fallbacks, then a letter. */
export function ServiceLogo({
  src,
  alt,
  domain,
  fallbacks,
  fallback,
  size = 40,
}: Props) {
  const chain = useMemo(
    () => serviceLogoSources({ src, domain, name: alt, fallbacks }),
    [src, domain, alt, fallbacks],
  );
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    setIdx(0);
  }, [chain.join('|')]);

  const letter = (fallback || alt).trim().slice(0, 1).toUpperCase() || '?';
  const current = chain[idx];

  if (!current) {
    return (
      <View style={[styles.fallback, { width: size, height: size, borderRadius: size * 0.4 }]}>
        <Text style={styles.letter}>{letter}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.wrap, { width: size, height: size, borderRadius: size * 0.4 }]}>
      <Image
        source={{ uri: current }}
        style={styles.img}
        contentFit="contain"
        cachePolicy="memory-disk"
        recyclingKey={current}
        onError={() => setIdx((i) => (i + 1 < chain.length ? i + 1 : chain.length))}
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
