import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, StyleSheet, FlatList, Pressable } from 'react-native';
import { colors, fonts, spacing } from '../theme';
import { useProducts } from '../hooks/useProducts';
import { ProductCard } from '../components/ProductCard';
import { MenuLauncher } from '../components/SideMenu';
import { trackSearchQuery } from '../lib/browsingTracker';
import { normalize, tokenize } from '../lib/assistantBrain';
import { buildVocabulary, suggestWords } from '../lib/spellSuggest';
import type { Product } from '../types';
import { clampPage, pageCount, pageSlice } from '../lib/pagination';
import { ShopPageBar } from '../components/ShopPageBar';

// Pages de résultats (comme les catégories) : 20 articles par page, affichés d'un coup, puis « ‹ 1 2 3 … › » et « Page suivante ».
const SEARCH_PAGE_SIZE = 20;

// Le texte de l'article sans accents ni majuscules : « elegant » trouve « Élégant », « Montre homme » trouve « Montre Naviforce pour homme ».
const haystack = (p: Product) => normalize(`${p.name} ${p.description ?? ''} ${p.category?.name ?? ''}`);

export function SearchScreen() {
  const { products } = useProducts();
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const listRef = useRef<FlatList>(null);

  // Suivi pour Zara : la recherche est notée une seconde après la dernière lettre (jamais lettre après lettre)
  useEffect(() => {
    if (!query.trim()) return undefined;
    const t = setTimeout(() => trackSearchQuery(query), 1000);
    return () => clearTimeout(t);
  }, [query]);

  // Tous les mots écrits doivent se retrouver dans l'article. Rien trouvé : si un mot ressemble à un mot de la boutique (« parfun » -> « parfum »),
  // on propose « Vouliez-vous dire… ? » et on montre déjà les articles de ce mot.
  const { filtered, suggestion } = useMemo(() => {
    if (!query.trim()) return { filtered: products, suggestion: null as string | null };
    const active = products.filter((p) => p.is_active);
    const match = (words: string[], raw: string) =>
      active.filter((p) => {
        const h = haystack(p);
        return words.length > 0 ? words.every((w) => h.includes(w)) : h.includes(raw);
      });
    const words = tokenize(query);
    const found = match(words, normalize(query));
    if (found.length > 0) return { filtered: found, suggestion: null };
    const fixed = suggestWords(words, buildVocabulary(active.flatMap((p) => tokenize(`${p.name} ${p.category?.name ?? ''}`))));
    if (fixed) {
      const alt = match(fixed, '');
      if (alt.length > 0) return { filtered: alt, suggestion: fixed.join(' ') };
    }
    return { filtered: found, suggestion: null };
  }, [products, query]);

  const pages = pageCount(filtered.length, SEARCH_PAGE_SIZE);
  const current = clampPage(page, filtered.length, SEARCH_PAGE_SIZE);
  const visible = useMemo(() => pageSlice(filtered, current, SEARCH_PAGE_SIZE), [filtered, current]);
  const goToPage = (n: number) => {
    setPage(n);
    setTimeout(() => listRef.current?.scrollToOffset({ offset: 0, animated: false }), 30);
  };
  // une nouvelle recherche : page 1
  const onSearch = (text: string) => {
    setQuery(text);
    setPage(1);
  };

  return (
    <View style={styles.screen}>
      <View style={styles.titleRow}>
        <View style={styles.titleSide}>
          <MenuLauncher />
        </View>
        <Text style={styles.headerTitle}>Recherche</Text>
        <View style={styles.titleSide} />
      </View>
      <View style={styles.searchWrap}>
        <TextInput
          value={query}
          onChangeText={onSearch}
          placeholder="Rechercher un produit…"
          placeholderTextColor={colors.creamFaint}
          style={styles.search}
          autoFocus
        />
      </View>
      <FlatList
        ref={listRef}
        data={visible}
        initialNumToRender={SEARCH_PAGE_SIZE}
        testID="search-list"
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={{ justifyContent: 'space-between' }}
        // avec une barre de pages : de la place en bas, pour que le bouton rond de Zara ne la cache pas
        contentContainerStyle={[styles.grid, pages > 1 && styles.gridWithPages]}
        renderItem={({ item }) => <ProductCard product={item} />}
        ListHeaderComponent={
          suggestion ? (
            <View style={styles.suggestBox}>
              <Text style={styles.suggestMuted} testID="search-no-result">Aucun résultat pour « {query.trim()} ».</Text>
              <Pressable onPress={() => onSearch(suggestion)} accessibilityRole="button" hitSlop={8} testID="search-suggestion">
                <Text style={styles.suggestText}>
                  Vouliez-vous dire <Text style={styles.suggestWord}>« {suggestion} »</Text> ?
                </Text>
              </Pressable>
            </View>
          ) : null
        }
        ListEmptyComponent={<Text style={styles.empty}>Aucun résultat.</Text>}
        ListFooterComponent={<ShopPageBar current={current} count={pages} total={filtered.length} size={SEARCH_PAGE_SIZE} onGo={goToPage} testID="search-pages" />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, paddingTop: 50 },
  titleRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, marginBottom: spacing.md },
  titleSide: { width: 44 },
  headerTitle: {
    flex: 1,
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.cream,
    textAlign: 'center',
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
  gridWithPages: { paddingBottom: 190 },
  suggestBox: { marginBottom: spacing.md, gap: 4 },
  suggestMuted: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 13 },
  suggestText: { color: colors.cream, fontFamily: fonts.bodyMedium, fontSize: 15 },
  suggestWord: { color: colors.gold, fontFamily: fonts.bodySemiBold, textDecorationLine: 'underline' },
  empty: { color: colors.creamFaint, fontFamily: fonts.body, textAlign: 'center', marginTop: 40 },
});
