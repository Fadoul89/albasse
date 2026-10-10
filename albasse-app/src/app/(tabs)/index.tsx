import React from 'react';
import { Image } from 'expo-image';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { colors, fonts, radius, spacing } from '../../theme';
import { useCategories, useFlashSaleProducts, useProducts } from '../../hooks/useCatalog';
import { ProductCard } from '../../components/ProductCard';

export default function HomeScreen() {
  const categories = useCategories();
  const flashSale = useFlashSaleProducts();
  const { products } = useProducts();

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <Image source={require('../../../assets/images/logo.jpg')} style={styles.logo} contentFit="cover" />
        <Text style={styles.brand}>ALBASSE SHOPPING</Text>
      </View>

      <Pressable style={styles.searchBar} onPress={() => router.push('/(tabs)/categories')}>
        <Text style={styles.searchIcon}>🔍</Text>
        <Text style={styles.searchPlaceholder}>Rechercher un costume, une montre…</Text>
      </Pressable>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.banner}>
          <Text style={styles.bannerKicker}>👔 MODE HOMME AU TCHAD</Text>
          <Text style={styles.bannerTitle}>L'élégance, livrée chez vous</Text>
          <Text style={styles.bannerSubtitle}>Costumes · Chemises · Montres · Accessoires</Text>
        </View>

        <Text style={styles.sectionTitle}>Catégories</Text>
        <View style={styles.categoryGrid}>
          {categories.map((c) => (
            <Pressable
              key={c.id}
              style={styles.categoryItem}
              onPress={() => router.push({ pathname: '/(tabs)/categories', params: { category: c.slug } })}
            >
              <View style={styles.categoryCircle}>
                <Text style={styles.categoryIcon}>{c.icon}</Text>
              </View>
              <Text style={styles.categoryName} numberOfLines={1}>
                {c.name}
              </Text>
            </Pressable>
          ))}
        </View>

        {flashSale.length > 0 && (
          <>
            <View style={styles.flashHeader}>
              <Text style={styles.flashTitle}>⚡ Vente Flash</Text>
              <Text style={styles.flashSubtitle}>Offres limitées</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.flashRow}>
              {flashSale.map((p) => (
                <View key={p.id} style={styles.flashCardWrap}>
                  <ProductCard product={p} />
                </View>
              ))}
            </ScrollView>
          </>
        )}

        <Text style={styles.sectionTitle}>Nos produits</Text>
        <View style={styles.productGrid}>
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  logo: { width: 32, height: 32, borderRadius: radius.sm },
  brand: { color: colors.goldLight, fontFamily: fonts.display, fontSize: 16, letterSpacing: 0.5 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.panel,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  searchIcon: { fontSize: 14 },
  searchPlaceholder: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 13 },
  content: { paddingHorizontal: spacing.md, paddingBottom: 90 },
  banner: {
    backgroundColor: colors.panel,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.gold,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  bannerKicker: { color: colors.red, fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 1, marginBottom: 6 },
  bannerTitle: { color: colors.goldLight, fontFamily: fonts.displayBold, fontSize: 22, marginBottom: 4 },
  bannerSubtitle: { color: colors.creamMuted, fontFamily: fonts.body, fontSize: 12 },
  sectionTitle: {
    color: colors.cream,
    fontFamily: fonts.display,
    fontSize: 17,
    marginBottom: spacing.sm,
    marginTop: spacing.xs,
  },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.lg },
  categoryItem: { width: '33.33%', alignItems: 'center', marginBottom: spacing.md },
  categoryCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  categoryIcon: { fontSize: 24 },
  categoryName: { color: colors.creamMuted, fontFamily: fonts.bodyMedium, fontSize: 11.5 },
  flashHeader: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: spacing.sm },
  flashTitle: { color: colors.red, fontFamily: fonts.displayBold, fontSize: 17 },
  flashSubtitle: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 11 },
  flashRow: { gap: 10, marginBottom: spacing.lg },
  flashCardWrap: { width: 160 },
  productGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
});
