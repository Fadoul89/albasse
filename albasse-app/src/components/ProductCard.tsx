import React from 'react';
import { Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { colors, fonts, radius, spacing } from '../theme';
import { formatXAF } from '../lib/format';
import { StarRating } from './StarRating';
import type { Product } from '../data';

const { width } = Dimensions.get('window');

function cardWidth(columns: number) {
  return Math.min((width - spacing.md * (columns + 1)) / columns, 220);
}

export function ProductCard({ product, columns = 2 }: { product: Product; columns?: number }) {
  const CARD_WIDTH = cardWidth(columns);
  const discount =
    product.compareAtPrice && product.compareAtPrice > product.price
      ? Math.round((1 - product.price / product.compareAtPrice) * 100)
      : null;

  return (
    <Pressable style={[styles.card, { width: CARD_WIDTH }]} onPress={() => router.push(`/product/${product.slug}`)}>
      <View style={styles.imageWrap}>
        <Image source={{ uri: product.images[0] }} style={styles.image} contentFit="cover" transition={150} />
        {discount && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>-{discount}%</Text>
          </View>
        )}
      </View>
      <Text style={styles.name} numberOfLines={1}>
        {product.name}
      </Text>
      <View style={styles.priceRow}>
        <Text style={styles.price}>{formatXAF(product.price)}</Text>
        {product.compareAtPrice && <Text style={styles.comparePrice}>{formatXAF(product.compareAtPrice)}</Text>}
      </View>
      <StarRating rating={product.rating} size={11} reviewCount={product.reviewCount} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.lg },
  imageWrap: { borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.panel, aspectRatio: 0.8, marginBottom: spacing.sm },
  image: { width: '100%', height: '100%' },
  badge: { position: 'absolute', top: 8, left: 8, backgroundColor: colors.red, borderRadius: radius.sm, paddingHorizontal: 6, paddingVertical: 3 },
  badgeText: { color: colors.cream, fontFamily: fonts.bodyBold, fontSize: 11 },
  name: { color: colors.cream, fontFamily: fonts.bodyMedium, fontSize: 13, marginBottom: 4 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  price: { color: colors.success, fontFamily: fonts.bodyBold, fontSize: 14 },
  comparePrice: { color: colors.red, fontFamily: fonts.body, fontSize: 12, textDecorationLine: 'line-through' },
});
