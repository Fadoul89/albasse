import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import type { Category } from '../types';
import { colors, fonts, radius } from '../theme';

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
        <Image source={{ uri: category.image_url }} style={styles.image} contentFit="cover" />
      ) : (
        <Text style={styles.icon}>{ICONS[category.slug] ?? '✨'}</Text>
      )}
      <Text style={styles.label}>{category.name}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    width: 84,
    alignItems: 'center',
    backgroundColor: colors.panel,
    borderRadius: radius.lg,
    paddingVertical: 14,
    marginRight: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  icon: { fontSize: 24, marginBottom: 6 },
  image: { width: 40, height: 40, borderRadius: 20, marginBottom: 6 },
  label: { color: colors.cream, fontFamily: fonts.bodyMedium, fontSize: 11, textAlign: 'center' },
});
