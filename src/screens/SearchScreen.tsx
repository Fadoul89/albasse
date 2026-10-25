import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, StyleSheet, FlatList, Pressable } from 'react-native';
import { colors, fonts, spacing } from '../theme';
import { useProducts } from '../hooks/useProducts';
import { ProductCard } from '../components/ProductCard';
import { trackSearchQuery } from '../lib/browsingTracker';
import { normalize, tokenize } from '../lib/assistantBrain';
import { buildVocabulary, suggestWords } from '../lib/spellSuggest';
import type { Product } from '../types';

// Le texte de l'article sans accents ni majuscules : « elegant » trouve « Élégant », « Montre homme » trouve « Montre Naviforce pour homme ».
const haystack = (p: Product) => normalize(`${p.name} ${p.description ?? ''} ${p.category?.name ?? ''}`);

export function SearchScreen() {
  const { products } = useProducts();
  const [query, setQuery] = useState('');

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
        ListHeaderComponent={
          suggestion ? (
            <View style={styles.suggestBox}>
              <Text style={styles.suggestMuted} testID="search-no-result">Aucun résultat pour « {query.trim()} ».</Text>
              <Pressable onPress={() => setQuery(suggestion)} accessibilityRole="button" hitSlop={8} testID="search-suggestion">
                <Text style={styles.suggestText}>
                  Vouliez-vous dire <Text style={styles.suggestWord}>« {suggestion} »</Text> ?
                </Text>
              </Pressable>
            </View>
          ) : null
        }
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
  suggestBox: { marginBottom: spacing.md, gap: 4 },
  suggestMuted: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 13 },
  suggestText: { color: colors.cream, fontFamily: fonts.bodyMedium, fontSize: 15 },
  suggestWord: { color: colors.gold, fontFamily: fonts.bodySemiBold, textDecorationLine: 'underline' },
  empty: { color: colors.creamFaint, fontFamily: fonts.body, textAlign: 'center', marginTop: 40 },
});
