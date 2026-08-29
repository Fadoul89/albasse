import React from 'react';
import { Pressable, View, Text, StyleSheet, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import type { Product } from '../types';
import { colors, fonts, radius, spacing } from '../theme';
import { StarRating } from './StarRating';
import { FavoriteButton } from './FavoriteButton';

const { width } = Dimensions.get('window');

function cardWidth(columns: number) {
  return Math.min((width - spacing.md * (columns + 1)) / columns, 220);
}

const formatXAF = (n: number) => `${n.toLocaleString('fr-FR')} FCFA`;

export function ProductCard({ product, columns = 2 }: { product: Product; columns?: number }) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const CARD_WIDTH = cardWidth(columns);
  const discount =
    product.compare_at_price && product.compare_at_price > product.price
      ? Math.round((1 - product.price / product.compare_at_price) * 100)
      : null;

  return (
    <Pressable
      style={[styles.card, { width: CARD_WIDTH }]}
      onPress={() => navigation.navigate('Product', { slug: product.slug })}
    >
      <View style={styles.imageWrap}>
        <Image source={{ uri: product.images[0] }} style={styles.image} contentFit="cover" transition={150} />
        {discount && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>-{discount}%</Text>
          </View>
        )}
        <FavoriteButton productId={product.id} style={styles.favoriteBtn} />
      </View>
      <Text style={styles.name} numberOfLines={1}>
        {product.name}
      </Text>
      <View style={styles.priceRow}>
        <Text style={styles.price}>{formatXAF(product.price)}</Text>
        {product.compare_at_price && (
          <Text style={styles.comparePrice}>{formatXAF(product.compare_at_price)}</Text>
        )}
      </View>
      <StarRating rating={product.rating} size={11} reviewCount={product.review_count} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.lg },
  imageWrap: {
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.panel,
    aspectRatio: 0.8,
    marginBottom: spacing.sm,
  },
  image: { width: '100%', height: '100%' },
  badge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: colors.red,
    borderRadius: radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  badgeText: { color: colors.cream, fontFamily: fonts.bodyBold, fontSize: 11 },
  favoriteBtn: { position: 'absolute', top: 8, right: 8 },
  name: { color: colors.cream, fontFamily: fonts.bodyMedium, fontSize: 13, marginBottom: 4 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  price: { color: colors.goldLight, fontFamily: fonts.bodyBold, fontSize: 14 },
  comparePrice: {
    color: colors.creamFaint,
    fontFamily: fonts.body,
    fontSize: 12,
    textDecorationLine: 'line-through',
  },
});
