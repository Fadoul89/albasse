import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Modal } from 'react-native';
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

  const targetCategory = promotion.category_id ? categories.find((c) => c.id === promotion.category_id) : null;
  const targetProduct = promotion.product_id ? products.find((p) => p.id === promotion.product_id) : null;

  const zaraLine = zaraAds && targetProduct && sales ? productAdLine({ id: targetProduct.id, stock: targetProduct.stock }, sales, isSeniorProfession(profile?.profession)) : null;

  const dismiss = async () => {
    setVisible(false);
    await AsyncStorage.setItem(seenKey(promotion.id), '1');
  };

  const goToOffer = () => {
    if (targetProduct) navigation.navigate('Product', { slug: targetProduct.slug });
    else if (targetCategory) navigation.navigate('Category', { slug: targetCategory.slug });
  };

  const handleClaim = async () => {
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

    showToast('Offre notée ! Profitez-en dès maintenant. 🎉', { title: 'Merci !', type: 'success' });
    await dismiss();
    goToOffer();
  };

  const handleDiscover = async () => {
    await dismiss();
    goToOffer();
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
            <Image source={{ uri: promotion.image_url }} style={styles.image} contentFit="cover" />
          )}

          <Text style={styles.greeting}>{greeting}</Text>
          <Text style={styles.message}>{body}</Text>
          {zaraLine && (
            <Text style={styles.zaraLine} testID="promo-zara-line">
              💬 Zara : {zaraLine}
            </Text>
          )}
          <Text style={styles.validity}>⏰ {validityLabel}</Text>

          {isAuthenticated ? (
            <Pressable style={styles.primaryBtn} onPress={handleClaim} disabled={claiming}>
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
              <Pressable style={styles.primaryBtn} onPress={handleDiscover}>
                <Text style={styles.primaryBtnText}>Découvrir</Text>
              </Pressable>
            </View>
          )}
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
  image: { width: '100%', height: 140, borderRadius: radius.lg, marginBottom: spacing.md },
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
