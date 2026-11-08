// Admin › « Paramètres Zara » : tous les réglages de Zara au même endroit (demande du patron, 8 novembre 2026 :
// « Mettez-moi tous les paramètres Zara dans un paramètres à côté »). Rien n'est déplacé ni supprimé : les interrupteurs sont LES MÊMES que sur les autres pages
// (mêmes colonnes de la base, mêmes messages), ils se trouvent simplement réunis ici. Zara Marketing (e-mails) n'est PAS commandée d'ici : son verrou « ACTIVER »
// reste sur sa propre page ; on y voit seulement son état. Voir docs/parametres-zara.md.
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { colors, fonts, radius, spacing } from '../../theme';
import { useAuthStore } from '../../store/authStore';
import { ScreenHeader } from '../../components/ScreenHeader';
import { StoreSettingToggle } from '../../components/StoreSettingToggle';
import { ZaraAdsDelay } from '../../components/ZaraAdsDelay';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { MODE_LABELS, type MarketingMode } from '../../lib/marketingAI';

interface MarketingState {
  mode: MarketingMode;
  run_hour: number;
  daily_limit: number;
  require_approval: boolean;
}

type Go = 'AdminMarketingAI' | 'AdminPromotions' | 'AdminZaraSeo' | 'AdminZaraStats';

export function AdminZaraSettingsScreen() {
  const profile = useAuthStore((s) => s.profile);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  // null : lecture en cours ; 'missing' : script SQL de Zara Marketing pas encore lancé
  const [marketing, setMarketing] = useState<MarketingState | 'missing' | null>(null);

  const loadMarketing = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    const { data, error } = await supabase.from('marketing_ai_settings').select('mode,run_hour,daily_limit,require_approval').eq('id', 1).maybeSingle();
    setMarketing(error || !data ? 'missing' : (data as MarketingState));
  }, []);

  useEffect(() => {
    if (profile?.is_admin) void loadMarketing();
  }, [profile?.is_admin, loadMarketing]);

  if (!profile?.is_admin) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Admin" showBack />
        <Text style={styles.denied}>Accès réservé aux administrateurs.</Text>
      </View>
    );
  }

  const open = (route: Go) => navigation.navigate(route);

  return (
    <View style={styles.screen} testID="zara-settings-screen">
      <ScreenHeader title="Paramètres Zara" showBack />
      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 60 }}>
        <Text style={styles.intro}>
          Tous les réglages de Zara au même endroit. Ce sont les mêmes interrupteurs que sur les autres pages : un changement ici est le même que là-bas.
        </Text>

        <Text style={styles.section} testID="zara-settings-section-screen">🖥️ À l’écran des clients</Text>
        <StoreSettingToggle setting="zaraAds" />
        <ZaraAdsDelay />
        <StoreSettingToggle setting="zaraAutoFlash" />

        <Text style={styles.section} testID="zara-settings-section-messages">📣 Messages que Zara envoie</Text>
        <StoreSettingToggle setting="pushNewProducts" />
        <StoreSettingToggle setting="inactiveEmails" />
        <StoreSettingToggle setting="telegramAbsent" />

        <Text style={styles.section} testID="zara-settings-section-marketing">✉️ Zara Marketing (e-mails)</Text>
        <View style={styles.card} testID="zara-settings-marketing">
          {marketing === null ? (
            <Text style={styles.small}>Lecture…</Text>
          ) : marketing === 'missing' ? (
            <Text style={styles.small} testID="zara-settings-marketing-missing">Zara Marketing n’est pas encore installée (script SQL pas lancé).</Text>
          ) : (
            <>
              <Text style={[styles.mode, marketing.mode === 'live' && { color: colors.goldLight }]} testID="zara-settings-marketing-mode">{MODE_LABELS[marketing.mode]}</Text>
              <Text style={styles.small} testID="zara-settings-marketing-detail">
                {`Passage chaque jour à ${marketing.run_hour} h (heure de N’Djamena) · ${marketing.daily_limit} e-mail${marketing.daily_limit > 1 ? 's' : ''} au plus par jour · ${marketing.require_approval ? 'approbation demandée avant l’envoi' : 'envoi sans approbation'}`}
              </Text>
            </>
          )}
          <Text style={styles.small}>Par sécurité, le verrou « ACTIVER » et les réglages détaillés restent sur la page de Zara Marketing.</Text>
          <Pressable style={styles.link} onPress={() => open('AdminMarketingAI')} accessibilityRole="button" testID="zara-settings-open-marketing">
            <Text style={styles.linkText}>Ouvrir Zara Marketing ›</Text>
          </Pressable>
        </View>

        <Text style={styles.section}>🔗 Autres pages de Zara</Text>
        <View style={styles.card}>
          <Pressable style={styles.row} onPress={() => open('AdminPromotions')} accessibilityRole="button" testID="zara-settings-open-promotions">
            <Text style={styles.rowText}>🎁 Promotions intelligentes</Text>
            <Text style={styles.rowHint}>choix des articles de la Vente flash, annonces par public, notifications programmées</Text>
          </Pressable>
          <Pressable style={styles.row} onPress={() => open('AdminZaraSeo')} accessibilityRole="button" testID="zara-settings-open-seo">
            <Text style={styles.rowText}>🔎 Zara SEO (Google)</Text>
            <Text style={styles.rowHint}>descriptions des articles préparées pour Google</Text>
          </Pressable>
          <Pressable style={styles.row} onPress={() => open('AdminZaraStats')} accessibilityRole="button" testID="zara-settings-open-stats">
            <Text style={styles.rowText}>💬 Statistiques de Zara</Text>
            <Text style={styles.rowHint}>conversations, ventes, installations</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  denied: { color: colors.creamFaint, fontFamily: fonts.body, textAlign: 'center', marginTop: 40 },
  intro: { color: colors.creamMuted, fontFamily: fonts.body, fontSize: 13, lineHeight: 19, marginBottom: spacing.sm },
  section: { color: colors.goldLight, fontFamily: fonts.bodyBold, fontSize: 14, marginTop: spacing.md, marginBottom: spacing.sm },
  card: { backgroundColor: colors.panel, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.md, gap: 8 },
  mode: { color: colors.cream, fontFamily: fonts.bodyBold, fontSize: 15 },
  small: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 12, lineHeight: 17 },
  link: { alignSelf: 'flex-start', borderWidth: 1, borderColor: colors.gold, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 8, marginTop: 2 },
  linkText: { color: colors.gold, fontFamily: fonts.bodySemiBold, fontSize: 13 },
  row: { paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  rowText: { color: colors.cream, fontFamily: fonts.bodySemiBold, fontSize: 14 },
  rowHint: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
});
