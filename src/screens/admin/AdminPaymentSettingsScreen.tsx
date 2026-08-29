import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView } from 'react-native';
import { useAuthStore } from '../../store/authStore';
import { usePaymentSettings } from '../../hooks/usePaymentSettings';
import { useToastStore } from '../../store/toastStore';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { colors, fonts, radius, spacing } from '../../theme';
import { ScreenHeader } from '../../components/ScreenHeader';
import { GoldButton } from '../../components/GoldButton';

export function AdminPaymentSettingsScreen() {
  const profile = useAuthStore((s) => s.profile);
  const { settings, isLoading, refresh } = usePaymentSettings();
  const showToast = useToastStore((s) => s.show);

  const [airtelNumber, setAirtelNumber] = useState('');
  const [airtelUrl, setAirtelUrl] = useState('');
  const [moovNumber, setMoovNumber] = useState('');
  const [moovUrl, setMoovUrl] = useState('');
  const [instructions, setInstructions] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings) {
      setAirtelNumber(settings.airtel_number ?? '');
      setAirtelUrl(settings.airtel_payment_url ?? '');
      setMoovNumber(settings.moov_number ?? '');
      setMoovUrl(settings.moov_payment_url ?? '');
      setInstructions(settings.instructions ?? '');
    }
  }, [settings]);

  if (!profile?.is_admin) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Admin" showBack />
        <Text style={styles.denied}>Accès réservé aux administrateurs.</Text>
      </View>
    );
  }

  const handleSave = async () => {
    if (!isSupabaseConfigured) {
      showToast('Connectez Supabase pour enregistrer ces réglages.', { title: 'Mode démo', type: 'error' });
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from('payment_settings')
      .update({
        airtel_number: airtelNumber.trim() || null,
        airtel_payment_url: airtelUrl.trim() || null,
        moov_number: moovNumber.trim() || null,
        moov_payment_url: moovUrl.trim() || null,
        instructions: instructions.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', 1);
    setSaving(false);

    if (error) {
      console.error('Erreur enregistrement paiement:', error);
      showToast(error.message, { title: 'Erreur', type: 'error' });
      return;
    }

    showToast('Les moyens de paiement ont été mis à jour.', { title: 'Enregistré ✓', type: 'success' });
    refresh();
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Moyens de paiement" showBack />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.intro}>
          Renseignez vos numéros Mobile Money et/ou vos liens de paiement en ligne. Ils seront
          affichés au client lors de la confirmation de commande.
        </Text>

        <Text style={styles.sectionTitle}>📱 Airtel Money</Text>
        <Field label="Numéro Airtel Money" value={airtelNumber} onChangeText={setAirtelNumber} placeholder="60 60 51 51" keyboardType="phone-pad" />
        <Field label="Lien de paiement en ligne (optionnel)" value={airtelUrl} onChangeText={setAirtelUrl} placeholder="https://..." autoCapitalize="none" />

        <Text style={styles.sectionTitle}>📲 Moov Money</Text>
        <Field label="Numéro Moov Money" value={moovNumber} onChangeText={setMoovNumber} placeholder="66 60 51 51" keyboardType="phone-pad" />
        <Field label="Lien de paiement en ligne (optionnel)" value={moovUrl} onChangeText={setMoovUrl} placeholder="https://..." autoCapitalize="none" />

        <Text style={styles.sectionTitle}>Instructions supplémentaires (optionnel)</Text>
        <Field
          label="Affiché au client après commande"
          value={instructions}
          onChangeText={setInstructions}
          placeholder="Ex: Envoyez une capture du paiement par WhatsApp au..."
          multiline
        />

        <GoldButton
          label="Enregistrer"
          onPress={handleSave}
          loading={saving || isLoading}
          style={{ marginTop: spacing.lg }}
        />
      </ScrollView>
    </View>
  );
}

function Field({
  label,
  ...props
}: { label: string } & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={{ marginBottom: spacing.sm }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.creamFaint}
        style={[styles.input, props.multiline && { height: 80, textAlignVertical: 'top' }]}
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  denied: { color: colors.creamFaint, fontFamily: fonts.body, textAlign: 'center', marginTop: 40 },
  content: { padding: spacing.md, paddingBottom: 60 },
  intro: {
    color: colors.creamMuted,
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontFamily: fonts.display,
    fontSize: 16,
    color: colors.cream,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  label: { color: colors.creamMuted, fontFamily: fonts.bodyMedium, fontSize: 12, marginBottom: 6 },
  input: {
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.cream,
    fontFamily: fonts.body,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
