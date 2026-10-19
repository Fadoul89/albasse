import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable } from 'react-native';
import { colors, fonts, radius, spacing } from '../theme';
import { useAuthStore } from '../store/authStore';
import { useToastStore } from '../store/toastStore';
import { GoldButton } from './GoldButton';
import { CityPicker } from './CityPicker';
import { checkProfileForm, formFromProfile, profileFormChanged, type ProfileField, type ProfileForm } from '../lib/profileEdit';
import type { Profile } from '../types';
import { visibleEmail } from '../lib/phoneAuth';

interface Props {
  profile: Profile;
  onClose: () => void;
}

// Le client modifie lui-meme ses informations : nom, telephone, WhatsApp, profession, ville, pays et adresse.
// Elles servent ensuite a pre-remplir ses commandes et a Zara pour le saluer par son prenom.
export function ProfileEditor({ profile, onClose }: Props) {
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const showToast = useToastStore((s) => s.show);
  const [form, setForm] = useState<ProfileForm>(() => formFromProfile(profile));
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<{ field: ProfileField; message: string } | null>(null);

  const change = (key: ProfileField) => (value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (problem?.field === key) setProblem(null);
  };

  const save = async () => {
    const check = checkProfileForm(form);
    if (!check.ok) {
      setProblem({ field: check.field, message: check.message });
      showToast(check.message, { title: check.title, type: 'error' });
      return;
    }
    setSaving(true);
    const { error } = await updateProfile(check.changes);
    setSaving(false);
    if (error) {
      setProblem(null);
      showToast(error, { title: 'Enregistrement impossible', type: 'error' });
      return;
    }
    showToast('Vos informations ont été mises à jour.', { title: 'Profil mis à jour ✓', type: 'success' });
    onClose();
  };

  const field = (key: ProfileField, label: string, extra: { keyboardType?: 'phone-pad'; testID: string }) => (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={form[key]}
        onChangeText={change(key)}
        placeholder={label}
        placeholderTextColor={colors.creamFaint}
        keyboardType={extra.keyboardType}
        testID={extra.testID}
        style={[styles.input, problem?.field === key && styles.inputError]}
      />
      {problem?.field === key ? (
        <Text style={styles.error} testID="profile-error">
          {problem.message}
        </Text>
      ) : null}
    </View>
  );

  return (
    <View style={styles.card} testID="profile-editor">
      <Text style={styles.title}>✏️ Modifier mon profil</Text>
      <Text style={styles.email}>E-mail : {visibleEmail(profile.email) ?? '— (connexion avec votre numéro de téléphone)'}</Text>
      {field('fullName', 'Nom et prénom', { testID: 'profile-input-fullName' })}
      {field('phone', 'Numéro de téléphone', { keyboardType: 'phone-pad', testID: 'profile-input-phone' })}
      {field('whatsappNumber', 'Numéro WhatsApp', { keyboardType: 'phone-pad', testID: 'profile-input-whatsapp' })}
      {!form.whatsappNumber.trim() && form.phone.trim() ? (
        <Pressable onPress={() => change('whatsappNumber')(form.phone)} style={styles.sameNumber}>
          <Text style={styles.link}>Même numéro que mon téléphone</Text>
        </Pressable>
      ) : null}
      {field('profession', 'Profession', { testID: 'profile-input-profession' })}
      <View style={styles.field}>
        <Text style={styles.label}>📍 Ville</Text>
        <CityPicker value={form.region} onChange={(v) => change('region')(v)} />
      </View>
      {field('country', 'Pays', { testID: 'profile-input-country' })}
      {field('address', 'Adresse', { testID: 'profile-input-address' })}
      <GoldButton
        label="Enregistrer"
        onPress={save}
        loading={saving}
        disabled={!profileFormChanged(form, profile)}
        style={{ marginTop: spacing.md }}
      />
      <GoldButton label="Annuler" onPress={onClose} variant="outline" disabled={saving} style={{ marginTop: spacing.sm }} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.panelAlt,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  title: { color: colors.goldLight, fontFamily: fonts.bodySemiBold, fontSize: 15, marginBottom: 4 },
  email: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 12, marginBottom: spacing.md },
  field: { marginBottom: spacing.sm },
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
  inputError: { borderColor: colors.red },
  error: { color: colors.red, fontFamily: fonts.bodyMedium, fontSize: 12, marginTop: 4 },
  sameNumber: { marginBottom: spacing.sm, marginTop: -2 },
  link: { color: colors.gold, fontFamily: fonts.bodyMedium, fontSize: 12 },
});
