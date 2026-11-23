import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Modal, Linking, Platform, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useActivePromotion } from '../hooks/useActivePromotion';
import { useAuthStore } from '../store/authStore';
import { useCategories } from '../hooks/useCategories';
import { useProducts } from '../hooks/useProducts';
import { useStoreSettings } from '../hooks/useStoreSettings';
import { useToastStore } from '../store/toastStore';
import { supabase } from '../lib/supabase';
import { getCurrentSessionId } from '../lib/analytics';
import { getProductSales } from '../lib/assistantData';
import type { SalesMap } from '../lib/assistantSales';
import { isSeniorProfession, productAdLine, zaraAdsDelaySeconds } from '../lib/zaraAds';
import { colors, fonts, radius, spacing } from '../theme';
import { promoAction, promoWhatsappUrl } from '../lib/promoTarget';

const SHOW_DELAY_MS = 1500;

function seenKey(promoId: string) {
  return `albasse_promo_seen_${promoId}_${new Date().toISOString().slice(0, 10)}`;
}

export function SmartPromotionPopup() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const promotion = useActivePromotion();
  const profile = useAuthStore((s) => s.profile);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { categories } = useCategories();
  const { products } = useProducts();
  const showToast = useToastStore((s) => s.show);
  const { settings, isLoading: settingsLoading } = useStoreSettings();
  const zaraAds = settings.zara_ads_enabled === true;
  // quand Zara gère les publicités, la fenêtre s'ouvre après le délai choisi par l'admin (sinon 1,5 s comme avant)
  const showDelayMs = zaraAds ? zaraAdsDelaySeconds(settings.zara_ads_delay_seconds) * 1000 : SHOW_DELAY_MS;

  const { height: windowHeight } = useWindowDimensions();
  // la photo de l'offre en ENTIER, à sa vraie forme (demande du patron, 23 novembre 2026 : « l'image visible complète ») : 45 % de l'écran au plus
  const [imageRatio, setImageRatio] = useState<number | null>(null);
  const [visible, setVisible] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [sales, setSales] = useState<SalesMap | null>(null);

  // Zara ajoute sa phrase (faits vrais seulement) quand l'admin lui confie les publicités et que l'offre concerne un article
  useEffect(() => {
    if (!zaraAds || !promotion?.product_id) return;
    let alive = true;
    getProductSales().then((m) => alive && setSales(m));
    return () => {
      alive = false;
    };
  }, [zaraAds, promotion?.product_id]);

  useEffect(() => {
    if (!promotion || settingsLoading) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    AsyncStorage.getItem(seenKey(promotion.id)).then((seen) => {
      if (cancelled || seen) return;
      timer = setTimeout(() => setVisible(true), showDelayMs);
    });

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [promotion?.id, settingsLoading, showDelayMs]);

  if (!promotion) return null;

  const firstName = profile?.full_name?.trim().split(/\s+/)[0] ?? null;
  const greeting =
    isAuthenticated && firstName
      ? `🎉 Bonjour ${firstName} !`
      : '🎉 Offre spéciale ALBASSE SHOPPING !';
  const body = promotion.message.replace(/\{prenom\}/gi, firstName ?? 'cher client');

  const targetProduct = promotion.product_id ? products.find((p) => p.id === promotion.product_id) : null;
  // où mène le bouton : l'article, la catégorie, sinon WhatsApp avec l'offre déjà écrite (lib/promoTarget)
  const action = promoAction(promotion, products, categories, isAuthenticated ? firstName : null);

  const zaraLine = zaraAds && targetProduct && sales ? productAdLine({ id: targetProduct.id, stock: targetProduct.stock }, sales, isSeniorProfession(profile?.profession)) : null;

  const dismiss = async () => {
    setVisible(false);
    await AsyncStorage.setItem(seenKey(promotion.id), '1');
  };

  const goToOffer = async () => {
    if (action.kind === 'product') return navigation.navigate('Product', { slug: action.slug });
    if (action.kind === 'category') return navigation.navigate('Category', { slug: action.slug });
    // un article ciblé absent de la liste (pas encore chargée) : on le cherche dans la base avant de passer à WhatsApp
    if (promotion.product_id) {
      const { data } = await supabase.from('products').select('slug, is_active').eq('id', promotion.product_id).maybeSingle();
      const row = data as { slug: string; is_active: boolean } | null;
      if (row && row.is_active !== false) return navigation.navigate('Product', { slug: row.slug });
    }
    await Linking.openURL(action.url);
  };

  // deux choix pour le client (demande du patron) : l'ARTICLE (photo ou bouton or), pour commander sur le site, ou WHATSAPP (bouton vert),
  // avec l'offre déjà écrite. Une promotion sans article ni catégorie ciblés n'a que WhatsApp.
  const hasTarget = !!promotion.product_id || !!promotion.category_id;
  const whatsappUrl = promoWhatsappUrl(promotion, isAuthenticated ? firstName : null);
  const openWhatsapp = () => Linking.openURL(whatsappUrl);

  // client connecté : le choix compte comme « bénéficiaire » (compteur de l'offre, vérifié par la base)
  const choose = async (to: 'offer' | 'whatsapp') => {
    if (isAuthenticated) {
      setClaiming(true);
      const { data, error } = await supabase.rpc('claim_promotion', {
        promo_id: promotion.id,
        p_session_id: await getCurrentSessionId(),
      });
      setClaiming(false);
      if (error || !data) {
        showToast("Cette offre n'est plus disponible.", { title: 'Dommage', type: 'error' });
        await dismiss();
        return;
      }
      showToast(
        to === 'whatsapp' || !hasTarget ? "Offre notée ! Votre message WhatsApp est déjà prêt : il ne reste qu'à l'envoyer. 🎉" : 'Offre notée ! Profitez-en dès maintenant. 🎉',
        { title: 'Merci !', type: 'success' },
      );
    }
    await dismiss();
    if (to === 'whatsapp') await openWhatsapp();
    else await goToOffer();
  };

  const validityLabel =
    promotion.end_date === new Date().toISOString().slice(0, 10)
      ? 'Offre valable aujourd’hui seulement.'
      : `Offre valable jusqu'au ${new Date(promotion.end_date).toLocaleDateString('fr-FR')}.`;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={dismiss}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Pressable style={styles.closeBtn} onPress={dismiss} hitSlop={10}>
            <Text style={styles.closeIcon}>✕</Text>
          </Pressable>

          {promotion.image_url && (
            <Pressable
              onPress={hasTarget ? () => choose('offer') : undefined}
              disabled={!hasTarget || claiming}
              accessibilityRole={hasTarget ? 'button' : undefined}
              accessibilityLabel={hasTarget ? "Voir l'article de l'offre" : undefined}
              style={[styles.imageWrap, { maxHeight: Math.round(windowHeight * 0.45) }]}
              testID="promo-image"
            >
              <Image
                accessibilityLabel="Promotion Albasse Shopping"
                source={{ uri: promotion.image_url }}
                style={[styles.image, { aspectRatio: imageRatio ?? 1, maxHeight: Math.round(windowHeight * 0.45) }]}
                contentFit="contain"
                onLoad={(e) => {
                  const w = e.source?.width;
                  const h = e.source?.height;
                  if (w && h) setImageRatio(w / h);
                }}
              />
              {hasTarget ? (
                <View style={styles.imageTag} pointerEvents="none">
                  <Text style={styles.imageTagText}>👆 Voir l'article</Text>
                </View>
              ) : null}
            </Pressable>
          )}

          <Text style={styles.greeting}>{greeting}</Text>
          <Text style={styles.message}>{body}</Text>
          {zaraLine && (
            <Text style={styles.zaraLine} testID="promo-zara-line">
              💬 Zara : {zaraLine}
            </Text>
          )}
          <Text style={styles.validity}>⏰ {validityLabel}</Text>

          {hasTarget ? (
            isAuthenticated ? (
              <Pressable style={styles.primaryBtn} onPress={() => choose('offer')} disabled={claiming} testID="promo-claim">
                <Text style={styles.primaryBtnText}>{claiming ? '…' : `🛍️ ${promotion.button_text}`}</Text>
              </Pressable>
            ) : (
              <View style={styles.buttonsRow}>
                <Pressable
                  style={styles.secondaryBtn}
                  onPress={async () => {
                    await dismiss();
                    navigation.navigate('Login');
                  }}
                >
                  <Text style={styles.secondaryBtnText}>Se connecter</Text>
                </Pressable>
                <Pressable style={styles.primaryBtn} onPress={() => choose('offer')} testID="promo-discover">
                  <Text style={styles.primaryBtnText}>Découvrir</Text>
                </Pressable>
              </View>
            )
          ) : null}
          <Pressable style={[styles.whatsappBtn, hasTarget && { marginTop: 10 }]} onPress={() => choose('whatsapp')} disabled={claiming} accessibilityRole="button" testID="promo-whatsapp">
            {Platform.OS === 'web'
              ? React.createElement(
                  'svg',
                  { width: 18, height: 18, viewBox: '0 0 24 24', fill: '#ffffff', 'aria-hidden': true },
                  React.createElement('path', {
                    d: 'M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2c-1.6 0-3.1-.4-4.4-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.2.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.4.1-.6.3-.2.2-.8.8-.8 1.9s.8 2.2.9 2.4c.1.1 1.6 2.5 4 3.5 1.5.6 2.1.7 2.8.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3z',
                  }),
                )
              : null}
            <Text style={styles.whatsappBtnText}>{claiming && !hasTarget ? '…' : 'Commander sur WhatsApp'}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: colors.overlay, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  card: {
    backgroundColor: colors.panelAlt,
    borderRadius: radius.xl,
    padding: spacing.lg,
    width: '100%',
    maxWidth: 380,
    borderWidth: 1.5,
    borderColor: colors.gold,
  },
  closeBtn: { position: 'absolute', top: 12, right: 12, zIndex: 1 },
  closeIcon: { color: colors.creamFaint, fontSize: 18 },
  imageWrap: { width: '100%', borderRadius: radius.lg, overflow: 'hidden', marginBottom: spacing.md, backgroundColor: '#0b1a3d' },
  image: { width: '100%' },
  imageTag: { position: 'absolute', left: 8, bottom: 8, backgroundColor: 'rgba(7, 36, 105, 0.85)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(231, 200, 122, 0.8)', paddingHorizontal: 10, paddingVertical: 5 },
  imageTagText: { color: '#ffffff', fontFamily: fonts.bodyBold, fontSize: 12 },
  whatsappBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#25D366', borderRadius: radius.pill, paddingVertical: 13 },
  whatsappBtnText: { color: '#ffffff', fontFamily: fonts.bodyBold, fontSize: 13 },
  greeting: { color: colors.goldLight, fontFamily: fonts.displayBold, fontSize: 18, marginBottom: spacing.sm, textAlign: 'center' },
  message: { color: colors.cream, fontFamily: fonts.body, fontSize: 14, lineHeight: 20, textAlign: 'center', marginBottom: spacing.sm },
  zaraLine: { color: colors.goldLight, fontFamily: fonts.bodySemiBold, fontSize: 13, lineHeight: 18, textAlign: 'center', marginBottom: spacing.sm },
  validity: { color: colors.creamFaint, fontFamily: fonts.bodyMedium, fontSize: 12, textAlign: 'center', marginBottom: spacing.lg },
  primaryBtn: {
    flex: 1,
    backgroundColor: colors.gold,
    borderRadius: radius.pill,
    paddingVertical: 13,
    alignItems: 'center',
  },
  primaryBtnText: { color: colors.background, fontFamily: fonts.bodyBold, fontSize: 13 },
  buttonsRow: { flexDirection: 'row', gap: 10 },
  secondaryBtn: {
    flex: 1,
    borderRadius: radius.pill,
    paddingVertical: 13,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.gold,
  },
  secondaryBtnText: { color: colors.gold, fontFamily: fonts.bodyMedium, fontSize: 13 },
});
