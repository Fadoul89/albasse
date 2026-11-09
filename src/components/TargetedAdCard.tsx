import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import type { Category, Product } from '../types';
import { useStoreSettings } from '../hooks/useStoreSettings';
import { useAuthStore } from '../store/authStore';
import { useAssistantStore } from '../store/assistantStore';
import { getCities } from '../lib/assistantData';
import type { City } from '../lib/assistantBrain';
import { getBrowsingProfile } from '../lib/browsingTracker';
import { AD_ADVERTISER, AD_CTA, AD_LABEL, addClosedAd, adHeadline, adWhy, closedState, deliveryLine, parseClosedAds, pickTargetedAd, type ClosedAd } from '../lib/adTargeting';
import { shownOldPrice } from '../lib/promotions';
import { dealFromPrice, offerTexts } from '../lib/studentOffer';
import { colors, fonts, radius, spacing } from '../theme';

const LOGO = require('../../assets/logo.jpg');
const CLOSED_KEY = 'albasse_targeted_ad_closed_v2'; // les « ✕ » des dernières 24 h : [{ id de l'article, heure }]

const formatXAF = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} FCFA`;

// « Annonce » de Zara dans le fil de l'accueil : une publicité qui ressemble à une vraie pub (photo, nom, prix, bouton « Acheter maintenant »),
// choisie pour CE client avec de vraies raisons (article regardé, catégorie explorée, vraie promotion, genre, ville) et qui dit « Pourquoi cette annonce ? ».
// Même interrupteur que les publicités de Zara (Admin › Promotions intelligentes). Sans raison vraie : rien.
// « ✕ » : l'annonce disparaît et, 15 secondes plus tard, Zara propose un AUTRE article (jamais celui qui vient d'être fermé) ; au 3ᵉ « ✕ » sur 24 h elle s'arrête.
// (lib/adTargeting, docs/zara-annonce-ciblee.md)
export function TargetedAdCard({ products, categories }: { products: Product[]; categories: Category[] }) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { settings, isLoading } = useStoreSettings();
  const profile = useAuthStore((s) => s.profile);
  const lang = useAssistantStore((s) => s.lang) === 'ar' ? 'ar' : 'fr';
  const enabled = settings.zara_ads_enabled === true;
  const [clock, setClock] = useState(() => Date.now()); // « maintenant » : change quand les 15 secondes d'attente sont finies
  const [closed, setClosed] = useState<ClosedAd[] | undefined>(undefined); // les « ✕ » des dernières 24 h ; undefined : pas encore lu
  const [cities, setCities] = useState<City[]>([]);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    AsyncStorage.getItem(CLOSED_KEY)
      .then((v) => alive && setClosed(parseClosedAds(v, Date.now())))
      .catch(() => alive && setClosed([]));
    getCities()
      .then((c) => alive && setCities(c))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [enabled]);

  const state = useMemo(() => (closed === undefined ? null : closedState(closed, clock)), [closed, clock]);

  // « ✕ » touché : on attend la fin des 15 secondes, puis l'annonce suivante apparaît toute seule
  const waitMs = state?.waitMs ?? 0;
  useEffect(() => {
    if (!enabled || waitMs <= 0) return;
    const t = setTimeout(() => setClock(Date.now()), waitMs + 50);
    return () => clearTimeout(t);
  }, [enabled, waitMs]);

  const ad = useMemo(() => {
    if (!enabled || isLoading || !state || state.stopped || state.waitMs > 0 || products.length === 0) return null;
    return pickTargetedAd({ products, categories, customer: profile, browsing: getBrowsingProfile(), now: clock, exclude: state.excluded });
  }, [enabled, isLoading, state, products, categories, profile, clock]);

  if (!ad) return null;
  const p = ad.product as Product;
  const text = AD_CTA[lang];
  const oldPrice = shownOldPrice(p, clock);
  const delivery = deliveryLine(profile?.region, cities, lang);
  const align = lang === 'ar' ? ({ textAlign: 'right', writingDirection: 'rtl' } as const) : undefined;
  const close = () => {
    const at = Date.now();
    const next = addClosedAd(closed ?? [], p.id, at);
    setClosed(next);
    setClock(at);
    AsyncStorage.setItem(CLOSED_KEY, JSON.stringify(next)).catch(() => {});
  };

  // la GRANDE AFFICHE de l'offre élèves/étudiants (lib/studentOffer) : URBANSOLE à 12 500 FCFA, code EE26, réservée aux élèves et étudiants
  if (ad.reason.kind === 'studentOffer') {
    const deal = dealFromPrice(ad.reason.listPrice);
    if (deal) {
      const buy = () => navigation.navigate('Product', { slug: p.slug });
      return (
        <View style={styles.wrap} testID="targeted-ad">
          <View style={styles.poster} testID="student-offer-poster">
            <View style={styles.posterBand}>
              <Text style={styles.posterBandText} testID="student-offer-badge">{offerTexts.badge(lang)}</Text>
            </View>
            <View style={styles.posterBody}>
              <View style={styles.header}>
                <Image source={LOGO} style={styles.logo} contentFit="cover" />
                <View style={styles.headerText}>
                  <View style={styles.nameRow}>
                    <Text style={styles.advertiser} numberOfLines={1}>{AD_ADVERTISER}</Text>
                    <View style={styles.verified}>
                      <Text style={styles.verifiedText}>✓</Text>
                    </View>
                  </View>
                  <Text style={styles.sub} testID="targeted-ad-label">{`${AD_LABEL[lang]} · Zara`}</Text>
                </View>
                <Pressable style={styles.closeBtn} onPress={close} hitSlop={10} accessibilityRole="button" accessibilityLabel={text.close} testID="targeted-ad-close">
                  <Text style={styles.closeText}>✕</Text>
                </Pressable>
              </View>

              <Text style={[styles.posterHeadline, align]} testID="targeted-ad-headline">
                {adHeadline(ad.reason, lang)}
              </Text>

              <Pressable onPress={buy} accessibilityRole="button" accessibilityLabel={`${p.name.trim()} : ${text.buy}`} testID="targeted-ad-image">
                <Image source={{ uri: p.images[0] }} style={styles.posterImage} contentFit="contain" />
                <View style={styles.pctBadge} testID="student-offer-pct">
                  <Text style={styles.pctText}>{offerTexts.pct(deal, lang)}</Text>
                </View>
              </Pressable>

              <Text style={[styles.posterName, align]} numberOfLines={2} testID="targeted-ad-name">{p.name.trim()}</Text>
              <View style={styles.posterPriceRow}>
                <Text style={styles.posterPrice} testID="student-offer-price">{offerTexts.price(deal)}</Text>
                <Text style={styles.posterOld} testID="student-offer-old-price">{offerTexts.instead(deal, lang)}</Text>
              </View>

              <View style={styles.codeBox} testID="student-offer-code">
                <Text style={styles.codeText}>{`🎟️ ${offerTexts.auto(deal, lang)}`}</Text>
              </View>
              <Text style={[styles.posterOnly, align]} testID="student-offer-only">{offerTexts.only(lang)}</Text>

              {delivery ? (
                <Text style={[styles.delivery, align]} testID="targeted-ad-delivery">
                  {delivery}
                </Text>
              ) : null}

              <View style={styles.actions}>
                <Pressable style={styles.posterBuy} onPress={buy} accessibilityRole="button" testID="targeted-ad-buy">
                  <Text style={styles.posterBuyText}>{offerTexts.cta(deal, lang)}</Text>
                </Pressable>
              </View>
              <Pressable style={styles.ask} onPress={() => useAssistantStore.getState().adviseProduct(p.slug)} accessibilityRole="button" testID="targeted-ad-ask">
                <Text style={styles.askText}>{`💬 ${text.ask}`}</Text>
              </Pressable>

              <Text style={[styles.why, align]} testID="targeted-ad-why">
                {`ⓘ ${adWhy(ad.reason, lang)}`}
              </Text>
            </View>
          </View>
        </View>
      );
    }
  }

  return (
    <View style={styles.wrap} testID="targeted-ad">
      <View style={styles.card}>
        <View style={styles.header}>
          <Image source={LOGO} style={styles.logo} contentFit="cover" />
          <View style={styles.headerText}>
            <View style={styles.nameRow}>
              <Text style={styles.advertiser} numberOfLines={1}>{AD_ADVERTISER}</Text>
              <View style={styles.verified}>
                <Text style={styles.verifiedText}>✓</Text>
              </View>
            </View>
            <Text style={styles.sub} testID="targeted-ad-label">{`${AD_LABEL[lang]} · Zara`}</Text>
          </View>
          <Pressable style={styles.closeBtn} onPress={close} hitSlop={10} accessibilityRole="button" accessibilityLabel={text.close} testID="targeted-ad-close">
            <Text style={styles.closeText}>✕</Text>
          </Pressable>
        </View>

        <Text style={[styles.headline, align]} testID="targeted-ad-headline">
          {adHeadline(ad.reason, lang)}
        </Text>

        <Pressable onPress={() => navigation.navigate('Product', { slug: p.slug })} accessibilityRole="button" accessibilityLabel={`${p.name.trim()} : ${text.buy}`} testID="targeted-ad-image">
          <Image source={{ uri: p.images[0] }} style={styles.image} contentFit="contain" />
        </Pressable>

        <View style={styles.productRow}>
          <View style={styles.productText}>
            <Text style={[styles.name, align]} numberOfLines={2} testID="targeted-ad-name">{p.name.trim()}</Text>
            <View style={styles.priceRow}>
              <Text style={styles.price} testID="targeted-ad-price">{formatXAF(p.price)}</Text>
              {oldPrice !== null && <Text style={styles.oldPrice} testID="targeted-ad-old-price">{formatXAF(oldPrice)}</Text>}
            </View>
          </View>
        </View>

        {delivery ? (
          <Text style={[styles.delivery, align]} testID="targeted-ad-delivery">
            {delivery}
          </Text>
        ) : null}

        <View style={styles.actions}>
          <Pressable style={styles.buy} onPress={() => navigation.navigate('Product', { slug: p.slug })} accessibilityRole="button" testID="targeted-ad-buy">
            <Text style={styles.buyText}>{text.buy}</Text>
          </Pressable>
          <Pressable style={styles.ask} onPress={() => useAssistantStore.getState().adviseProduct(p.slug)} accessibilityRole="button" testID="targeted-ad-ask">
            <Text style={styles.askText}>{`💬 ${text.ask}`}</Text>
          </Pressable>
        </View>

        <Text style={[styles.why, align]} testID="targeted-ad-why">
          {`ⓘ ${adWhy(ad.reason, lang)}`}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: spacing.sm, marginBottom: spacing.md },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.panel,
    padding: spacing.md - 4,
    gap: 10,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: { width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, borderColor: colors.gold, backgroundColor: colors.background },
  headerText: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  advertiser: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.cream, flexShrink: 1 },
  verified: { width: 15, height: 15, borderRadius: 8, backgroundColor: '#1e88e5', alignItems: 'center', justifyContent: 'center' },
  verifiedText: { color: '#fff', fontSize: 10, fontFamily: fonts.bodyBold, lineHeight: 12 },
  sub: { fontFamily: fonts.bodyMedium, fontSize: 11.5, color: colors.creamMuted, marginTop: 1 },
  closeBtn: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  closeText: { color: colors.creamMuted, fontSize: 16, fontFamily: fonts.bodyBold },
  headline: { fontFamily: fonts.bodySemiBold, fontSize: 14.5, lineHeight: 20, color: colors.cream },
  image: { width: '100%', aspectRatio: 1.45, borderRadius: radius.md, backgroundColor: '#fff' },
  productRow: { flexDirection: 'row', alignItems: 'center' },
  productText: { flex: 1, minWidth: 0 },
  name: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.cream },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 2 },
  price: { fontFamily: fonts.displayBold, fontSize: 18, color: colors.goldLight },
  oldPrice: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.creamFaint, textDecorationLine: 'line-through' },
  delivery: { fontFamily: fonts.bodyMedium, fontSize: 12.5, color: colors.cream },
  actions: { flexDirection: 'row', gap: 8 },
  buy: { flex: 1.3, backgroundColor: colors.gold, borderRadius: radius.pill, paddingVertical: 11, alignItems: 'center' },
  buyText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.background },
  ask: { flex: 1, borderWidth: 1, borderColor: colors.gold, borderRadius: radius.pill, paddingVertical: 11, alignItems: 'center' },
  askText: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.goldLight },
  why: { fontFamily: fonts.body, fontSize: 11.5, lineHeight: 16, color: colors.creamFaint },
  // la grande affiche (offre élèves et étudiants)
  poster: { borderWidth: 2, borderColor: colors.gold, borderRadius: radius.lg, backgroundColor: colors.panel, overflow: 'hidden' },
  posterBand: { backgroundColor: colors.gold, paddingVertical: 9, paddingHorizontal: spacing.md, alignItems: 'center' },
  posterBandText: { fontFamily: fonts.bodyBold, fontSize: 13, letterSpacing: 0.6, color: colors.background, textAlign: 'center' },
  posterBody: { padding: spacing.md - 4, gap: 10 },
  posterHeadline: { fontFamily: fonts.displayBold, fontSize: 19, lineHeight: 25, color: colors.goldLight },
  posterImage: { width: '100%', aspectRatio: 1.1, borderRadius: radius.md, backgroundColor: '#fff' },
  pctBadge: { position: 'absolute', top: 10, right: 10, backgroundColor: colors.red, borderRadius: radius.pill, paddingVertical: 6, paddingHorizontal: 12 },
  pctText: { fontFamily: fonts.bodyBold, fontSize: 15, color: '#fff' },
  posterName: { fontFamily: fonts.displayBold, fontSize: 22, color: colors.cream },
  posterPriceRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: 10 },
  posterPrice: { fontFamily: fonts.displayBold, fontSize: 34, color: colors.goldLight },
  posterOld: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.creamFaint },
  codeBox: { alignSelf: 'flex-start', borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.gold, borderRadius: radius.md, paddingVertical: 7, paddingHorizontal: 12 },
  codeText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.goldLight },
  posterOnly: { fontFamily: fonts.bodySemiBold, fontSize: 13.5, color: colors.cream },
  posterBuy: { flex: 1, backgroundColor: colors.gold, borderRadius: radius.pill, paddingVertical: 14, alignItems: 'center' },
  posterBuyText: { fontFamily: fonts.bodyBold, fontSize: 15.5, color: colors.background },
});
