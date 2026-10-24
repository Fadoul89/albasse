import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import type { Category } from '../types';
import { colors, fonts, radius } from '../theme';
import { sizedImage } from '../lib/imageSize';

const ICONS: Record<string, string> = {
  costumes: '🕴️',
  chemises: '👔',
  cravates: '🎀',
  chaussures: '👞',
  montres: '⌚',
  accessoires: '💍',
};

export function CategoryTile({ category }: { category: Category }) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  return (
    <Pressable
      style={styles.tile}
      onPress={() => navigation.navigate('Category', { slug: category.slug })}
    >
      {category.image_url ? (
        <Image source={{ uri: sizedImage(category.image_url, 300) }} style={styles.image} contentFit="cover" />
      ) : (
        <Text style={styles.icon}>{ICONS[category.slug] ?? '✨'}</Text>
      )}
      <Text style={styles.label} numberOfLines={2}>
        {category.name}
      </Text>
    </Pressable>
  );
}

// Carte plus petite, photo plus grande (demande du patron) : la photo occupe presque toute la largeur de la carte.
const styles = StyleSheet.create({
  tile: {
    width: 76,
    alignItems: 'center',
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    paddingTop: 6,
    paddingBottom: 6,
    paddingHorizontal: 4,
    marginRight: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  icon: { fontSize: 32, lineHeight: 62, marginBottom: 4 },
  image: { width: 64, height: 64, borderRadius: 12, marginBottom: 4 },
  label: { color: colors.cream, fontFamily: fonts.bodyMedium, fontSize: 10.5, lineHeight: 13, textAlign: 'center' },
});
