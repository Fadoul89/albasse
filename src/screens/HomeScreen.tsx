import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, FlatList, Pressable, Animated, Easing, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts, radius, spacing } from '../theme';
import { useProducts } from '../hooks/useProducts';
import { useCategories } from '../hooks/useCategories';
import { useStoreSettings } from '../hooks/useStoreSettings';
import { CategoryTile } from '../components/CategoryTile';
import { ProductCard } from '../components/ProductCard';
import { CountdownTimer } from '../components/CountdownTimer';
import { StoreFooter } from '../components/StoreFooter';
import { CustomerNotificationBell } from '../components/CustomerNotificationBell';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { SideAdBanner } from '../components/SideAdBanner';
import { ChadFlag } from '../components/ChadFlag';
import { CityClock } from '../components/CityClock';
import { ZaraAdCard } from '../components/ZaraAdCard';
import { WebPushBanner } from '../components/WebPushBanner';
import { fetchOnlineCount, onlineLabel } from '../lib/onlineCount';
import { coldSeasonActive, coldSeasonPicks } from '../lib/coldSeason';

const ONLINE_REFRESH_MS = 30000;

const CHAD_YELLOW = '#FECB00';
const CHAD_RED = '#D21034';
// Sur le fond bleu du site, le bleu et le rouge du drapeau sont trop sombres pour du texte :
// l'accroche utilise leurs teintes claires (le jaune reste celui du drapeau).
const TAGLINE_BLUE = '#6EA4FF';
const TAGLINE_RED = '#FF5A70';

