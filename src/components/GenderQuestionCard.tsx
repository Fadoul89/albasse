// Zara demande « Vous êtes ? Homme / Femme » aux clients déjà inscrits qui n'ont pas encore choisi (les nouveaux comptes le choisissent à l'inscription).
// Une petite carte sur l'accueil (pas une fenêtre : elle ne gêne jamais la fenêtre « Télécharge l'app »). Un geste suffit.
// « Plus tard » : la carte revient 3 jours après, trois fois au plus (voir lib/clientGender.ts), puis Zara ne demande plus. Rien n'est jamais deviné.
// Cachée : pour l'équipe, pour un client qui a déjà choisi, et tant que le script add-client-gender.sql n'est pas lancé (la colonne n'existe pas).
import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, fonts, radius, spacing } from '../theme';
import { useAuthStore } from '../store/authStore';
import { useToastStore } from '../store/toastStore';
import { GenderPicker } from './GenderPicker';
import { genderAskDue, genderOf, hasGenderColumn, parseAskState, type Gender } from '../lib/clientGender';

const ASK_KEY = 'albasse_gender_ask_v1_';
// comptes pour lesquels la carte a déjà été montrée pendant cette visite (même si le téléphone refuse de garder la date) : jamais deux fois de suite
const shownThisVisit = new Set<string>();

export function GenderQuestionCard() {
  const profile = useAuthStore((s) => s.profile);
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const showToast = useToastStore((s) => s.show);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const profileId = profile?.id ?? null;
  const known = !!genderOf(profile?.gender);
  useEffect(() => {
    if (!profile || !profileId || known || shownThisVisit.has(profileId)) return;
    let alive = true;
    const key = ASK_KEY + profileId;
    AsyncStorage.getItem(key)
      .catch(() => null)
      .then((raw) => {
        if (!alive) return;
        const state = parseAskState(raw);
        const now = Date.now();
        if (!genderAskDue(profile, state, now)) return;
        shownThisVisit.add(profileId);
        AsyncStorage.setItem(key, JSON.stringify({ count: state.count + 1, last: now })).catch(() => {});
        setOpen(true);
      });
    return () => {
      alive = false;
    };
  }, [profileId, known]);

  if (!open || !profile || known || !hasGenderColumn(profile) || profile.is_admin) return null;

  const answer = async (gender: Gender) => {
    if (saving) return;
    setSaving(true);
    const { error } = await updateProfile({ gender });
    setSaving(false);
    if (error) {
      showToast(error, { title: 'Enregistrement impossible', type: 'error' });
      return;
    }
    setOpen(false);
    showToast('Merci, c’est noté. Zara vous conseillera mieux.', { title: 'Merci ✓', type: 'success' });
  };

  return (
    <View style={styles.card} testID="gender-card">
      <Text style={styles.title}>✨ Zara : une petite question</Text>
      <Text style={styles.text}>Pour mieux vous conseiller, vous êtes…</Text>
      <GenderPicker value="" onChange={answer} testIDPrefix="gender-card" disabled={saving} />
      <Pressable testID="gender-card-later" onPress={() => setOpen(false)} disabled={saving} style={styles.later}>
        <Text style={styles.laterText}>Plus tard</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.panelAlt,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.gold,
    padding: spacing.md,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  title: { color: colors.goldLight, fontFamily: fonts.bodySemiBold, fontSize: 14, marginBottom: 4 },
  text: { color: colors.cream, fontFamily: fonts.body, fontSize: 13, marginBottom: spacing.sm },
  later: { alignSelf: 'center', paddingVertical: 4, paddingHorizontal: spacing.md },
  laterText: { color: colors.creamFaint, fontFamily: fonts.bodyMedium, fontSize: 12 },
});
