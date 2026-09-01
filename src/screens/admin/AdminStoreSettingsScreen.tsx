import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView } from 'react-native';
import { useAuthStore } from '../../store/authStore';
import { useStoreSettings } from '../../hooks/useStoreSettings';
import { useToastStore } from '../../store/toastStore';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { colors, fonts, radius, spacing } from '../../theme';
import { ScreenHeader } from '../../components/ScreenHeader';
import { GoldButton } from '../../components/GoldButton';

export function AdminStoreSettingsScreen() {
  const profile = useAuthStore((s) => s.profile);
  const { settings, isLoading, refresh } = useStoreSettings();
  const showToast = useToastStore((s) => s.show);

  const [shopName, setShopName] = useState('');
  const [address, setAddress] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [hours, setHours] = useState('');
  const [googleMapsUrl, setGoogleMapsUrl] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setShopName(settings.shop_name ?? '');
    setAddress(settings.address ?? '');
    setPostalCode(settings.postal_code ?? '');
    setCity(settings.city ?? '');
    setCountry(settings.country ?? '');
    setPhone(settings.phone ?? '');
    setWhatsapp(settings.whatsapp ?? '');
    setEmail(settings.email ?? '');
    setHours(settings.hours ?? '');
    setGoogleMapsUrl(settings.google_maps_url ?? '');
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
      .from('store_settings')
      .update({
        shop_name: shopName.trim() || 'Albasse Shopping',
        address: address.trim() || null,
        postal_code: postalCode.trim() || null,
        city: city.trim() || null,
        country: country.trim() || null,
        phone: phone.trim() || null,
        whatsapp: whatsapp.trim() || null,
        email: email.trim() || null,
        hours: hours.trim() || null,
        google_maps_url: googleMapsUrl.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', 1);
    setSaving(false);

    if (error) {
      console.error('Erreur enregistrement infos boutique:', error);
      showToast(error.message, { title: 'Erreur', type: 'error' });
      return;
    }

    showToast('Les informations de contact ont été mises à jour.', { title: 'Enregistré ✓', type: 'success' });
    refresh();
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Informations de contact" showBack />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.intro}>
          Ces informations s'affichent automatiquement en bas de l'accueil et sur la page Contact du site.
        </Text>

        <Field label="Nom de la boutique" value={shopName} onChangeText={setShopName} />
        <Field label="Adresse" value={address} onChangeText={setAddress} placeholder="Marché Central" />
        <Field label="Code postal" value={postalCode} onChangeText={setPostalCode} placeholder="5575" />
        <Field label="Ville" value={city} onChangeText={setCity} placeholder="N'Djamena" />
        <Field label="Pays" value={country} onChangeText={setCountry} placeholder="Tchad" />
        <Field label="Téléphone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="00235 60605151" />
        <Field label="WhatsApp" value={whatsapp} onChangeText={setWhatsapp} keyboardType="phone-pad" placeholder="00235 60605151" />
        <Field label="E-mail" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
        <Field label="Horaires" value={hours} onChangeText={setHours} placeholder="Lun - Sam : 8h - 19h" />
        <Field
          label="Lien Google Maps (optionnel)"
          value={googleMapsUrl}
          onChangeText={setGoogleMapsUrl}
          autoCapitalize="none"
          placeholder="https://maps.app.goo.gl/..."
        />

        <GoldButton label="Enregistrer" onPress={handleSave} loading={saving || isLoading} style={{ marginTop: spacing.lg }} />
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
      <TextInput placeholderTextColor={colors.creamFaint} style={styles.input} {...props} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  denied: { color: colors.creamFaint, fontFamily: fonts.body, textAlign: 'center', marginTop: 40 },
  content: { padding: spacing.md, paddingBottom: 60 },
  intro: { color: colors.creamMuted, fontFamily: fonts.body, fontSize: 13, lineHeight: 19, marginBottom: spacing.lg },
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
