import React, { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { colors, fonts, spacing } from '../../theme';
import { useCategories, useProducts } from '../../hooks/useCatalog';
import { ProductCard } from '../../components/ProductCard';
import { ScreenHeader } from '../../components/ScreenHeader';

export default function CategoryScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { products } = useProducts();
  const categories = useCategories();
  const [query, setQuery] = useState('');
  const { width } = useWindowDimensions();
  const columns = width >= 700 ? 4 : 2;

  const category = categories.find((c) => c.slug === slug);
  const name = category?.name ?? slug ?? '';

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const inCategory = p.categorySlug === slug;
      const matchesQuery = query.trim() ? p.name.toLowerCase().includes(query.trim().toLowerCase()) : true;
      return inCategory && matchesQuery;
    });
  }, [products, slug, query]);

  return (
    <View style={styles.screen}>
      <ScreenHeader title={name} showBack />
      <View style={styles.searchWrap}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={`Rechercher dans ${name.toLowerCase()}…`}
          placeholderTextColor={colors.creamFaint}
          style={styles.search}
        />
      </View>
      <FlatList
        key={columns}
        data={filtered}
        keyExtractor={(item) => item.id}
        numColumns={columns}
        columnWrapperStyle={{ justifyContent: 'space-between' }}
        contentContainerStyle={styles.grid}
        renderItem={({ item }) => <ProductCard product={item} columns={columns} />}
        ListEmptyComponent={<Text style={styles.empty}>Aucun produit trouvé.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
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
