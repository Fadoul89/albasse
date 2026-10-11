import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { colors, fonts, radius } from '../theme';
import type { Category } from '../data';

export function CategoryTile({ category }: { category: Category }) {
  return (
    <Pressable
      style={styles.tile}
      onPress={() => router.push({ pathname: '/category/[slug]', params: { slug: category.slug } })}
    >
      <Text style={styles.icon}>{category.icon}</Text>
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
  label: { color: colors.cream, fontFamily: fonts.bodyMedium, fontSize: 11, textAlign: 'center' },
});
