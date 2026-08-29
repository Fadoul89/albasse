import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts, radius, spacing } from '../theme';
import { useAuthStore } from '../store/authStore';
import { useToastStore } from '../store/toastStore';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { ScreenHeader } from '../components/ScreenHeader';
import { GoldButton } from '../components/GoldButton';

const AFFILIATE_TYPES = ['TikTokeur', 'Influenceur', 'Vendeur', 'Étudiant', 'Créateur de contenu', 'Particulier', 'Autre'];

function generateReferralCode(name: string | null): string {
  const base = (name ?? 'AFF')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z]/g, '')
    .toUpperCase()
    .slice(0, 4) || 'AFF';
  const suffix = Math.floor(100 + Math.random() * 900);
  return `${base}${suffix}`;
}

export function AffiliateApplyScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const profile = useAuthStore((s) => s.profile);
  const refreshProfile = useAuthStore((s) => s.refreshProfile);
  const showToast = useToastStore((s) => s.show);

  const [affiliateType, setAffiliateType] = useState('');
  const [socialLink, setSocialLink] = useState('');
  const [mobileMoney, setMobileMoney] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleApply = async () => {
    if (!profile) return;
    if (!affiliateType || !socialLink.trim() || !mobileMoney.trim()) {
      showToast('Merci de remplir tous les champs (type, réseau social et numéro Mobile Money).', {
        title: 'Champs manquants',
        type: 'error',
      });
      return;
    }
    if (!isSupabaseConfigured) {
      showToast('Connectez Supabase pour activer le programme d\'affiliation.', { title: 'Mode démo', type: 'error' });
      return;
    }
    setSubmitting(true);
    const code = profile.referral_code ?? generateReferralCode(profile.full_name);
    const { error } = await supabase
      .from('profiles')
      .update({
        is_affiliate: true,
        affiliate_status: 'pending',
        affiliate_type: affiliateType,
        social_link: socialLink.trim(),
        affiliate_mobile_money: mobileMoney.trim(),
        referral_code: code,
      })
      .eq('id', profile.id);
    setSubmitting(false);
    if (error) {
      showToast(error.message, { title: 'Erreur', type: 'error' });
      return;
    }
    showToast('Votre candidature a été envoyée. Vous serez averti dès son approbation.', {
      title: 'Candidature envoyée ✓',
      type: 'success',
    });
    await refreshProfile();
  };

  if (!isAuthenticated || !profile) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Devenir affilié" showBack />
        <View style={styles.centerWrap}>
          <Text style={styles.icon}>🤝</Text>
          <Text style={styles.title}>Programme d'affiliation ALBASSE SHOPPING</Text>
          <Text style={styles.subtitle}>
            Partagez vos liens produits sur TikTok, Facebook, WhatsApp... et touchez une commission sur
            chaque vente générée. Créez d'abord un compte (ou connectez-vous) pour postuler.
          </Text>
          <GoldButton
            label="Créer mon compte"
            onPress={() => navigation.navigate('Register')}
            style={{ marginTop: spacing.xl, width: '100%' }}
          />
          <GoldButton
            label="J'ai déjà un compte — Se connecter"
            variant="outline"
            onPress={() => navigation.navigate('Login')}
            style={{ marginTop: spacing.sm, width: '100%' }}
          />
        </View>
      </View>
    );
  }

  if (profile.is_affiliate && profile.affiliate_status === 'approved') {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Devenir affilié" showBack />
        <View style={styles.centerWrap}>
          <Text style={styles.icon}>✅</Text>
          <Text style={styles.title}>Vous êtes déjà affilié !</Text>
          <GoldButton
            label="Accéder à mon espace affilié"
            onPress={() => navigation.navigate('AffiliateDashboard' as never)}
            style={{ marginTop: spacing.xl, width: '100%' }}
          />
        </View>
      </View>
    );
  }

  if (profile.is_affiliate && profile.affiliate_status === 'pending') {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Devenir affilié" showBack />
        <View style={styles.centerWrap}>
          <Text style={styles.icon}>⏳</Text>
          <Text style={styles.title}>Candidature en attente</Text>
          <Text style={styles.subtitle}>
            Votre demande a bien été reçue. Notre équipe l'examine et vous serez averti dès qu'elle sera
            approuvée.
          </Text>
        </View>
      </View>
    );
  }

  if (profile.is_affiliate && profile.affiliate_status === 'blocked') {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Devenir affilié" showBack />
        <View style={styles.centerWrap}>
          <Text style={styles.icon}>🚫</Text>
          <Text style={styles.title}>Compte affilié bloqué</Text>
          <Text style={styles.subtitle}>
            Votre accès au programme d'affiliation a été suspendu. Contactez-nous si vous pensez qu'il
            s'agit d'une erreur.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Devenir affilié" showBack />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>🤝 Rejoignez le programme d'affiliation</Text>
        <Text style={styles.subtitle}>
          Partagez votre lien unique sur TikTok, Facebook, Instagram ou WhatsApp et touchez une commission
          sur chaque vente réalisée grâce à vous.
        </Text>

        <Text style={styles.sectionLabel}>Type de profil</Text>
        <View style={styles.chipsRow}>
          {AFFILIATE_TYPES.map((t) => (
            <Pressable
              key={t}
              style={[styles.chip, affiliateType === t && styles.chipActive]}
              onPress={() => setAffiliateType(t)}
            >
              <Text style={[styles.chipText, affiliateType === t && styles.chipTextActive]}>{t}</Text>
            </Pressable>
          ))}
        </View>

        <TextInput
          value={socialLink}
          onChangeText={setSocialLink}
          placeholder="Lien TikTok / Facebook / Instagram *"
          placeholderTextColor={colors.creamFaint}
          autoCapitalize="none"
          style={styles.input}
        />
        <TextInput
          value={mobileMoney}
          onChangeText={setMobileMoney}
          placeholder="Numéro Airtel Money / Moov Money (pour vos commissions) *"
          placeholderTextColor={colors.creamFaint}
          keyboardType="phone-pad"
          style={styles.input}
        />

        <Text style={styles.hint}>
          Votre nom, téléphone et ville sont déjà enregistrés sur votre compte.
        </Text>

        <GoldButton label="Envoyer ma candidature" onPress={handleApply} loading={submitting} style={{ marginTop: spacing.lg }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: 60 },
  centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  icon: { fontSize: 44, marginBottom: 16 },
  title: { color: colors.cream, fontFamily: fonts.display, fontSize: 19, textAlign: 'center', marginBottom: spacing.sm },
  subtitle: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 13, textAlign: 'center', lineHeight: 19 },
  sectionLabel: {
    color: colors.creamMuted,
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.md },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  chipText: { color: colors.creamMuted, fontFamily: fonts.bodyMedium, fontSize: 12 },
  chipTextActive: { color: colors.background, fontFamily: fonts.bodyBold },
  input: {
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.cream,
    fontFamily: fonts.body,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  hint: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 11, marginTop: 4 },
});
