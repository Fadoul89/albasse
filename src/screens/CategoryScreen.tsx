import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, StyleSheet, FlatList, Platform, Pressable, ScrollView, useWindowDimensions } from 'react-native';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation } from '@react-navigation/native';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts, spacing } from '../theme';
import { useProducts } from '../hooks/useProducts';
import { useCategories } from '../hooks/useCategories';
import { ProductCard } from '../components/ProductCard';
import { ScreenHeader } from '../components/ScreenHeader';
import { trackCategoryView, trackSearchQuery } from '../lib/browsingTracker';
import { inFamily, parentOf, subCategoriesOf } from '../lib/subCategories';

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

  const navigation = useNavigation();
  const showAll = slug === 'tous';
  const category = showAll ? null : categories.find((c) => c.slug === slug);
  const name = showAll ? 'Tous les articles' : category?.name ?? slug;
  // sous-catégories : la catégorie principale de la page (elle-même, ou son parent) et ses sous-catégories, montrées en petites puces
  const main = category ? parentOf(categories, category) ?? category : null;
  const subs = main ? subCategoriesOf(categories, main.id) : [];
  const openCategory = (target: string) => (navigation as unknown as { setParams: (p: { slug: string }) => void }).setParams({ slug: target });

  useEffect(() => {
    if (Platform.OS === 'web') {
      document.title = `${name} — Albasse Shopping`;
    }
  }, [name]);

  // Suivi pour Zara : la catégorie ouverte, et ce que le visiteur y cherche
  // (une sous-catégorie compte pour sa catégorie principale)
  const categorySlug = main?.slug;
  useEffect(() => {
    if (categorySlug) trackCategoryView(categorySlug, main?.name ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categorySlug]);
  useEffect(() => {
    if (!query.trim()) return undefined;
    const t = setTimeout(() => trackSearchQuery(query), 1000);
    return () => clearTimeout(t);
  }, [query]);

  const filtered = useMemo(() => {
    return products.filter((p) => {
      // une catégorie principale montre aussi les articles de ses sous-catégories
      const inCategory = showAll ? true : category ? inFamily(categories, p.category_id, category.id) : false;
      if (!p.is_active) return false;
      const matchesQuery = query.trim()
        ? p.name.toLowerCase().includes(query.trim().toLowerCase())
        : true;
      return inCategory && matchesQuery;
    });
  }, [products, categories, category, showAll, query]);

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
      {subs.length > 0 && main && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll} contentContainerStyle={styles.chips} testID="category-subchips" role="tablist">
          {[main, ...subs].map((c) => {
            const active = category?.id === c.id;
            return (
              <Pressable
                key={c.id}
                testID={c.id === main.id ? 'category-chip-all' : `category-chip-${c.slug}`}
                role="tab"
                aria-selected={active}
                onPress={() => !active && openCategory(c.slug)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{c.id === main.id ? 'Tout' : c.name}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
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
  chipsScroll: { flexGrow: 0, flexShrink: 0, marginBottom: spacing.md },
  chips: { paddingHorizontal: spacing.md, gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel },
  chipActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  chipText: { color: colors.cream, fontFamily: fonts.bodyMedium, fontSize: 13 },
  chipTextActive: { color: colors.background },
  grid: { paddingHorizontal: spacing.md, paddingBottom: 40 },
  empty: {
    color: colors.creamFaint,
    fontFamily: fonts.body,
    textAlign: 'center',
    marginTop: 40,
  },
});
