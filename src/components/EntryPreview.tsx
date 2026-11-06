// « Voici ce qui vous attend » : 4 vrais articles (photo, nom, prix) et les avantages, au-dessus du formulaire d'inscription de l'écran d'entrée.
// Les articles viennent de la boutique ; rien n'est inventé. Si la boutique ne répond pas, la bande n'apparaît pas (le formulaire reste seul, comme avant).
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { colors, fonts, radius, spacing } from '../theme';
import { ENTRY_BENEFITS, ENTRY_PRICE_MAX, ENTRY_PRICE_MIN, entryPrice, pickEntryProducts, type EntryCategory, type EntryProduct } from '../lib/entryScreen';

export function EntryPreview() {
  const [products, setProducts] = useState<EntryProduct[]>([]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let alive = true;
    (async () => {
      try {
        const [p, c] = await Promise.all([
          supabase
            .from('products')
            .select('id,name,price,images,stock,is_active,category_id,likes_count,created_at')
            .eq('is_active', true)
            .gt('stock', 0)
            .gte('price', ENTRY_PRICE_MIN)
            .lte('price', ENTRY_PRICE_MAX)
            .order('likes_count', { ascending: false, nullsFirst: false })
            .limit(120),
          supabase.from('categories').select('*'),
        ]);
        if (!alive || p.error || !p.data) return;
        const categories = ((c.data as EntryCategory[] | null) ?? []).filter((x) => x && x.id);
        setProducts(pickEntryProducts(p.data as EntryProduct[], categories));
      } catch {
        // la bande est un plus : sans réponse, on garde le formulaire seul
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <View style={styles.wrap} testID="entry-preview">
      {products.length > 0 && (
        <>
          <Text style={styles.label}>Voici ce qui vous attend</Text>
          <View style={styles.cards}>
            {products.map((p, i) => (
              <View key={p.id} style={styles.card} testID={`entry-product-${i}`}>
                <Image source={{ uri: (p.images ?? []).find((u) => !!u) ?? undefined }} style={styles.photo} contentFit="cover" />
                <Text style={styles.price} numberOfLines={1}>
                  {entryPrice(p.price)}
                </Text>
                <Text style={styles.name} numberOfLines={1}>
                  {p.name.trim()}
                </Text>
              </View>
            ))}
          </View>
        </>
      )}
      <View style={styles.chips} testID="entry-benefits">
        {ENTRY_BENEFITS.map((b) => (
          <View key={b} style={styles.chip}>
            <Text style={styles.chipText}>{b}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', maxWidth: 420, marginTop: spacing.md },
  label: { color: colors.creamMuted, fontFamily: fonts.bodySemiBold, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
  cards: { flexDirection: 'row', gap: 7 },
  card: { flex: 1, backgroundColor: colors.panel, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  photo: { width: '100%', aspectRatio: 1.2, backgroundColor: '#ffffff' },
  price: { color: colors.goldLight, fontFamily: fonts.bodyBold, fontSize: 10.5, paddingHorizontal: 5, paddingTop: 4 },
  name: { color: colors.cream, fontFamily: fonts.body, fontSize: 9.5, paddingHorizontal: 5, paddingBottom: 5 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  chip: { backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.19)', borderRadius: 14, paddingHorizontal: 8, paddingVertical: 4 },
  chipText: { color: colors.cream, fontFamily: fonts.bodySemiBold, fontSize: 11 },
});
