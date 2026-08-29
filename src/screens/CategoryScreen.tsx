import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, StyleSheet, FlatList, Platform, useWindowDimensions } from 'react-native';
import type { RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts, spacing } from '../theme';
import { useProducts } from '../hooks/useProducts';
import { useCategories } from '../hooks/useCategories';
import { ProductCard } from '../components/ProductCard';
import { ScreenHeader } from '../components/ScreenHeader';

interface Props {
  route: RouteProp<RootStackParamList, 'Category'>;
}

export function CategoryScreen({ route }: Props) {
  const { slug } = route.params;
  const { products } = useProducts();
  const { categories } = useCategories();
  const [query, setQuery] = useState('');
  const { width } = useWindowDimensions();
  const columns = width >= 700 ? 4 : 2;

  const category = categories.find((c) => c.slug === slug);
  const name = category?.name ?? slug;

  useEffect(() => {
    if (Platform.OS === 'web' && category) {
      document.title = `${category.name} — Albasse Shopping`;
    }
  }, [category?.name]);

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const inCategory = category ? p.category_id === category.id : false;
      if (!p.is_active) return false;
      const matchesQuery = query.trim()
        ? p.name.toLowerCase().includes(query.trim().toLowerCase())
        : true;
      return inCategory && matchesQuery;
    });
  }, [products, category, query]);

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
  empty: {
    color: colors.creamFaint,
    fontFamily: fonts.body,
    textAlign: 'center',
    marginTop: 40,
  },
});
