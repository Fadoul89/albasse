import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, StyleSheet, FlatList, Platform, Pressable, ScrollView } from 'react-native';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation } from '@react-navigation/native';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts, spacing } from '../theme';
import { useProducts } from '../hooks/useProducts';
import { useCategories } from '../hooks/useCategories';
import { ProductCard } from '../components/ProductCard';
import { useProductGrid } from '../hooks/useProductGrid';
import { GRID_GAP } from '../lib/productGrid';
import { ScreenHeader } from '../components/ScreenHeader';
import { MenuLauncher } from '../components/SideMenu';
import { trackCategoryView, trackSearchQuery } from '../lib/browsingTracker';
import { inFamily, parentOf, subCategoriesOf } from '../lib/subCategories';
import { clampPage, pageCount, pageSlice } from '../lib/pagination';
import { ShopPageBar } from '../components/ShopPageBar';

// Pages de la liste (demande du patron, 16 novembre 2026) : 20 articles par page sur téléphone (10 lignes de 2), 24 sur grand écran (6 lignes de 4).
// Toute la page est affichée d'un coup : plus de zone vide en bas pendant que la liste charge en défilant.
export const categoryPageSize = (columns: number) => (columns >= 3 ? 24 : 20);

interface Props {
  route: RouteProp<RootStackParamList, 'Category'>;
}

export function CategoryScreen({ route }: Props) {
  const { slug } = route.params;
  const listRef = useRef<FlatList>(null);
  const { products } = useProducts();
  const { categories } = useCategories();
  const [query, setQuery] = useState('');
  // la grille suit la vraie largeur de la liste : 2 colonnes sur un téléphone, jusqu'à 6 sur un grand écran
  const { columns, cardWidth, onLayout: onGridLayout } = useProductGrid(spacing.md);

  const navigation = useNavigation();
  const showAll = slug === 'tous';
  const category = showAll ? null : categories.find((c) => c.slug === slug);
  const name = showAll ? 'Tous les articles' : category?.name ?? slug;
  // sous-catégories : la catégorie principale de la page (elle-même, ou son parent) et ses sous-catégories, montrées en petites puces
  const main = category ? parentOf(categories, category) ?? category : null;
  const subs = main ? subCategoriesOf(categories, main.id) : [];
  const setParams = (p: { slug?: string; page?: number }) => (navigation as unknown as { setParams: (q: { slug?: string; page?: number }) => void }).setParams(p);
  // une autre sous-catégorie : on repart de la page 1
  const openCategory = (target: string) => setParams({ slug: target, page: undefined });

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

  const size = categoryPageSize(columns);
  const pages = pageCount(filtered.length, size);
  const current = clampPage(Number(route.params.page ?? 1), filtered.length, size);
  const visible = useMemo(() => pageSlice(filtered, current, size), [filtered, current, size]);
  const goToPage = (n: number) => {
    setParams({ page: n > 1 ? n : undefined });
    // la nouvelle page commence en haut
    setTimeout(() => listRef.current?.scrollToOffset({ offset: 0, animated: false }), 30);
  };
  // une nouvelle recherche : page 1
  const onSearch = (text: string) => {
    setQuery(text);
    if (current > 1) setParams({ page: undefined });
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader title={name} showBack right={<MenuLauncher />} />
      <View style={styles.searchWrap}>
        <TextInput
          value={query}
          onChangeText={onSearch}
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
        ref={listRef}
        key={columns}
        data={visible}
        initialNumToRender={size}
        testID="category-list"
        keyExtractor={(item) => item.id}
        numColumns={columns}
        columnWrapperStyle={{ gap: GRID_GAP }}
        onLayout={onGridLayout}
        // avec une barre de pages : de la place en bas, pour que le bouton rond de Zara ne cache ni « › » ni « Page suivante »
        contentContainerStyle={[styles.grid, pages > 1 && styles.gridWithPages]}
        renderItem={({ item }) => <ProductCard product={item} width={cardWidth} />}
        ListEmptyComponent={<Text style={styles.empty}>Aucun produit trouvé.</Text>}
        ListFooterComponent={<ShopPageBar current={current} count={pages} total={filtered.length} size={size} onGo={goToPage} testID="category-pages" />}
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
  gridWithPages: { paddingBottom: 190 },
  empty: {
    color: colors.creamFaint,
    fontFamily: fonts.body,
    textAlign: 'center',
    marginTop: 40,
  },
});
