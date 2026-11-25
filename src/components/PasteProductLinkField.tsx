import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { colors, fonts, radius, spacing } from '../theme';
import { findProductByPastedLink } from '../lib/productLink';

// Alternative à la recherche par nom : coller le lien de l'article pour le sélectionner tout de suite.
export function PasteProductLinkField<T extends { slug: string; name: string }>({
  products,
  onFound,
  testID,
}: {
  products: T[];
  onFound: (product: T) => void;
  testID?: string;
}) {
  const [value, setValue] = useState('');
  const [notFound, setNotFound] = useState(false);

  const handleChange = (text: string) => {
    setValue(text);
    setNotFound(false);
    const found = findProductByPastedLink(text, products);
    if (found) {
      onFound(found);
      setValue('');
      return;
    }
    // un lien d'article reconnu mais qui ne correspond à aucun article (ex : supprimé, lien mal copié)
    if (text.trim().includes('/produit/')) setNotFound(true);
  };

  return (
    <View style={{ marginBottom: spacing.sm }}>
      <TextInput
        value={value}
        onChangeText={handleChange}
        placeholder="Ou collez le lien de l'article ici…"
        placeholderTextColor={colors.creamFaint}
        autoCapitalize="none"
        style={styles.input}
        testID={testID}
      />
      {notFound && <Text style={styles.error}>Aucun article ne correspond à ce lien.</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.cream,
    fontFamily: fonts.body,
    borderWidth: 1,
    borderColor: colors.border,
  },
  error: { color: colors.errorText, fontFamily: fonts.body, fontSize: 11, marginTop: 4 },
});
