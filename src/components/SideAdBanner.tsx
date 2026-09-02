import React from 'react';
import { View, Pressable, StyleSheet, Linking } from 'react-native';
import { Image } from 'expo-image';
import { colors, radius } from '../theme';

export function SideAdBanner({ imageUrl, link }: { imageUrl: string | null; link: string | null }) {
  if (!imageUrl) return null;

  const image = <Image source={{ uri: imageUrl }} style={styles.image} contentFit="cover" />;

  if (!link) {
    return <View style={styles.wrap}>{image}</View>;
  }

  return (
    <Pressable style={styles.wrap} onPress={() => Linking.openURL(link)}>
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
  image: { width: '100%', height: '100%' },
});
