import React from 'react';
import { Pressable, View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import type { Product } from '../types';
import { realDiscountPct, shownOldPrice } from '../lib/promotions';
import { colors, fonts, radius, spacing } from '../theme';
import { StarRating } from './StarRating';
import { FavoriteButton } from './FavoriteButton';

// largeur par défaut (accueil, articles du même genre…) : selon la fenêtre ACTUELLE (avant : figée à l'ouverture du site)
function cardWidth(windowWidth: number, columns: number) {
  return Math.min((windowWidth - spacing.md * (columns + 1)) / columns, 220);
}

const formatXAF = (n: number) => `${n.toLocaleString('fr-FR')} FCFA`;

// width : la largeur exacte donnée par une grille (useProductGrid) ; sinon, la largeur par défaut selon columns
export function ProductCard({ product, columns = 2, width }: { product: Product; columns?: number; width?: number }) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { width: windowWidth } = useWindowDimensions();
  const CARD_WIDTH = width ?? cardWidth(windowWidth, columns);
  // l'ancien prix et le « -X % » seulement pendant une vraie promotion (vente flash ou promotion de Zara en cours)
  const oldPrice = shownOldPrice(product);
  const discount = oldPrice ? realDiscountPct(product.price, oldPrice) : null;

  return (
    <Pressable
      testID={`product-card-${product.slug}`}
      style={[styles.card, { width: CARD_WIDTH }]}
      onPress={() => navigation.navigate('Product', { slug: product.slug })}
    >
      <View style={styles.imageWrap}>
        <Image accessibilityLabel={product.name} source={{ uri: product.images[0] }} style={styles.image} contentFit="cover" transition={150} />
        {discount && (
          <View style={styles.badge} testID="product-discount-badge">
            <Text style={styles.badgeText}>-{discount}%</Text>
          </View>
        )}
        <FavoriteButton productId={product.id} likes={product.likes_count} style={styles.favoriteBtn} />
      </View>
      <Text style={styles.name} numberOfLines={1}>
        {product.name}
      </Text>
      <View style={styles.priceRow}>
        <Text style={styles.price}>{formatXAF(product.price)}</Text>
        {oldPrice && <Text style={styles.comparePrice} testID="product-old-price">{formatXAF(oldPrice)}</Text>}
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
  badgeText: { color: '#ffffff', fontFamily: fonts.bodyBold, fontSize: 11 },
  favoriteBtn: { position: 'absolute', top: 8, right: 8 },
  name: { color: colors.cream, fontFamily: fonts.bodyMedium, fontSize: 13, marginBottom: 4 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  price: { color: colors.successText, fontFamily: fonts.bodyBold, fontSize: 14 },
  comparePrice: {
    color: colors.errorText,
    fontFamily: fonts.body,
    fontSize: 12,
    textDecorationLine: 'line-through',
  },
});
