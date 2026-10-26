import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Animated, Easing } from 'react-native';
import { Image } from 'expo-image';
import type { Product } from '../types';
import { useStoreSettings } from '../hooks/useStoreSettings';
import { useAuthStore } from '../store/authStore';
import { getProductSales } from '../lib/assistantData';
import type { SalesMap } from '../lib/assistantSales';
import { isSeniorProfession, pickAds, zaraAdsDelaySeconds } from '../lib/zaraAds';
import { useAssistantStore } from '../store/assistantStore';
import { colors, fonts, radius, spacing } from '../theme';

const AVATAR = require('../../assets/assistante-avatar.jpg');
const ROTATE_MS = 7000;
const MAX_ADS = 3;

const formatXAF = (n: number) => `${n.toLocaleString('fr-FR')} FCFA`;

// Publicité de Zara sur l'accueil (si l'admin la laisse gérer les publicités) : un article réel, avec un message qui ne dit que des faits VRAIS ; un toucher ouvre le chat de Zara sur cet article
// (commandes réelles, stock réel : lib/zaraAds). Un client haut placé (métier du compte) lit « Article rare » quand le stock est vraiment petit.
// Sans fait vrai à dire, la carte reste cachée.
export function ZaraAdCard({ products }: { products: Product[] }) {
  const { settings, isLoading } = useStoreSettings();
  const profession = useAuthStore((s) => s.profile?.profession);
  const enabled = settings.zara_ads_enabled === true;
  const delaySeconds = zaraAdsDelaySeconds(settings.zara_ads_delay_seconds);
  // la publicité apparaît après le délai choisi par l'admin (compté dès l'ouverture de l'accueil)
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!enabled || isLoading) return;
    const id = setTimeout(() => setReady(true), delaySeconds * 1000);
    return () => clearTimeout(id);
  }, [enabled, isLoading, delaySeconds]);

  const [sales, setSales] = useState<SalesMap | null>(null);
  const [index, setIndex] = useState(0);
  const [seed] = useState(() => Math.floor(Date.now() / 3_600_000)); // les choix changent chaque heure
  const fade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    getProductSales().then((m) => alive && setSales(m));
    return () => {
      alive = false;
    };
  }, [enabled]);

  const senior = isSeniorProfession(profession);
  const ads = useMemo(
    () =>
      enabled && sales
        ? pickAds(products, (p) => ({ id: p.id, name: p.name, price: p.price, stock: p.stock, hasImage: !!p.images?.[0] }), sales, { senior, limit: MAX_ADS, seed })
        : [],
    [enabled, sales, products, senior, seed]
  );

  useEffect(() => {
    if (ads.length <= 1) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % ads.length), ROTATE_MS);
    return () => clearInterval(id);
  }, [ads.length]);

  useEffect(() => {
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 450, easing: Easing.out(Easing.quad), useNativeDriver: false }).start();
  }, [index, ads.length]);

  if (!ready || ads.length === 0) return null;
  const ad = ads[index % ads.length];
  const p = ad.item;

  return (
    <View style={styles.wrap} testID="zara-ad">
      <Pressable
        style={styles.card}
        accessibilityRole="button"
        accessibilityLabel={`Zara vous conseille : ${ad.line} ${p.name}. Toucher pour parler à Zara.`}
        // un clic : Zara ouvre le chat et prend le relais comme vendeuse (elle présente l'article et propose de le commander)
        onPress={() => useAssistantStore.getState().adviseProduct(p.slug)}
        testID="zara-ad-open"
      >
        <Animated.View style={{ opacity: fade }}>
          <View style={styles.header}>
            <Image source={AVATAR} style={styles.avatar} contentFit="cover" />
            <View style={styles.headerText}>
              <Text style={styles.who}>ZARA VOUS CONSEILLE</Text>
              <Text style={styles.line} testID="zara-ad-line">
                {ad.line}
              </Text>
            </View>
          </View>
          <View style={styles.product}>
            <Image source={{ uri: p.images[0] }} style={styles.thumb} contentFit="cover" />
            <View style={styles.productText}>
              <Text style={styles.name} numberOfLines={2} testID="zara-ad-name">
                {p.name.trim()}
              </Text>
              <Text style={styles.price}>{formatXAF(p.price)}</Text>
            </View>
            <View style={styles.cta}>
              <Text style={styles.ctaText}>Voir avec Zara ›</Text>
            </View>
          </View>
        </Animated.View>
        {ads.length > 1 && (
          <View style={styles.dots}>
            {ads.map((a, i) => (
              <View key={a.item.id} style={[styles.dot, i === index % ads.length && styles.dotActive]} />
            ))}
          </View>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: spacing.md, marginTop: spacing.md },
  card: {
    borderWidth: 1.5,
    borderColor: colors.gold,
    borderRadius: radius.lg,
    backgroundColor: colors.panel,
    padding: spacing.md - 4,
    shadowColor: colors.gold,
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 3,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: colors.gold },
  headerText: { flex: 1, minWidth: 0 },
  who: { fontFamily: fonts.bodyBold, fontSize: 10, letterSpacing: 2, color: colors.goldLight },
  line: { fontFamily: fonts.bodySemiBold, fontSize: 14, lineHeight: 19, color: colors.cream, marginTop: 2 },
  product: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: spacing.sm + 2,
    backgroundColor: colors.panelAlt,
    borderRadius: radius.md,
    padding: 8,
  },
  thumb: { width: 54, height: 54, borderRadius: radius.sm, backgroundColor: colors.cream },
  productText: { flex: 1, minWidth: 0 },
  name: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.cream },
  price: { fontFamily: fonts.displayBold, fontSize: 15, color: colors.goldLight, marginTop: 2 },
  cta: { backgroundColor: colors.gold, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 8 },
  ctaText: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.background },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 5, marginTop: spacing.sm },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: 'rgba(244, 239, 228, 0.25)' },
  dotActive: { width: 14, backgroundColor: '#FECB00' },
});
