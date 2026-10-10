import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { colors, fonts, radius, spacing } from '../theme';
import { discountPercent, formatXAF } from '../lib/format';
import type { Product } from '../data';

export function ProductCard({ product }: { product: Product }) {
  const discount = discountPercent(product.price, product.compareAtPrice);

  return (
    <Pressable style={styles.card} onPress={() => router.push(`/product/${product.slug}`)}>
      <View style={styles.imageWrap}>
        <Image source={{ uri: product.images[0] }} style={styles.image} contentFit="cover" transition={150} />
        {product.isFlashSale && (
          <View style={styles.flashBadge}>
            <Text style={styles.flashBadgeText}>⚡ VENTE FLASH</Text>
          </View>
        )}
        {discount && !product.isFlashSale && (
          <View style={styles.discountBadge}>
            <Text style={styles.discountText}>-{discount}%</Text>
          </View>
        )}
      </View>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={2}>
          {product.name}
        </Text>
        <View style={styles.priceRow}>
          <Text style={styles.price}>{formatXAF(product.price)}</Text>
          {product.compareAtPrice && (
            <Text style={styles.comparePrice}>{formatXAF(product.compareAtPrice)}</Text>
          )}
        </View>
        <View style={styles.ratingRow}>
          <Text style={styles.rating}>★ {product.rating.toFixed(1)}</Text>
          <Text style={styles.reviewCount}>({product.reviewCount})</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '48%',
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    overflow: 'hidden',
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  imageWrap: { width: '100%', aspectRatio: 0.85, backgroundColor: colors.panelAlt },
  image: { width: '100%', height: '100%' },
  flashBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: colors.red,
    borderRadius: radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  flashBadgeText: { color: colors.cream, fontFamily: fonts.bodyBold, fontSize: 9, letterSpacing: 0.3 },
  discountBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: colors.gold,
    borderRadius: radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  discountText: { color: colors.background, fontFamily: fonts.bodyBold, fontSize: 10 },
  info: { padding: spacing.sm },
  name: { color: colors.cream, fontFamily: fonts.bodyMedium, fontSize: 12.5, lineHeight: 17, minHeight: 34 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 6, flexWrap: 'wrap' },
  price: { color: colors.goldLight, fontFamily: fonts.bodyBold, fontSize: 14 },
  comparePrice: {
    color: colors.creamFaint,
    fontFamily: fonts.body,
    fontSize: 11,
    textDecorationLine: 'line-through',
  },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  rating: { color: colors.gold, fontFamily: fonts.bodySemiBold, fontSize: 11 },
  reviewCount: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 11 },
});
