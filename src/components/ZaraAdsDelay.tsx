// Admin (page Promotions intelligentes) : après combien de secondes la publicité de Zara s'affiche (accueil + fenêtre de promotion).
// Un choix en un toucher, enregistré tout de suite dans store_settings.zara_ads_delay_seconds (script add-zara-ads-delay.sql).
import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useStoreSettings } from '../hooks/useStoreSettings';
import { useToastStore } from '../store/toastStore';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { ZARA_ADS_DELAY_CHOICES, zaraAdsDelayLabel, zaraAdsDelaySeconds } from '../lib/zaraAds';
import { colors, fonts, radius, spacing } from '../theme';

export function ZaraAdsDelay() {
  const { settings, refresh } = useStoreSettings();
  const showToast = useToastStore((t) => t.show);
  const [value, setValue] = useState(zaraAdsDelaySeconds(settings.zara_ads_delay_seconds));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValue(zaraAdsDelaySeconds(settings.zara_ads_delay_seconds));
  }, [settings.zara_ads_delay_seconds]);

  const choose = async (seconds: number) => {
    if (!isSupabaseConfigured || saving || seconds === value) return;
    const before = value;
    setValue(seconds);
    setSaving(true);
    const { error } = await supabase.from('store_settings').update({ zara_ads_delay_seconds: seconds }).eq('id', 1);
    setSaving(false);
    if (error) {
      setValue(before);
      const missing = error.code === '42703' || error.code === 'PGRST204' || (error.message ?? '').includes('zara_ads_delay_seconds');
      showToast(missing ? 'Lancez d’abord le script add-zara-ads-delay.sql dans Supabase.' : error.message, { title: 'Pas enregistré', type: 'error' });
      return;
    }
    showToast(
      seconds === 0 ? 'La publicité de Zara s’affiche tout de suite.' : `La publicité de Zara s’affiche ${seconds} secondes après l’ouverture de l’accueil.`,
      { title: '⏱️ Délai enregistré', type: 'success' }
    );
    refresh();
  };

  return (
    <View style={styles.card} testID="zara-delay">
      <Text style={styles.title}>⏱️ La publicité s’affiche après…</Text>
      <Text style={styles.status} testID="zara-delay-status">
        {value === 0 ? 'Tout de suite, dès l’ouverture de l’accueil' : `${value} secondes après l’ouverture de l’accueil`}
      </Text>
      <View style={styles.row}>
        {ZARA_ADS_DELAY_CHOICES.map((n) => (
          <Pressable key={n} testID={`zara-delay-${n}`} onPress={() => choose(n)} disabled={saving} style={[styles.chip, n === value && styles.chipOn]}>
            <Text style={[styles.chipText, n === value && styles.chipTextOn]}>{zaraAdsDelayLabel(n)}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  title: { color: colors.cream, fontFamily: fonts.bodyBold, fontSize: 14 },
  status: { color: colors.goldLight, fontFamily: fonts.bodyMedium, fontSize: 12, marginTop: 4 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: spacing.sm + 2 },
  chip: { borderWidth: 1, borderColor: colors.gold, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 8 },
  chipOn: { backgroundColor: colors.gold },
  chipText: { color: colors.gold, fontFamily: fonts.bodySemiBold, fontSize: 13 },
  chipTextOn: { color: colors.background, fontFamily: fonts.bodyBold },
});
