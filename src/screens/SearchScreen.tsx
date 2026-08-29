import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, StyleSheet, FlatList } from 'react-native';
import { colors, fonts, spacing } from '../theme';
import { useProducts } from '../hooks/useProducts';
import { ProductCard } from '../components/ProductCard';

export function SearchScreen() {
  const { products } = useProducts();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    if (!query.trim()) return products;
    const q = query.trim().toLowerCase();
    return products
      .filter((p) => p.is_active)
      .filter((p) => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q));
  }, [products, query]);

  return (
    <View style={styles.screen}>
      <Text style={styles.headerTitle}>Recherche</Text>
      <View style={styles.searchWrap}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Rechercher un produit…"
          placeholderTextColor={colors.creamFaint}
          style={styles.search}
          autoFocus
        />
      </View>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={{ justifyContent: 'space-between' }}
        contentContainerStyle={styles.grid}
        renderItem={({ item }) => <ProductCard product={item} />}
        ListEmptyComponent={<Text style={styles.empty}>Aucun résultat.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, paddingTop: 50 },
  headerTitle: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.cream,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  searchWrap: { paddingHorizontal: spacing.md, marginBottom: spacing.md },
  search: {
    backgroundColor: colors.panel,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: colors.cream,
    fontFamily: fonts.body,
    borderWidth: 1,
    borderColor: colors.border,
  },
  grid: { paddingHorizontal: spacing.md, paddingBottom: 40 },
  empty: { color: colors.creamFaint, fontFamily: fonts.body, textAlign: 'center', marginTop: 40 },
});
