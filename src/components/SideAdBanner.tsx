import React, { useEffect, useState } from 'react';
import { View, Pressable, StyleSheet, Linking } from 'react-native';
import { Image } from 'expo-image';
import { colors, radius } from '../theme';
import type { AdItem } from '../types';

const ROTATE_MS = 4500;

export function SideAdBanner({ items, variant = 'side' }: { items: AdItem[]; variant?: 'side' | 'mobile' }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (items.length <= 1) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % items.length), ROTATE_MS);
    return () => clearInterval(id);
  }, [items.length]);

  if (items.length === 0) return null;
  const current = items[index % items.length];
  const wrapStyle = variant === 'mobile' ? styles.wrapMobile : styles.wrap;

  const image = <Image source={{ uri: current.image_url }} style={styles.image} contentFit="cover" />;

  if (!current.link) {
    return <View style={wrapStyle}>{image}</View>;
  }

  return (
    <Pressable style={wrapStyle} onPress={() => Linking.openURL(current.link!)}>
      {image}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 160,
    alignSelf: 'stretch',
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    overflow: 'hidden',
    marginVertical: 12,
  },
  wrapMobile: {
    width: '100%',
    height: 180,
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  image: { width: '100%', height: '100%' },
});
