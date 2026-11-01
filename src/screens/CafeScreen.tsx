import React, { useCallback, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Linking, Platform } from 'react-native';
import { Image } from 'expo-image';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts, radius, spacing } from '../theme';
import { useProductBySlug } from '../hooks/useProducts';
import { useCategories } from '../hooks/useCategories';
import { useStoreSettings } from '../hooks/useStoreSettings';
import { useCartStore } from '../store/cartStore';
import { useAuthStore } from '../store/authStore';
import { useToastStore } from '../store/toastStore';
import { GoldButton } from '../components/GoldButton';
import { trackProductView, trackAddToCart } from '../lib/analytics';
import { endProductView, enrichProductMeta, startProductView } from '../lib/browsingTracker';
import { shownOldPrice } from '../lib/promotions';
import { isSinglePage } from '../lib/singlePage';
import { guestOrderAllowed } from '../lib/accountWall';
import { CAFE_FACTS, CAFE_PAGE, CAFE_POINTS, cafeLowStock, cafeNeedsChoice, cafeStatus, cafeWhatsAppUrl } from '../lib/landingCafe';

const formatXAF = (n: number) => `${n.toLocaleString('fr-FR')} FCFA`;

// Page unique « Café Homme » (albasseshopping.com/cafe) : pour les hommes, sans menu ni catégories du site (docs/page-cafe.md).
// Adresse cachée : ni lien depuis le site, ni plan du site, et « noindex » pour que Google ne la montre pas.
export function CafeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { product, isLoading } = useProductBySlug(CAFE_PAGE.slug);
  const { categories } = useCategories();
  const { settings } = useStoreSettings();
  const setOrderItem = useCartStore((s) => s.setOrderItem);
  const profile = useAuthStore((s) => s.profile);
  const showToast = useToastStore((s) => s.show);
  // site « page unique » (docs/site-cafe-separe.md) : la page ne porte plus le nom d'Albasse Shopping
  const single = isSinglePage();
  const status = cafeStatus(product, isLoading);
  const name = (product?.name ?? 'Café Homme').trim();
  const image = product?.images?.[0] ?? null;
  const oldPrice = product ? shownOldPrice(product) : null;
  const lowStock = product ? cafeLowStock(product.stock) : null;

  // adresse cachée : Google ne la garde pas (la balise est retirée en quittant la page)
  useEffect(() => {
    if (Platform.OS !== 'web') return undefined;
    const before = document.title;
    document.title = single ? CAFE_PAGE.name : `${CAFE_PAGE.name} — Albasse Shopping`;
    const robots = document.createElement('meta');
    robots.name = 'robots';
    robots.content = 'noindex';
    document.head.appendChild(robots);
    return () => {
      document.title = before;
      robots.remove();
    };
  }, [single]);

  // même suivi que la fiche de l'article (visites, temps actif, catégorie)
  useEffect(() => {
    if (product) trackProductView(product.id);
  }, [product?.id]);
  const category = categories.find((c) => c.id === product?.category_id);
  const meta = useMemo(
    () => (product ? { id: product.id, name: product.name, slug: product.slug, categoryId: product.category_id, categorySlug: category?.slug ?? null, categoryName: category?.name ?? null } : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [product?.id, product?.name, product?.slug, category?.slug, category?.name]
  );
  const watchId = meta?.id;
  useFocusEffect(
    useCallback(() => {
      if (!meta) return undefined;
      startProductView(meta);
      return () => endProductView('leave');
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [watchId])
  );
  useEffect(() => {
    if (meta?.categorySlug) enrichProductMeta(meta);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta?.categorySlug]);

  // « Commander » : même chemin que la fiche de l'article (une commande = un article), vers la page de commande du site
  const handleOrder = () => {
    if (!product || status !== 'ready') return;
    if (cafeNeedsChoice(product)) {
      navigation.navigate('Product', { slug: product.slug });
      return;
    }
    setOrderItem(product, 1, product.colors[0] ?? null, product.sizes[0] ?? null);
    trackAddToCart(product.id);
    if (!profile && !guestOrderAllowed(settings.account_required)) {
      showToast('Créez un compte ou connectez-vous pour passer une commande.', { title: 'Compte requis', type: 'info' });
      navigation.navigate('Login');
      return;
    }
    navigation.navigate('Checkout');
  };

  const orderLabel = status === 'ready' ? 'Commander maintenant' : status === 'soldout' ? 'Épuisé pour le moment' : 'Indisponible';

  return (
    <View style={styles.screen} testID="cafe-page">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.topRow, single && styles.topRowAlone]}>
          {single ? null : <Text style={styles.brand}>ALBASSE SHOPPING</Text>}
          <View style={styles.badge} testID="cafe-badge">
            <Text style={styles.badgeText}>{CAFE_PAGE.badge}</Text>
          </View>
        </View>

        <Text style={styles.pageName} testID="cafe-page-name">{CAFE_PAGE.name}</Text>

        <View style={styles.imageWrap} testID="cafe-image">
          {image ? <Image source={{ uri: image }} style={styles.image} contentFit="cover" transition={150} /> : <Text style={styles.imageFallback}>☕</Text>}
        </View>

        <Text style={styles.title} testID="cafe-title">{name}</Text>
        <Text style={styles.subtitle}>{CAFE_PAGE.subtitle}</Text>

        {product && status !== 'missing' && (
          <View style={styles.priceRow}>
            <Text style={styles.price} testID="cafe-price">{formatXAF(product.price)}</Text>
            {oldPrice ? <Text style={styles.oldPrice} testID="cafe-old-price">{formatXAF(oldPrice)}</Text> : null}
          </View>
        )}
        {lowStock !== null && status === 'ready' && (
          <Text style={styles.lowStock} testID="cafe-low-stock">{lowStock === 1 ? 'Plus qu’un seul en stock' : `Plus que ${lowStock} en stock`}</Text>
        )}
        {status === 'soldout' && <Text style={styles.soldOut} testID="cafe-soldout">Épuisé pour le moment. Écrivez-nous sur WhatsApp : nous vous prévenons au retour du stock.</Text>}
        {status === 'missing' && <Text style={styles.soldOut} testID="cafe-missing">Cette offre n’est pas disponible pour le moment.</Text>}

        <GoldButton label={orderLabel} variant="gold" onPress={handleOrder} disabled={status !== 'ready'} loading={status === 'loading'} style={styles.cta} />

        <View style={styles.card} testID="cafe-points">
          <Text style={styles.cardTitle}>Le café en bref</Text>
          {CAFE_POINTS.map((p) => (
            <View key={p.text} style={styles.pointRow}>
              <Text style={styles.pointIcon}>{p.icon}</Text>
              <Text style={styles.pointText}>{p.text}</Text>
            </View>
          ))}
        </View>

        <View style={styles.card} testID="cafe-facts">
          <Text style={styles.cardTitle}>Livraison, paiement, retour</Text>
          {CAFE_FACTS.map((f) => (
            <View key={f.title} style={styles.factRow}>
              <Text style={styles.pointIcon}>{f.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.factTitle}>{f.title}</Text>
                <Text style={styles.factText}>{f.text}</Text>
              </View>
            </View>
          ))}
        </View>

        <Pressable style={styles.whatsapp} onPress={() => Linking.openURL(cafeWhatsAppUrl(settings.whatsapp))} accessibilityRole="button" testID="cafe-whatsapp">
          <Text style={styles.whatsappText}>💬 Une question ? Écrivez-nous sur WhatsApp</Text>
        </Pressable>

        <View style={styles.footerLinks}>
          <Pressable onPress={() => navigation.navigate('ReturnPolicy')} hitSlop={8}><Text style={styles.link}>Conditions de retour</Text></Pressable>
          <Pressable onPress={() => navigation.navigate('PrivacyPolicy')} hitSlop={8}><Text style={styles.link}>Confidentialité</Text></Pressable>
          <Pressable onPress={() => navigation.navigate('Contact')} hitSlop={8}><Text style={styles.link}>Contact</Text></Pressable>
        </View>
        <Text style={styles.legal}>{single ? `${settings.city}, ${settings.country}` : `${settings.shop_name} · ${settings.city}, ${settings.country}`}</Text>
      </ScrollView>

      {status === 'ready' && product && (
        <View style={styles.footer} testID="cafe-footer">
          <View>
            <Text style={styles.footerLabel}>{name}</Text>
            <Text style={styles.footerPrice}>{formatXAF(product.price)}</Text>
          </View>
          <GoldButton label="Commander" variant="gold" onPress={handleOrder} style={{ flex: 1 }} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: 110, maxWidth: 560, width: '100%', alignSelf: 'center' },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  topRowAlone: { justifyContent: 'flex-start' },
  brand: { color: colors.goldLight, fontFamily: fonts.displayBold, fontSize: 15, letterSpacing: 3 },
  badge: { borderWidth: 1, borderColor: colors.gold, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { color: colors.gold, fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 1.5 },
  pageName: { color: colors.cream, fontFamily: fonts.display, fontSize: 22, letterSpacing: 0.5, marginBottom: spacing.sm },
  imageWrap: { width: '100%', aspectRatio: 1, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.panel, alignItems: 'center', justifyContent: 'center' },
  image: { width: '100%', height: '100%' },
  imageFallback: { fontSize: 72 },
  title: { color: colors.cream, fontFamily: fonts.display, fontSize: 30, marginTop: spacing.md },
  subtitle: { color: colors.creamMuted, fontFamily: fonts.bodyMedium, fontSize: 15, marginTop: 2 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginTop: spacing.sm },
  price: { color: colors.goldLight, fontFamily: fonts.bodyBold, fontSize: 28 },
  oldPrice: { color: colors.red, fontFamily: fonts.bodyMedium, fontSize: 16, textDecorationLine: 'line-through' },
  lowStock: { color: colors.goldLight, fontFamily: fonts.bodySemiBold, fontSize: 13, marginTop: 4 },
  soldOut: { color: colors.creamMuted, fontFamily: fonts.body, fontSize: 14, marginTop: spacing.sm, lineHeight: 20 },
  cta: { marginTop: spacing.md },
  card: { backgroundColor: colors.panel, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginTop: spacing.lg, gap: 10 },
  cardTitle: { color: colors.cream, fontFamily: fonts.display, fontSize: 18, marginBottom: 2 },
  pointRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pointIcon: { fontSize: 20, width: 28, textAlign: 'center' },
  pointText: { flex: 1, color: colors.cream, fontFamily: fonts.bodyMedium, fontSize: 15 },
  factRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  factTitle: { color: colors.goldLight, fontFamily: fonts.bodySemiBold, fontSize: 14 },
  factText: { color: colors.creamMuted, fontFamily: fonts.body, fontSize: 13.5, lineHeight: 19, marginTop: 1 },
  whatsapp: { marginTop: spacing.lg, borderWidth: 1, borderColor: colors.gold, borderRadius: radius.lg, paddingVertical: 13, alignItems: 'center' },
  whatsappText: { color: colors.gold, fontFamily: fonts.bodySemiBold, fontSize: 14 },
  footerLinks: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 18, marginTop: spacing.lg },
  link: { color: colors.creamMuted, fontFamily: fonts.bodyMedium, fontSize: 13, textDecorationLine: 'underline' },
  legal: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 12, textAlign: 'center', marginTop: spacing.sm },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: spacing.md,
    backgroundColor: colors.panelAlt,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  footerLabel: { color: colors.creamMuted, fontFamily: fonts.bodyMedium, fontSize: 11.5 },
  footerPrice: { color: colors.goldLight, fontFamily: fonts.bodyBold, fontSize: 17 },
});
