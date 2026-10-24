import React, { useState } from 'react';
import { Pressable, Text, StyleSheet, type GestureResponderEvent } from 'react-native';
import { useAuthStore } from '../store/authStore';
import { useFavoritesStore } from '../store/favoritesStore';
import { colors, fonts } from '../theme';

interface Props {
  productId: string;
  size?: number;
  style?: object;
  // nombre de « j'aime » de l'article (visible par tous) ; sans valeur : pas de compteur
  likes?: number;
}

export function FavoriteButton({ productId, size = 18, style, likes }: Props) {
  const profile = useAuthStore((s) => s.profile);
  const isFavorite = useFavoritesStore((s) => s.ids.has(productId));
  const toggle = useFavoritesStore((s) => s.toggle);
  // le cœur touché pendant la visite : le compteur bouge tout de suite (la base le compte aussi)
  const [delta, setDelta] = useState(0);
  const count = likes == null ? 0 : Math.max(0, likes + delta);

  const handlePress = (e: GestureResponderEvent) => {
    e.stopPropagation?.();
    if (!profile) return;
    setDelta((d) => d + (isFavorite ? -1 : 1));
    toggle(profile.id, productId);
  };

  return (
    <Pressable onPress={handlePress} hitSlop={10} style={[styles.btn, count > 0 && styles.btnWithCount, style]} testID="favorite-button">
      <Text style={{ fontSize: size }}>{isFavorite ? '❤️' : '🤍'}</Text>
      {count > 0 ? (
        <Text style={styles.count} testID="favorite-count">
          {count}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    minWidth: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  btnWithCount: { paddingHorizontal: 8, gap: 4 },
  count: { color: colors.cream, fontFamily: fonts.bodyBold, fontSize: 13 },
});
