import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useFavoritesStore } from '../store/favoritesStore';
import { useProducts } from '../hooks/useProducts';
import { ScreenHeader } from '../components/ScreenHeader';
import { ProductCard } from '../components/ProductCard';
import { colors, fonts, spacing } from '../theme';

export function FavoritesScreen() {
  const favoriteIds = useFavoritesStore((s) => s.ids);
  const { products, isLoading } = useProducts();

  const favorites = products.filter((p) => favoriteIds.has(p.id));

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Mes favoris" showBack />
      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 60 }}>
        {isLoading ? (
          <Text style={styles.emptyText}>Chargement…</Text>
        ) : favorites.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyIcon}>🤍</Text>
            <Text style={styles.emptyText}>
              Aucun favori pour le moment. Appuyez sur le cœur d'un produit pour l'ajouter ici.
            </Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {favorites.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  emptyWrap: { alignItems: 'center', marginTop: 60, paddingHorizontal: spacing.lg },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyText: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 13, textAlign: 'center', lineHeight: 19 },
});
