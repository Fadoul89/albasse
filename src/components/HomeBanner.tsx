import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useActivePromotion } from '../hooks/useActivePromotion';
import { useCategories } from '../hooks/useCategories';
import { useProducts } from '../hooks/useProducts';
import { radius } from '../theme';

// Grande banniere en haut de l'accueil, alimentee par la promotion active
// configuree dans Espace Admin > Promotions intelligentes (meme image que
// le popup). Invisible si aucune promotion active n'a d'image.
export function HomeBanner() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const promotion = useActivePromotion();
  const { categories } = useCategories();
  const { products } = useProducts();

  if (!promotion || !promotion.image_url) return null;

  const targetCategory = promotion.category_id ? categories.find((c) => c.id === promotion.category_id) : null;
  const targetProduct = promotion.product_id ? products.find((p) => p.id === promotion.product_id) : null;

  const handlePress = () => {
    if (targetProduct) navigation.navigate('Product', { slug: targetProduct.slug });
    else if (targetCategory) navigation.navigate('Category', { slug: targetCategory.slug });
  };

  return (
    <Pressable onPress={handlePress} style={styles.wrap}>
      <Image source={{ uri: promotion.image_url }} style={styles.image} contentFit="cover" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', aspectRatio: 2.2, borderRadius: radius.lg, overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
});
