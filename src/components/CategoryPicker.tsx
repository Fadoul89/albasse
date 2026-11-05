// Choix d'une catégorie en deux temps (demande du patron, 5 novembre 2026) : on touche d'abord la catégorie PRINCIPALE (« Vêtements pour femmes »),
// puis ses sous-catégories s'affichent en dessous (« Pour les filles ») ; « Aucune sous-catégorie » range l'article directement dans la catégorie principale.
// Sert au formulaire d'un article et au filtre de la liste des produits (Admin). Les règles viennent de lib/subCategories.
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, fonts, radius, spacing } from '../theme';
import { mainCategories, rootOf, subCategoriesOf, type CatNode } from '../lib/subCategories';

interface Props<T extends CatNode> {
  categories: readonly T[];
  value: string | null; // la catégorie choisie : une catégorie principale ou une sous-catégorie
  onChange: (id: string | null) => void;
  testIDPrefix: string; // « product-category » → product-category-<adresse>, product-category-subs, product-category-sub-none
  allLabel?: string; // filtre : un premier choix « Toutes catégories » (valeur vide)
  subTitle?: string;
  subNoneLabel: (main: T) => string; // « Aucune sous-catégorie (directement dans « X ») »
  subHint?: (main: T) => string;
}

export function CategoryPicker<T extends CatNode>({ categories, value, onChange, testIDPrefix, allLabel, subTitle = 'Sous-catégorie', subNoneLabel, subHint }: Props<T>) {
  const main = rootOf(categories, value);
  const subs = main ? subCategoriesOf(categories, main.id) : [];
  return (
    <View testID={`${testIDPrefix}-picker`}>
      <View style={styles.row}>
        {allLabel ? (
          <Chip testID={`${testIDPrefix}-all`} label={allLabel} active={!value} onPress={() => onChange(null)} />
        ) : null}
        {mainCategories(categories).map((c) => (
          <Chip key={c.id} testID={`${testIDPrefix}-${c.slug}`} label={c.name} active={main?.id === c.id} onPress={() => onChange(c.id)} />
        ))}
      </View>
      {main && subs.length > 0 && (
        <View style={styles.subBox} testID={`${testIDPrefix}-subs`}>
          <Text style={styles.subTitle}>
            {subTitle} de « {main.name} »
          </Text>
          <View style={styles.row}>
            <Chip testID={`${testIDPrefix}-sub-none`} label={subNoneLabel(main)} active={value === main.id} onPress={() => onChange(main.id)} small />
            {subs.map((s) => (
              <Chip key={s.id} testID={`${testIDPrefix}-${s.slug}`} label={s.name} active={value === s.id} onPress={() => onChange(s.id)} small />
            ))}
          </View>
          {subHint ? <Text style={styles.subHint}>{subHint(main)}</Text> : null}
        </View>
      )}
    </View>
  );
}

function Chip({ label, active, onPress, testID, small }: { label: string; active: boolean; onPress: () => void; testID: string; small?: boolean }) {
  return (
    <Pressable testID={testID} role="radio" aria-checked={active} onPress={onPress} style={[styles.chip, small && styles.chipSmall, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel },
  chipSmall: { paddingVertical: 7 },
  chipActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  chipText: { color: colors.cream, fontFamily: fonts.bodyMedium, fontSize: 12 },
  chipTextActive: { color: colors.background },
  subBox: { marginTop: spacing.sm, marginBottom: spacing.md, paddingLeft: spacing.sm, borderLeftWidth: 2, borderLeftColor: colors.gold },
  subTitle: { color: colors.creamMuted, fontFamily: fonts.bodySemiBold, fontSize: 12, marginBottom: 6 },
  subHint: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 11, marginTop: 6 },
});
