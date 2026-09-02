import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Linking } from 'react-native';
import { Image } from 'expo-image';
import { useStoreSettings } from '../hooks/useStoreSettings';
import { radius } from '../theme';

const ROTATE_MS = 5000;

// Grande banniere en haut de l'accueil : plusieurs photos possibles,
// defilement automatique, chacune avec son propre lien (optionnel).
// Geree depuis Espace Admin > Promotions intelligentes.
export function HomeBanner() {
  const { settings } = useStoreSettings();
  const items = settings.top_banner_items;
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (items.length <= 1) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % items.length), ROTATE_MS);
    return () => clearInterval(id);
  }, [items.length]);

  if (items.length === 0) return null;
  const current = items[index % items.length];

  const handlePress = () => {
    if (current.link) Linking.openURL(current.link);
  };

  return (
    <Pressable onPress={handlePress} style={styles.wrap}>
      <Image source={{ uri: current.image_url }} style={styles.image} contentFit="cover" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', aspectRatio: 2.2, borderRadius: radius.lg, overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
});