export function HomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { products: allProducts, isLoading } = useProducts();
  const products = allProducts.filter((p) => p.is_active);
  const { categories } = useCategories();
  const { settings } = useStoreSettings();
  const { width } = useWindowDimensions();
  const hasAdItems = settings.left_ad_items.length > 0 || settings.right_ad_items.length > 0;
  const showMobileAds = hasAdItems;
  const phoneAds = width < 700;
  const gridColumns = width >= 700 ? 4 : 2;

  const flashSale = products.filter((p) => p.is_flash_sale);
  const flashEndsAt = flashSale[0]?.flash_sale_ends_at;
  // saison fraîche (jusqu'à fin décembre) : les vrais blousons et manteaux en vente, la plus grande remise réelle d'abord (jamais un porte-manteau)
  const coldPicks = coldSeasonActive() ? coldSeasonPicks(products, (p) => ({ name: p.name, price: p.price, compareAt: p.compare_at_price, stock: p.stock, hasImage: !!p.images?.[0] }), 6) : [];

  const glow = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
        Animated.timing(glow, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
      ])
    ).start();
  }, []);
  const glowRadius = glow.interpolate({ inputRange: [0, 1], outputRange: [4, 16] });
  const glowOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });

  const blink = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(blink, { toValue: 1, duration: 500, useNativeDriver: false }),
        Animated.timing(blink, { toValue: 0, duration: 500, useNativeDriver: false }),
      ])
    ).start();
  }, []);
  const blinkOpacity = blink.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] });

  // vrai nombre de personnes en ligne (lib/onlineCount), relu toutes les 30 s ; caché tant que la base ne répond pas
  const [onlineCount, setOnlineCount] = useState<number | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () => fetchOnlineCount().then((n) => alive && setOnlineCount(n));
    load();
    const interval = setInterval(load, ONLINE_REFRESH_MS);
    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingBottom: 40 }}
    >
      <WebPushBanner whenInstalled />
      {/* langue à gauche, nombre en ligne au milieu, cloche à droite */}
      <View style={styles.topBar}>
        <View style={styles.topBarSide}>
          <LanguageSwitcher />
        </View>
        {onlineCount !== null && (
          <View style={styles.visitorsPill} testID="home-online">
            <Animated.View style={[styles.liveDot, { opacity: blinkOpacity }]} />
            <Text style={styles.visitorsText}>{onlineLabel(onlineCount)}</Text>
          </View>
        )}
        <View style={[styles.topBarSide, styles.topBarSideRight]}>
          <CustomerNotificationBell />
        </View>
      </View>

      <View style={styles.independenceBanner}>
        <ChadFlag width={26} height={18} />
        <Text style={styles.independenceText}>
          🛍️ Première plateforme de vente en ligne au Tchad
        </Text>
        <ChadFlag width={26} height={18} />
      </View>

      <LinearGradient
        colors={[colors.panelAlt, colors.background]}
        style={styles.banner}
      >
        <Text style={styles.brand}>ALBASSE</Text>
        <Text style={styles.brandSub}>SHOPPING</Text>
        <View style={styles.taglineFrame}>
          <View style={styles.taglineRow}>
            <Animated.Text
              style={[
                styles.taglineWord,
                { color: TAGLINE_BLUE, textShadowColor: TAGLINE_BLUE, textShadowRadius: glowRadius, opacity: glowOpacity },
              ]}
            >
              SERVICE
            </Animated.Text>
            <Animated.Text
              style={[
                styles.taglineWord,
                { color: CHAD_YELLOW, textShadowColor: CHAD_YELLOW, textShadowRadius: glowRadius, opacity: glowOpacity },
              ]}
            >
              QUALITÉ
            </Animated.Text>
            <Animated.Text
              style={[
                styles.taglineWord,
                { color: TAGLINE_RED, textShadowColor: TAGLINE_RED, textShadowRadius: glowRadius, opacity: glowOpacity },
              ]}
            >
              GARANTIE
            </Animated.Text>
          </View>
        </View>
        {/* heure locale des villes du Tchad, une ville toutes les 10 secondes (demande du patron) */}
        <CityClock />
      </LinearGradient>

      {/* une seule ligne qui défile, sans titre « Catégories » (demande du patron) */}
      <View style={styles.categoriesSection} testID="home-categories">
        <FlatList
          data={categories}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <CategoryTile category={item} />}
          initialNumToRender={50}
        />
      </View>

      {/* publicité de Zara (si l'admin lui confie les publicités) : un vrai article, des faits vrais seulement */}
      <ZaraAdCard products={products} />

      {showMobileAds && (
        // téléphone : chaque bande de publicité prend toute la largeur, plus haute (les photos se voient en grand)
        <View style={[styles.mobileAdsSection, phoneAds && styles.mobileAdsStacked]} testID="home-ads">
          {settings.left_ad_items.length > 0 && (
            <View style={phoneAds ? undefined : { flex: 1 }}>
              <SideAdBanner items={settings.left_ad_items} height={phoneAds ? 150 : 120} />
            </View>
          )}
          {settings.right_ad_items.length > 0 && (
            <View style={phoneAds ? undefined : { flex: 1 }}>
              <SideAdBanner items={settings.right_ad_items} height={phoneAds ? 150 : 120} />
            </View>
          )}
        </View>
      )}

      {flashSale.length > 0 && flashEndsAt && (
        <View style={styles.flashSection}>
          <View style={styles.flashHeader}>
            <View>
              <Animated.View
                style={[
                  styles.flashBadge,
                  {
                    shadowColor: CHAD_RED,
                    shadowRadius: glowRadius,
                    shadowOpacity: glowOpacity,
                    shadowOffset: { width: 0, height: 0 },
                    opacity: blinkOpacity,
                  },
                ]}
              >
                <Text style={styles.flashBadgeText}>⚡ VENTE FLASH</Text>
              </Animated.View>
              <Text style={styles.flashSubtitle}>Offres limitées dans le temps</Text>
            </View>
            <CountdownTimer endsAt={flashEndsAt} />
          </View>
          <FlatList
            data={flashSale}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingHorizontal: spacing.md }}
            renderItem={({ item }) => (
              <View style={{ marginRight: spacing.md }}>
                <ProductCard product={item} />
              </View>
            )}
          />
        </View>
      )}

      {coldPicks.length > 0 && (
        <View style={styles.coldSection} testID="home-cold-season">
          <View style={styles.coldHeader}>
            <Text style={styles.coldBadge}>🧥 SAISON FRAÎCHE</Text>
            <Text style={styles.coldSubtitle}>Blousons et manteaux</Text>
          </View>
          <FlatList
            data={coldPicks}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingHorizontal: spacing.md }}
            renderItem={({ item }) => (
              <View style={{ marginRight: spacing.md }}>
                <ProductCard product={item} />
              </View>
            )}
          />
        </View>
      )}

      {/* juste sous les cartes (vente flash, saison fraîche) : elles ont déjà leur marge en bas */}
      <Pressable
        style={[styles.travelBanner, (flashSale.length > 0 && flashEndsAt) || coldPicks.length > 0 ? styles.travelAfterFlash : null]}
        onPress={() => navigation.navigate('Travel')}
      >
        <Text style={styles.travelIcon}>✈️</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.travelTitle}>Voyage — Billet d'avion</Text>
          <Text style={styles.travelSubtitle} numberOfLines={1}>
            Réservez en quelques clics
          </Text>
        </View>
        <Text style={styles.travelArrow}>→</Text>
      </Pressable>

      <View style={styles.collectionSection}>
        <Text style={styles.sectionTitle}>Toute la collection</Text>
        <View style={styles.grid}>
          {products.map((p) => (
            <ProductCard key={p.id} product={p} columns={gridColumns} />
          ))}
        </View>
        {isLoading && <Text style={styles.loading}>Chargement…</Text>}
      </View>

      <StoreFooter />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.panelAlt,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  topBarSide: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  topBarSideRight: { justifyContent: 'flex-end' },
  visitorsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#3ddc6f',
  },
  visitorsText: { color: colors.creamMuted, fontFamily: fonts.bodyMedium, fontSize: 10.5 },
  independenceBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.panel,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
  },
  independenceText: {
    color: colors.goldLight,
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    textAlign: 'center',
    flexShrink: 1,
  },
  banner: {
    paddingVertical: 22,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  brand: {
    fontFamily: fonts.displayBold,
    fontSize: 34,
    color: colors.goldLight,
    letterSpacing: 4,
  },
  brandSub: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.cream,
    letterSpacing: 8,
    marginTop: 2,
  },
  taglineFrame: {
    marginTop: 14,
    borderWidth: 1.5,
    borderColor: colors.gold,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.panel,
  },
  taglineRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  taglineWord: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    letterSpacing: 1,
    textShadowOffset: { width: 0, height: 0 },
  },
  flashSection: { marginTop: spacing.lg },
  flashHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  flashBadge: {
    backgroundColor: CHAD_RED,
    borderWidth: 2,
    borderColor: colors.cream,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: 'flex-start',
    elevation: 6,
  },
  flashBadgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    color: colors.cream,
    letterSpacing: 1,
  },
  flashSubtitle: { fontFamily: fonts.body, fontSize: 12, color: colors.creamFaint, marginTop: 6 },
  coldSection: { marginTop: spacing.lg },
  coldHeader: { paddingHorizontal: spacing.md, marginBottom: spacing.md },
  coldBadge: { fontFamily: fonts.displayBold, fontSize: 17, color: colors.goldLight, letterSpacing: 1 },
  coldSubtitle: { fontFamily: fonts.body, fontSize: 12, color: colors.creamFaint, marginTop: 4 },
  collectionSection: { marginTop: spacing.md, paddingHorizontal: spacing.md },
  // les catégories remontent juste sous le bandeau ALBASSE SHOPPING
  categoriesSection: { marginTop: spacing.md, paddingHorizontal: spacing.md },
  mobileAdsSection: { flexDirection: 'row', marginTop: spacing.lg, paddingHorizontal: spacing.md, gap: spacing.md },
  mobileAdsStacked: { flexDirection: 'column', gap: spacing.sm },
  sectionTitle: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: colors.cream,
    marginBottom: spacing.md,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  travelBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gold,
    borderRadius: radius.lg,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    marginHorizontal: spacing.md,
    marginTop: spacing.lg,
    gap: 12,
  },
  travelAfterFlash: { marginTop: 0 },
  travelIcon: { fontSize: 22 },
  travelTitle: { color: colors.background, fontFamily: fonts.bodyBold, fontSize: 15 },
  travelSubtitle: { color: colors.background, fontFamily: fonts.bodyMedium, fontSize: 12, marginTop: 2, opacity: 0.75 },
  travelArrow: { color: colors.background, fontSize: 18, fontFamily: fonts.bodyBold },
  loading: { color: colors.creamFaint, fontFamily: fonts.body, textAlign: 'center', marginTop: 12 },
});
