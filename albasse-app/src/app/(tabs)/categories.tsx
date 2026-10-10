import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { colors, fonts, radius, spacing } from '../../theme';
import { useCategories, useProducts } from '../../hooks/useCatalog';
import { ProductCard } from '../../components/ProductCard';

export default function CategoriesScreen() {
  const params = useLocalSearchParams<{ category?: string }>();
  const categories = useCategories();
  const { products, isLoading } = useProducts();

  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(params.category ?? null);

  useEffect(() => {
    if (params.category) setActiveCategory(params.category);
  }, [params.category]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      const matchesCategory = !activeCategory || p.categorySlug === activeCategory;
      const matchesQuery = !q || p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q);
      return matchesCategory && matchesQuery;
    });
  }, [products, query, activeCategory]);

  return (
    <View style={styles.screen}>
      <Text style={styles.header}>Catégories</Text>

      <View style={styles.searchBar}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Rechercher un article…"
          placeholderTextColor={colors.creamFaint}
          style={styles.searchInput}
        />
      </View>

      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={[{ id: 'all', slug: null as string | null, name: 'Tout', icon: '✨' }, ...categories]}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.chipRow}
        renderItem={({ item }) => {
          const active = activeCategory === item.slug;
          return (
            <Pressable
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setActiveCategory(item.slug)}
            >
              <Text style={styles.chipIcon}>{item.icon}</Text>
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{item.name}</Text>
            </Pressable>
          );
        }}
      />

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={{ justifyContent: 'space-between' }}
        contentContainerStyle={styles.grid}
        renderItem={({ item }) => <ProductCard product={item} />}
        ListEmptyComponent={
          !isLoading ? <Text style={styles.empty}>Aucun article ne correspond à votre recherche.</Text> : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    color: colors.cream,
    fontFamily: fonts.display,
    fontSize: 20,
    textAlign: 'center',
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
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
  },
  searchIcon: { fontSize: 14 },
  searchInput: { flex: 1, color: colors.cream, fontFamily: fonts.body, fontSize: 13, paddingVertical: 10 },
  chipRow: { paddingHorizontal: spacing.md, gap: 8, paddingBottom: spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.panel,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  chipIcon: { fontSize: 13 },
  chipText: { color: colors.creamMuted, fontFamily: fonts.bodySemiBold, fontSize: 12.5 },
  chipTextActive: { color: colors.background },
  grid: { paddingHorizontal: spacing.md, paddingBottom: 90 },
  empty: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 13, textAlign: 'center', marginTop: 40 },
});
