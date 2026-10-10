import React, { useState } from 'react';
import { Dimensions, Linking, Platform, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { colors, fonts, radius, spacing } from '../../theme';
import { formatXAF } from '../../lib/format';
import { useProductBySlug, useProducts } from '../../hooks/useCatalog';
import { useCartStore } from '../../store/cartStore';
import { ScreenHeader } from '../../components/ScreenHeader';
import { GoldButton } from '../../components/GoldButton';
import { StarRating } from '../../components/StarRating';
import { ProductCard } from '../../components/ProductCard';

const { width } = Dimensions.get('window');
const SITE_URL = 'https://www.albasseshopping.com';

export default function ProductScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { product, isLoading } = useProductBySlug(slug);
  const { products: allProducts } = useProducts();
  const addItem = useCartStore((s) => s.addItem);

  const [activeImage, setActiveImage] = useState(0);
  const [color, setColor] = useState<string | null>(null);
  const [size, setSize] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);

  if (isLoading || !product) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Produit" showBack />
      </View>
    );
  }

  const relatedProducts = allProducts
    .filter((p) => p.id !== product.id)
    .sort((a, b) => (a.categorySlug === product.categorySlug ? 0 : 1) - (b.categorySlug === product.categorySlug ? 0 : 1))
    .slice(0, 8);

  const getShareUrl = () => `${SITE_URL}/produit/${product.slug}`;

  const shareToWhatsApp = () => {
    const text = `${product.name} — ${formatXAF(product.price)}\n${getShareUrl()}`;
    Linking.openURL(`https://wa.me/?text=${encodeURIComponent(text)}`);
  };

  const shareToFacebook = () => {
    Linking.openURL(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(getShareUrl())}`);
  };

  const handleShare = async () => {
    try {
      await Share.share({ message: `${product.name} — ${formatXAF(product.price)}\n${getShareUrl()}`, url: getShareUrl() });
    } catch {
      // annulé par l'utilisateur
    }
  };

  const handleAddToCart = () => {
    addItem(product, { color, size, quantity });
  };

  const handleBuyNow = () => {
    addItem(product, { color, size, quantity });
    router.push('/checkout');
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title={product.name}
        showBack
        right={
          <Pressable onPress={handleShare} hitSlop={10}>
            <Text style={styles.shareIcon}>↗</Text>
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <Image source={{ uri: product.images[activeImage] }} style={styles.mainImage} contentFit="cover" transition={150} />
        {product.images.length > 1 && (
          <ScrollView horizontal contentContainerStyle={styles.thumbRow} showsHorizontalScrollIndicator={false}>
            {product.images.map((uri, i) => (
              <Pressable key={uri} onPress={() => setActiveImage(i)}>
                <Image source={{ uri }} style={[styles.thumb, i === activeImage && styles.thumbActive]} contentFit="cover" />
              </Pressable>
            ))}
          </ScrollView>
        )}

        <View style={styles.body}>
          <Text style={styles.name}>{product.name}</Text>
          <StarRating rating={product.rating} showValue reviewCount={product.reviewCount} />

          <View style={styles.priceRow}>
            <Text style={styles.price}>{formatXAF(product.price)}</Text>
            {product.compareAtPrice && <Text style={styles.comparePrice}>{formatXAF(product.compareAtPrice)}</Text>}
          </View>

          <View style={styles.shareRow}>
            <Text style={styles.shareLabel}>Partager :</Text>
            <Pressable style={[styles.shareBtn, styles.shareBtnWhatsApp]} onPress={shareToWhatsApp}>
              <Text style={styles.shareBtnText}>💬 WhatsApp</Text>
            </Pressable>
            <Pressable style={[styles.shareBtn, styles.shareBtnFacebook]} onPress={shareToFacebook}>
              <Text style={styles.shareBtnText}>📘 Facebook</Text>
            </Pressable>
          </View>

          <Text style={styles.description}>{product.description}</Text>

          {product.colors.length > 0 && (
            <View style={styles.selectorSection}>
              <Text style={styles.selectorLabel}>Couleur</Text>
              <View style={styles.optionsRow}>
                {product.colors.map((c) => (
                  <Pressable key={c} style={[styles.optionChip, color === c && styles.optionChipActive]} onPress={() => setColor(c)}>
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
                  <Pressable key={s} style={[styles.optionChip, size === s && styles.optionChipActive]} onPress={() => setSize(s)}>
                    <Text style={[styles.optionText, size === s && styles.optionTextActive]}>{s}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          <View style={styles.selectorSection}>
            <Text style={styles.selectorLabel}>Quantité</Text>
            <View style={styles.qtyRow}>
              <Pressable style={styles.qtyBtn} onPress={() => setQuantity((q) => Math.max(1, q - 1))}>
                <Text style={styles.qtyBtnText}>−</Text>
              </Pressable>
              <Text style={styles.qtyValue}>{quantity}</Text>
              <Pressable style={styles.qtyBtn} onPress={() => setQuantity((q) => Math.min(product.stock, q + 1))}>
                <Text style={styles.qtyBtnText}>+</Text>
              </Pressable>
            </View>
          </View>

          {relatedProducts.length > 0 && (
            <View style={styles.selectorSection}>
              <Text style={styles.selectorLabel}>Vous aimerez peut-être</Text>
              <View style={styles.suggestionsGrid}>
                {relatedProducts.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </View>
            </View>
          )}
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
  suggestionsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: spacing.md },
  mainImage: { width, aspectRatio: 0.85, backgroundColor: colors.panel },
  thumbRow: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: 8 },
  thumb: { width: 56, height: 56, borderRadius: radius.sm, marginRight: 8, borderWidth: 1, borderColor: colors.border },
  thumbActive: { borderColor: colors.gold, borderWidth: 2 },
  body: { paddingHorizontal: spacing.md, paddingTop: spacing.md },
  name: { fontFamily: fonts.display, fontSize: 22, color: colors.cream, marginBottom: 6 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  price: { fontFamily: fonts.bodyBold, fontSize: 20, color: colors.success },
  comparePrice: { fontFamily: fonts.body, fontSize: 15, color: colors.red, textDecorationLine: 'line-through' },
  shareRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  shareLabel: { color: colors.creamMuted, fontFamily: fonts.bodyMedium, fontSize: 12 },
  shareBtn: { borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6 },
  shareBtnWhatsApp: { backgroundColor: '#25D366' },
  shareBtnFacebook: { backgroundColor: '#1877F2' },
  shareBtnText: { color: '#ffffff', fontFamily: fonts.bodyBold, fontSize: 12 },
  description: { fontFamily: fonts.body, fontSize: 14, color: colors.creamMuted, lineHeight: 21, marginTop: spacing.md },
  selectorSection: { marginTop: spacing.lg },
  selectorLabel: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.cream, marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: 0.5 },
  optionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optionChip: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: colors.panel },
  optionChipActive: { borderColor: colors.gold, backgroundColor: colors.panelAlt },
  optionText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.creamMuted },
  optionTextActive: { color: colors.goldLight },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  qtyBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  qtyBtnText: { color: colors.gold, fontSize: 18, fontFamily: fonts.bodyBold },
  qtyValue: { color: colors.cream, fontFamily: fonts.bodySemiBold, fontSize: 16, minWidth: 20, textAlign: 'center' },
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
