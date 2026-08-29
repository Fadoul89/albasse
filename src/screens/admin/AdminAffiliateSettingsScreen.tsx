import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { useAuthStore } from '../../store/authStore';
import { useAffiliateSettings } from '../../hooks/useAffiliateSettings';
import { useToastStore } from '../../store/toastStore';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { colors, fonts, radius, spacing } from '../../theme';
import { ScreenHeader } from '../../components/ScreenHeader';
import { GoldButton } from '../../components/GoldButton';

export function AdminAffiliateSettingsScreen() {
  const profile = useAuthStore((s) => s.profile);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { settings, refresh } = useAffiliateSettings();
  const showToast = useToastStore((s) => s.show);

  const [rate, setRate] = useState('5');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setRate(String(settings.default_commission_rate));
  }, [settings.default_commission_rate]);

  if (!profile?.is_admin) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Admin" showBack />
        <Text style={styles.denied}>Accès réservé aux administrateurs.</Text>
      </View>
    );
  }

  const handleSave = async () => {
    const value = Number(rate.replace(',', '.'));
    if (Number.isNaN(value) || value < 0) {
      showToast('Merci de saisir un pourcentage valide.', { title: 'Valeur invalide', type: 'error' });
      return;
    }
    if (!isSupabaseConfigured) {
      showToast('Connectez Supabase pour enregistrer réellement.', { title: 'Mode démo', type: 'error' });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('affiliate_settings').update({ default_commission_rate: value }).eq('id', 1);
    setSaving(false);
    if (error) {
      showToast(error.message, { title: 'Erreur', type: 'error' });
      return;
    }
    showToast('Taux de commission par défaut mis à jour.', { title: 'Enregistré ✓', type: 'success' });
    refresh();
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Réglages affiliation" showBack />
      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 60 }}>
        <Text style={styles.sectionLabel}>Taux de commission par défaut</Text>
        <Text style={styles.hint}>
          Ce pourcentage s'applique à tous les produits, sauf si vous définissez un taux spécifique pour
          une catégorie (dans "Catégories") ou un produit précis (dans sa fiche produit).
        </Text>
        <View style={styles.inputRow}>
          <TextInput
            value={rate}
            onChangeText={setRate}
            keyboardType="numeric"
            style={styles.input}
          />
          <Text style={styles.percent}>%</Text>
        </View>
        <GoldButton label="Enregistrer" onPress={handleSave} loading={saving} style={{ marginTop: spacing.md }} />

        <GoldButton
          label="Gérer les commissions"
          variant="outline"
          onPress={() => navigation.navigate('AdminAffiliateCommissions' as never)}
          style={{ marginTop: spacing.xl }}
        />
        <GoldButton
          label="Message à tous les clients"
          variant="outline"
          onPress={() => navigation.navigate('AdminMessages' as never)}
          style={{ marginTop: spacing.sm }}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  denied: { color: colors.creamFaint, fontFamily: fonts.body, textAlign: 'center', marginTop: 40 },
  sectionLabel: { color: colors.cream, fontFamily: fonts.bodySemiBold, fontSize: 14, marginBottom: 6 },
  hint: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 12, lineHeight: 17, marginBottom: spacing.md },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: {
    flex: 1,
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.cream,
    fontFamily: fonts.body,
    borderWidth: 1,
    borderColor: colors.border,
  },
  percent: { color: colors.goldLight, fontFamily: fonts.bodyBold, fontSize: 16 },
});
