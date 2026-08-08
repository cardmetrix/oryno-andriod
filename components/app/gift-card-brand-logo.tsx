import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';

import { Brand } from '@/constants/theme';
import { resolveGiftCardImageSrc } from '@/lib/gift-cards';

type Props = {
  brand: { slug?: string; image?: string | null; name: string };
  fallbacks?: string[];
  size?: number;
};

export function GiftCardBrandLogo({ brand, fallbacks, size = 44 }: Props) {
  const chain = resolveGiftCardImageSrc({
    slug: brand.slug,
    image: brand.image,
    fallbacks,
  });
  const [idx, setIdx] = useState(0);
  const src = chain[Math.min(idx, Math.max(chain.length - 1, 0))];
  const letter = brand.name.trim().slice(0, 1).toUpperCase() || '?';

  if (!src) {
    return (
      <View style={[styles.fallback, { width: size, height: size }]}>
        <Text style={styles.letter}>{letter}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Image
        key={src}
        source={{ uri: src }}
        style={styles.img}
        contentFit="cover"
        cachePolicy="memory-disk"
        recyclingKey={src}
        onError={() => setIdx((i) => (i + 1 < chain.length ? i + 1 : i))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  img: { width: '100%', height: '100%' },
  fallback: {
    borderRadius: 16,
    backgroundColor: Brand.orangeMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  letter: { fontSize: 16, fontWeight: '800', color: Brand.orange },
});
