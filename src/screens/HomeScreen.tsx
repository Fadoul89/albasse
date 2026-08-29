import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, FlatList, Pressable, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts, radius, spacing } from '../theme';
import { useProducts } from '../hooks/useProducts';
import { useCategories } from '../hooks/useCategories';
import { CategoryTile } from '../components/CategoryTile';
import { ProductCard } from '../components/ProductCard';
import { CountdownTimer } from '../components/CountdownTimer';
import { StoreFooter } from '../components/StoreFooter';
import { CartReminderBanner } from '../components/CartReminderBanner';
import { CustomerNotificationBell } from '../components/CustomerNotificationBell';
import { ChadFlag } from '../components/ChadFlag';

const CHAD_BLUE = '#0033A0';
const CHAD_YELLOW = '#FECB00';
const CHAD_RED = '#D21034';

export function HomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { products: allProducts, isLoading } = useProducts();
  const products = allProducts.filter((p) => p.is_active);
  const { categories } = useCategories();

  const flashSale = products.filter((p) => p.is_flash_sale);
  const flashEndsAt = flashSale[0]?.flash_sale_ends_at;

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

  const [visitorCount, setVisitorCount] = useState(() => 38 + Math.floor(Math.random() * 40));
  useEffect(() => {
    const interval = setInterval(() => {
      setVisitorCount((prev) => {
        const delta = Math.floor(Math.random() * 5) - 2;
        return Math.max(24, Math.min(140, prev + delta));
      });
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.topBar}>
        <View style={styles.topBarLeftGroup}>
          <View style={styles.topBarFrame}>
            <Text style={styles.welcomeText}>👋 Bienvenue sur Albasse Shopping</Text>
          </View>
          <View style={styles.topBarFrame}>
            <View style={styles.visitorsRow}>
              <Animated.View style={[styles.liveDot, { opacity: blinkOpacity }]} />
              <Animated.Text style={[styles.visitorsText, { opacity: blinkOpacity }]}>
                {visitorCount} personnes en ligne
              </Animated.Text>
            </View>
          </View>
        </View>
        <CustomerNotificationBell />
      </View>

      <View style={styles.independenceBanner}>
        <ChadFlag width={26} height={18} />
        <Text style={styles.independenceText}>
          🎉 66ᵉ Anniversaire de l'Indépendance du Tchad — 11 Août
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
                { color: CHAD_BLUE, textShadowColor: CHAD_BLUE, textShadowRadius: glowRadius, opacity: glowOpacity },
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
                { color: CHAD_RED, textShadowColor: CHAD_RED, textShadowRadius: glowRadius, opacity: glowOpacity },
              ]}
            >
              GARANTIE
            </Animated.Text>
          </View>
        </View>
      </LinearGradient>

      <CartReminderBanner />

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

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Catégories</Text>
        <FlatList
          data={categories}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: spacing.md }}
          renderItem={({ item }) => <CategoryTile category={item} />}
        />
      </View>

      <Pressable style={styles.travelBanner} onPress={() => navigation.navigate('Travel')}>
        <Text style={styles.travelIcon}>✈️</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.travelTitle}>Voyage — Billet d'avion</Text>
          <Text style={styles.travelSubtitle}>Demandez votre réservation en quelques clics</Text>
        </View>
        <Text style={styles.travelArrow}>→</Text>
      </Pressable>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Toute la collection</Text>
        <View style={styles.grid}>
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
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
  topBarLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    flexShrink: 1,
    gap: spacing.sm,
  },
  topBarFrame: {
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  welcomeText: { color: colors.cream, fontFamily: fonts.bodyMedium, fontSize: 12 },
  visitorsRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#3ddc6f',
  },
  visitorsText: { color: colors.creamMuted, fontFamily: fonts.bodyMedium, fontSize: 11 },
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
    paddingVertical: 48,
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
  section: { marginTop: spacing.xl, paddingHorizontal: spacing.md },
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
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginHorizontal: spacing.md,
    marginTop: spacing.xl,
    gap: 12,
  },
  travelIcon: { fontSize: 26 },
  travelTitle: { color: colors.cream, fontFamily: fonts.bodySemiBold, fontSize: 15 },
  travelSubtitle: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
  travelArrow: { color: colors.gold, fontSize: 18, fontFamily: fonts.bodyBold },
  loading: { color: colors.creamFaint, fontFamily: fonts.body, textAlign: 'center', marginTop: 12 },
});
