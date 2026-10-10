import React, { useState } from 'react';
import { Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { colors, fonts, radius, spacing } from '../../theme';
import { discountPercent, formatXAF } from '../../lib/format';
import { useProductBySlug } from '../../hooks/useCatalog';
import { useCartStore } from '../../store/cartStore';
import { ScreenHeader } from '../../components/ScreenHeader';
import { GoldButton } from '../../components/GoldButton';

const { width } = Dimensions.get('window');

export default function ProductDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { product, isLoading } = useProductBySlug(slug);
  const addItem = useCartStore((s) => s.addItem);

  const [color, setColor] = useState<string | null>(null);
  const [size, setSize] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  if (isLoading || !product) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Produit" showBack />
        <Text style={styles.loading}>Chargement…</Text>
      </View>
    );
  }

  const discount = discountPercent(product.price, product.compareAtPrice);

  const handleAdd = () => {
    addItem(product, { color, size, quantity });
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader title={product.name} showBack />
      <ScrollView contentContainerStyle={{ paddingBottom: 140 }}>
        <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
          {product.images.map((uri) => (
            <Image key={uri} source={{ uri }} style={{ width, height: width * 1.15 }} contentFit="cover" />
          ))}
        </ScrollView>

        <View style={styles.content}>
          {product.isFlashSale && (
            <View style={styles.flashTag}>
              <Text style={styles.flashTagText}>⚡ VENTE FLASH</Text>
            </View>
          )}
          <Text style={styles.name}>{product.name}</Text>

          <View style={styles.priceRow}>
            <Text style={styles.price}>{formatXAF(product.price)}</Text>
            {product.compareAtPrice && <Text style={styles.comparePrice}>{formatXAF(product.compareAtPrice)}</Text>}
            {discount && (
              <View style={styles.discountBadge}>
                <Text style={styles.discountText}>-{discount}%</Text>
              </View>
            )}
          </View>

          <View style={styles.ratingRow}>
            <Text style={styles.rating}>★ {product.rating.toFixed(1)}</Text>
            <Text style={styles.reviewCount}>{product.reviewCount} avis</Text>
            <Text style={styles.stock}>{product.stock > 0 ? `${product.stock} en stock` : 'Rupture de stock'}</Text>
          </View>

          {product.colors.length > 0 && (
            <View style={styles.optionBlock}>
              <Text style={styles.optionLabel}>Couleur</Text>
              <View style={styles.optionRow}>
                {product.colors.map((c) => (
                  <Pressable
                    key={c}
                    style={[styles.optionChip, color === c && styles.optionChipActive]}
                    onPress={() => setColor(c)}
                  >
                    <Text style={[styles.optionChipText, color === c && styles.optionChipTextActive]}>{c}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {product.sizes.length > 0 && (
            <View style={styles.optionBlock}>
              <Text style={styles.optionLabel}>Taille</Text>
              <View style={styles.optionRow}>
                {product.sizes.map((s) => (
                  <Pressable
                    key={s}
                    style={[styles.optionChip, size === s && styles.optionChipActive]}
                    onPress={() => setSize(s)}
                  >
                    <Text style={[styles.optionChipText, size === s && styles.optionChipTextActive]}>{s}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          <View style={styles.optionBlock}>
            <Text style={styles.optionLabel}>Quantité</Text>
            <View style={styles.stepperRow}>
              <Pressable style={styles.stepperBtn} onPress={() => setQuantity((q) => Math.max(1, q - 1))}>
                <Text style={styles.stepperBtnText}>−</Text>
              </Pressable>
              <Text style={styles.quantity}>{quantity}</Text>
              <Pressable style={styles.stepperBtn} onPress={() => setQuantity((q) => q + 1)}>
                <Text style={styles.stepperBtnText}>+</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.descriptionBlock}>
            <Text style={styles.optionLabel}>Description</Text>
            <Text style={styles.description}>{product.description}</Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <GoldButton
          label={added ? '✓ Ajouté au panier' : 'Ajouter au panier'}
          onPress={handleAdd}
          disabled={product.stock === 0}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  loading: { color: colors.creamFaint, fontFamily: fonts.body, textAlign: 'center', marginTop: 40 },
  content: { padding: spacing.md },
  flashTag: {
    alignSelf: 'flex-start',
    backgroundColor: colors.red,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: spacing.sm,
  },
  flashTagText: { color: colors.cream, fontFamily: fonts.bodyBold, fontSize: 10 },
  name: { color: colors.cream, fontFamily: fonts.display, fontSize: 20, marginBottom: spacing.sm },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' },
  price: { color: colors.goldLight, fontFamily: fonts.displayBold, fontSize: 22 },
  comparePrice: {
    color: colors.creamFaint,
    fontFamily: fonts.body,
    fontSize: 14,
    textDecorationLine: 'line-through',
  },
  discountBadge: { backgroundColor: colors.gold, borderRadius: radius.sm, paddingHorizontal: 6, paddingVertical: 2 },
  discountText: { color: colors.background, fontFamily: fonts.bodyBold, fontSize: 11 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: spacing.md },
  rating: { color: colors.gold, fontFamily: fonts.bodySemiBold, fontSize: 13 },
  reviewCount: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 12 },
  stock: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 12, marginLeft: 'auto' },
  optionBlock: { marginBottom: spacing.md },
  optionLabel: { color: colors.cream, fontFamily: fonts.bodySemiBold, fontSize: 13, marginBottom: 8 },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optionChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: colors.panel,
  },
  optionChipActive: { borderColor: colors.gold, backgroundColor: colors.gold },
  optionChipText: { color: colors.creamMuted, fontFamily: fonts.bodyMedium, fontSize: 12.5 },
  optionChipTextActive: { color: colors.background, fontFamily: fonts.bodyBold },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  stepperBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnText: { color: colors.gold, fontFamily: fonts.bodyBold, fontSize: 18 },
  quantity: { color: colors.cream, fontFamily: fonts.bodySemiBold, fontSize: 15, minWidth: 20, textAlign: 'center' },
  descriptionBlock: { marginTop: spacing.sm },
  description: { color: colors.creamMuted, fontFamily: fonts.body, fontSize: 13, lineHeight: 20 },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: spacing.md,
    backgroundColor: colors.panel,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
