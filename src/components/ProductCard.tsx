import React from 'react';
import { Pressable, View, Text, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import type { Product } from '../types';
import { realDiscountPct, shownOldPrice } from '../lib/promotions';
import { cloudinaryUrl } from '../lib/cloudinaryUrl';
import { colors, fonts, radius, spacing } from '../theme';
import { StarRating } from './StarRating';
import { FavoriteButton } from './FavoriteButton';
import { BlackFridayBadge } from './BlackFridayBadge';

// largeur par défaut (accueil, articles du même genre…) : selon la fenêtre ACTUELLE (avant : figée à l'ouverture du site)
function cardWidth(windowWidth: number, columns: number) {
  return Math.min((windowWidth - spacing.md * (columns + 1)) / columns, 220);
}

const formatXAF = (n: number) => `${n.toLocaleString('fr-FR')} FCFA`;

// l'éclat de lumière qui traverse l'étiquette du prix (demande du patron, 22 novembre 2026) : une animation CSS du site
// (déclarée dans la feuille de styles : styles.shineAnim), toutes les 3,6 s ; chaque article a son moment (décalage selon
// l'article) pour que les étiquettes ne brillent pas toutes ensemble
const SHINE_MS = 3600;
function shineDelay(seed: string): object {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return { animationDelay: `-${h % SHINE_MS}ms` };
}

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
        <Image accessibilityLabel={product.name} source={{ uri: cloudinaryUrl(product.images[0], 400) }} style={styles.image} contentFit="cover" transition={150} />
        {discount && (
          <View style={styles.badge} testID="product-discount-badge">
            <Text style={styles.badgeText}>-{discount}%</Text>
          </View>
        )}
        {discount && <BlackFridayBadge compact style={styles.blackFridayBadge} />}
        <FavoriteButton productId={product.id} likes={product.likes_count} style={styles.favoriteBtn} />
      </View>
      <Text style={styles.name} numberOfLines={1}>
        {product.name}
      </Text>
      <View style={styles.priceRow}>
        {/* le prix : étiquette verte traversée par un éclat de lumière */}
        <View style={styles.priceTag} testID="product-price">
          <Text style={styles.price}>
            {product.price.toLocaleString('fr-FR')}
            <Text style={styles.priceUnit}> FCFA</Text>
          </Text>
          {Platform.OS === 'web' ? (
            <View pointerEvents="none" style={[styles.shine, styles.shineAnim, shineDelay(product.id)]} testID="product-price-shine">
              <LinearGradient colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.7)', 'rgba(255,255,255,0)']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
            </View>
          ) : null}
        </View>
        {/* l'ancien prix (vraie promotion seulement) : comme avant, en rouge barré */}
        {oldPrice && <Text style={styles.comparePrice} testID="product-old-price">{formatXAF(oldPrice)}</Text>}
      </View>
      {/* les étoiles seulement quand l'article a des avis (des étoiles vides « (0) » donnent l'air que personne n'achète) */}
      {product.review_count > 0 ? <StarRating rating={product.rating} size={11} reviewCount={product.review_count} /> : null}
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
  blackFridayBadge: { position: 'absolute', top: 30, left: 8 },
  favoriteBtn: { position: 'absolute', top: 8, right: 8 },
  name: { color: colors.cream, fontFamily: fonts.bodySemiBold, fontSize: 13, marginBottom: 5 },
  priceRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, rowGap: 4, marginBottom: 4 },
  // étiquette verte unie (texte vert très foncé : bien lisible sur le vert)
  priceTag: { backgroundColor: '#2fcf77', borderRadius: 9, paddingHorizontal: 10, paddingVertical: 4, overflow: 'hidden', alignSelf: 'flex-start' },
  price: { color: '#06341d', fontFamily: fonts.bodyBold, fontSize: 14 },
  priceUnit: { fontSize: 10 },
  shine: { position: 'absolute', top: -6, bottom: -6, width: '26%', left: '-60%', transform: [{ skewX: '-22deg' }] },
  // propriétés d'animation du site (react-native-web) : absentes des types de React Native, d'où le « as object »
  shineAnim: {
    animationKeyframes: [{ '0%': { left: '-60%' }, '62%': { left: '-60%' }, '82%': { left: '130%' }, '100%': { left: '130%' } }],
    animationDuration: `${SHINE_MS}ms`,
    animationTimingFunction: 'ease-in-out',
    animationIterationCount: 'infinite',
  } as object,
  comparePrice: {
    color: colors.errorText,
    fontFamily: fonts.body,
    fontSize: 12,
    textDecorationLine: 'line-through',
  },
});
