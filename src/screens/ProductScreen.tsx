import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  Pressable,
  Platform,
  Share,
} from 'react-native';
import { Image } from 'expo-image';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts, radius, spacing } from '../theme';
import { useProductBySlug, useProducts } from '../hooks/useProducts';
import { useReviews } from '../hooks/useReviews';
import { useCartStore } from '../store/cartStore';
import { useToastStore } from '../store/toastStore';
import { useAuthStore } from '../store/authStore';
import { trackProductView, trackAddToCart } from '../lib/analytics';
import { ScreenHeader } from '../components/ScreenHeader';
import { StarRating } from '../components/StarRating';
import { GoldButton } from '../components/GoldButton';
import { ProductCard } from '../components/ProductCard';
import { FavoriteButton } from '../components/FavoriteButton';

const { width } = Dimensions.get('window');
const formatXAF = (n: number) => `${n.toLocaleString('fr-FR')} FCFA`;
const SITE_URL = 'https://www.albasseshopping.com';

interface Props {
  route: RouteProp<RootStackParamList, 'Product'>;
}

export function ProductScreen({ route }: Props) {
  const { slug } = route.params;
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { product, redirectSlug, isLoading } = useProductBySlug(slug);
  const { products: allProducts } = useProducts();
  const { reviews } = useReviews(product?.id ?? '');
  const addItem = useCartStore((s) => s.addItem);
  const showToast = useToastStore((s) => s.show);
  const profile = useAuthStore((s) => s.profile);

  const [activeImage, setActiveImage] = useState(0);
  const [color, setColor] = useState<string | null>(product?.colors[0] ?? null);
  const [size, setSize] = useState<string | null>(product?.sizes[0] ?? null);
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    if (product) trackProductView(product.id);
  }, [product?.id]);

  useEffect(() => {
    if (Platform.OS === 'web' && product) {
      document.title = `${product.name} — Albasse Shopping`;
    }
  }, [product?.name]);

  useEffect(() => {
    if (redirectSlug) {
      navigation.setParams({ slug: redirectSlug });
    }
  }, [redirectSlug]);

  if (!product || !product.is_active) {
    if (isLoading) {
      return (
        <View style={styles.screen}>
          <ScreenHeader title="Produit" showBack />
        </View>
      );
    }

    const suggestions = allProducts.filter((p) => p.is_active).slice(0, 4);
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Produit indisponible" showBack />
        <ScrollView contentContainerStyle={styles.body}>
          <Text style={styles.notFoundTitle}>Produit indisponible</Text>
          <Text style={styles.notFound}>
            Ce produit n'existe plus ou a été retiré de la boutique.
          </Text>
          {suggestions.length > 0 && (
            <>
              <Text style={[styles.selectorLabel, { marginTop: spacing.xl }]}>Vous aimerez peut-être</Text>
              <View style={styles.suggestionsGrid}>
                {suggestions.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </View>
            </>
          )}
        </ScrollView>
      </View>
    );
  }

  const handleAddToCart = () => {
    addItem(product, quantity, color, size);
    trackAddToCart(product.id);
    showToast(`${product.name} (x${quantity})`, { title: 'Ajouté au panier ✓', type: 'success' });
  };

  const handleBuyNow = () => {
    addItem(product, quantity, color, size);
    trackAddToCart(product.id);
    navigation.navigate('Checkout');
  };

  const handleShare = async () => {
    const isApprovedAffiliate = profile?.is_affiliate && profile.affiliate_status === 'approved' && profile.referral_code;
    const url = isApprovedAffiliate
      ? `${SITE_URL}/produit/${product.slug}?ref=${profile!.referral_code}`
      : `${SITE_URL}/produit/${product.slug}`;

    if (Platform.OS === 'web') {
      const nav = typeof navigator !== 'undefined' ? navigator : null;
      if (nav?.share) {
        try {
          await nav.share({ title: product.name, text: product.name, url });
        } catch {
          // annulé par l'utilisateur ou non pris en charge
        }
      } else if (nav?.clipboard) {
        await nav.clipboard.writeText(url);
        showToast('Lien copié dans le presse-papiers.', { title: 'Prêt à partager 🔗', type: 'success' });
      }
      return;
    }

    try {
      await Share.share({ message: `${product.name} — ${formatXAF(product.price)}\n${url}`, url });
    } catch {
      // annulé par l'utilisateur
    }
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title={product.name}
        showBack
        right={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <FavoriteButton productId={product.id} />
            <Pressable onPress={handleShare} hitSlop={10}>
              <Text style={styles.shareIcon}>↗</Text>
            </Pressable>
          </View>
        }
      />
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <Image
          source={{ uri: product.images[activeImage] }}
          style={styles.mainImage}
          contentFit="cover"
          transition={150}
        />
        {product.images.length > 1 && (
          <ScrollView horizontal contentContainerStyle={styles.thumbRow} showsHorizontalScrollIndicator={false}>
            {product.images.map((uri, i) => (
              <Pressable key={uri} onPress={() => setActiveImage(i)}>
                <Image
                  source={{ uri }}
                  style={[styles.thumb, i === activeImage && styles.thumbActive]}
                  contentFit="cover"
                />
              </Pressable>
            ))}
          </ScrollView>
        )}

        <View style={styles.body}>
          <Text style={styles.name}>{product.name}</Text>
          <StarRating rating={product.rating} showValue reviewCount={product.review_count} />

          <View style={styles.priceRow}>
            <Text style={styles.price}>{formatXAF(product.price)}</Text>
            {product.compare_at_price && (
              <Text style={styles.comparePrice}>{formatXAF(product.compare_at_price)}</Text>
            )}
          </View>

          <Text style={styles.description}>{product.description}</Text>

          {product.colors.length > 0 && (
            <View style={styles.selectorSection}>
              <Text style={styles.selectorLabel}>Couleur</Text>
              <View style={styles.optionsRow}>
                {product.colors.map((c) => (
                  <Pressable
                    key={c}
                    style={[styles.optionChip, color === c && styles.optionChipActive]}
                    onPress={() => setColor(c)}
                  >
                    <Text style={[styles.optionText, color === c && styles.optionTextActive]}>{c}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {product.sizes.length > 0 && (
            <View style={styles.selectorSection}>
              <Text style={styles.selectorLabel}>Taille</Text>
              <View style={styles.optionsRow}>
                {product.sizes.map((s) => (
                  <Pressable
                    key={s}
                    style={[styles.optionChip, size === s && styles.optionChipActive]}
                    onPress={() => setSize(s)}
                  >
                    <Text style={[styles.optionText, size === s && styles.optionTextActive]}>{s}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          <View style={styles.selectorSection}>
            <Text style={styles.selectorLabel}>Quantité</Text>
            <View style={styles.qtyRow}>
              <Pressable
                style={styles.qtyBtn}
                onPress={() => setQuantity((q) => Math.max(1, q - 1))}
              >
                <Text style={styles.qtyBtnText}>−</Text>
              </Pressable>
              <Text style={styles.qtyValue}>{quantity}</Text>
              <Pressable
                style={styles.qtyBtn}
                onPress={() => setQuantity((q) => Math.min(product.stock, q + 1))}
              >
                <Text style={styles.qtyBtnText}>+</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.reviewsSection}>
            <Text style={styles.selectorLabel}>Avis clients ({reviews.length})</Text>
            {reviews.length === 0 && (
              <Text style={styles.noReviews}>Aucun avis pour le moment.</Text>
            )}
            {reviews.map((r) => (
              <View key={r.id} style={styles.reviewCard}>
                <View style={styles.reviewHeader}>
                  <Text style={styles.reviewAuthor}>{r.author_name}</Text>
                  <StarRating rating={r.rating} size={11} />
                </View>
                <Text style={styles.reviewComment}>{r.comment}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <GoldButton label="Ajouter au panier" variant="outline" onPress={handleAddToCart} style={{ flex: 1 }} />
        <GoldButton label="Acheter" variant="gold" onPress={handleBuyNow} style={{ flex: 1 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  shareIcon: { color: colors.gold, fontSize: 20, fontFamily: fonts.bodyBold },
  notFoundTitle: { fontFamily: fonts.display, fontSize: 22, color: colors.cream, marginBottom: 8 },
  notFound: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 14 },
  suggestionsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: spacing.md },
  mainImage: { width, aspectRatio: 0.85, backgroundColor: colors.panel },
  thumbRow: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: 8 },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: radius.sm,
    marginRight: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  thumbActive: { borderColor: colors.gold, borderWidth: 2 },
  body: { paddingHorizontal: spacing.md, paddingTop: spacing.md },
  name: { fontFamily: fonts.display, fontSize: 22, color: colors.cream, marginBottom: 6 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  price: { fontFamily: fonts.bodyBold, fontSize: 20, color: colors.success },
  comparePrice: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.red,
    textDecorationLine: 'line-through',
  },
  description: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.creamMuted,
    lineHeight: 21,
    marginTop: spacing.md,
  },
  selectorSection: { marginTop: spacing.lg },
  selectorLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    color: colors.cream,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  optionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optionChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: colors.panel,
  },
  optionChipActive: { borderColor: colors.gold, backgroundColor: colors.panelAlt },
  optionText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.creamMuted },
  optionTextActive: { color: colors.goldLight },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  qtyBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBtnText: { color: colors.gold, fontSize: 18, fontFamily: fonts.bodyBold },
  qtyValue: { color: colors.cream, fontFamily: fonts.bodySemiBold, fontSize: 16, minWidth: 20, textAlign: 'center' },
  reviewsSection: { marginTop: spacing.xl },
  noReviews: { fontFamily: fonts.body, color: colors.creamFaint, fontSize: 13 },
  reviewCard: {
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  reviewAuthor: { color: colors.cream, fontFamily: fonts.bodySemiBold, fontSize: 13 },
  reviewComment: { color: colors.creamMuted, fontFamily: fonts.body, fontSize: 13, lineHeight: 19 },
  footer: {
    flexDirection: 'row',
    gap: 10,
    padding: spacing.md,
    backgroundColor: colors.panelAlt,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
});
