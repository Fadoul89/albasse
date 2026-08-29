import React from 'react';
import { Pressable, Text, StyleSheet, type GestureResponderEvent } from 'react-native';
import { useAuthStore } from '../store/authStore';
import { useFavoritesStore } from '../store/favoritesStore';
import { colors } from '../theme';

interface Props {
  productId: string;
  size?: number;
  style?: object;
}

export function FavoriteButton({ productId, size = 18, style }: Props) {
  const profile = useAuthStore((s) => s.profile);
  const isFavorite = useFavoritesStore((s) => s.ids.has(productId));
  const toggle = useFavoritesStore((s) => s.toggle);

  const handlePress = (e: GestureResponderEvent) => {
    e.stopPropagation?.();
    if (profile) toggle(profile.id, productId);
  };

  return (
    <Pressable onPress={handlePress} hitSlop={10} style={[styles.btn, style]}>
      <Text style={{ fontSize: size }}>{isFavorite ? '❤️' : '🤍'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
