// « Voici ce qui vous attend » : 4 vrais articles (photo, nom, prix) et les avantages, au-dessus du formulaire d'inscription de l'écran d'entrée.
// Les articles viennent de la boutique ; rien n'est inventé. Ils CHANGENT TOUT SEULS (demande du patron, 6 novembre) : un nouveau jeu de 4 articles toutes les
// ENTRY_ROTATE_MS, avec un petit fondu. Si la boutique ne répond pas, la bande n'apparaît pas (le formulaire reste seul, comme avant).
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, AccessibilityInfo } from 'react-native';
import { Image } from 'expo-image';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { colors, fonts, radius, spacing } from '../theme';
import { ENTRY_BENEFITS, ENTRY_PRICE_BANDS, ENTRY_ROTATE_MS, entryPrice, pickEntrySets, type EntryCategory, type EntryProduct } from '../lib/entryScreen';

const FADE_OUT_MS = 250;
const FADE_IN_MS = 350;

export function EntryPreview() {
  const [sets, setSets] = useState<EntryProduct[][]>([]);
  const [index, setIndex] = useState(0);
  // appareil réglé sur « moins d'animations » : le 1er jeu reste, rien ne bouge tout seul
  const [reduceMotion, setReduceMotion] = useState(false);
  const fade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let alive = true;
    (async () => {
      try {
        // une demande par fourchette de prix (10 000 à 15 000 et 20 000 à 40 000) : les articles les plus aimés de chacune
        const [bands, c] = await Promise.all([
          Promise.all(
            ENTRY_PRICE_BANDS.map((band) =>
              supabase
                .from('products')
                .select('id,name,price,images,stock,is_active,category_id,likes_count,created_at')
                .eq('is_active', true)
                .gt('stock', 0)
                .gte('price', band.min)
                .lte('price', band.max)
                .order('likes_count', { ascending: false, nullsFirst: false })
                .limit(100),
            ),
          ),
          supabase.from('categories').select('*'),
        ]);
        if (!alive) return;
        const products = bands.flatMap((b) => (b.error || !b.data ? [] : (b.data as EntryProduct[])));
        if (products.length === 0) return;
        const categories = ((c.data as EntryCategory[] | null) ?? []).filter((x) => x && x.id);
        const picked = pickEntrySets(products, categories);
        setSets(picked);
        setIndex(0);
        // les photos des jeux suivants sont chargées d'avance : pas de case vide quand un jeu en remplace un autre
        const urls = picked.flat().map((p) => (p.images ?? []).find((u) => !!u)).filter((u): u is string => !!u);
        Image.prefetch(urls).catch(() => {});
      } catch {
        // la bande est un plus : sans réponse, on garde le formulaire seul
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then((on) => setReduceMotion(!!on))
      .catch(() => {});
  }, []);

  // un nouveau jeu toutes les ENTRY_ROTATE_MS : fondu sortant, on change de jeu, fondu entrant
  useEffect(() => {
    if (sets.length < 2 || reduceMotion) return;
    let alive = true;
    const timer = setInterval(() => {
      Animated.timing(fade, { toValue: 0, duration: FADE_OUT_MS, useNativeDriver: false }).start(({ finished }) => {
        if (!alive || !finished) return;
        setIndex((i) => (i + 1) % sets.length);
        Animated.timing(fade, { toValue: 1, duration: FADE_IN_MS, useNativeDriver: false }).start();
      });
    }, ENTRY_ROTATE_MS);
    return () => {
      alive = false;
      clearInterval(timer);
      fade.stopAnimation();
      fade.setValue(1);
    };
  }, [sets.length, reduceMotion, fade]);

  const products = sets[index] ?? [];

  return (
    <View style={styles.wrap} testID="entry-preview">
      {products.length > 0 && (
        <>
          <Text style={styles.label}>Voici ce qui vous attend</Text>
          <Animated.View style={[styles.cards, { opacity: fade }]} testID="entry-set">
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
          </Animated.View>
          {sets.length > 1 && (
            <View style={styles.dots} testID="entry-dots">
              {sets.map((_, i) => (
                <View key={i} style={[styles.dot, i === index && styles.dotOn]} />
              ))}
            </View>
          )}
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
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 5, marginTop: 6 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.25)' },
  dotOn: { backgroundColor: colors.goldLight },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  chip: { backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.19)', borderRadius: 14, paddingHorizontal: 8, paddingVertical: 4 },
  chipText: { color: colors.cream, fontFamily: fonts.bodySemiBold, fontSize: 11 },
});
