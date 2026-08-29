import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { colors, fonts, radius, spacing } from '../../theme';
import { useAuthStore } from '../../store/authStore';
import { useToastStore } from '../../store/toastStore';
import { GoldButton } from '../../components/GoldButton';
import { ScreenHeader } from '../../components/ScreenHeader';
import { isSupabaseConfigured } from '../../lib/supabase';
import { CityPicker } from '../../components/CityPicker';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[+]?[\d\s-]{8,15}$/;

export function RegisterScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const signUp = useAuthStore((s) => s.signUp);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [profession, setProfession] = useState('');
  const [region, setRegion] = useState('');
  const [country, setCountry] = useState('Tchad');
  const [address, setAddress] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [acceptsNotifications, setAcceptsNotifications] = useState(true);
  const [acceptsTerms, setAcceptsTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const showToast = useToastStore((s) => s.show);

  const handleSubmit = async () => {
    if (!isSupabaseConfigured) {
      showToast(
        "Ajoutez EXPO_PUBLIC_SUPABASE_URL et EXPO_PUBLIC_SUPABASE_ANON_KEY dans .env pour activer les comptes.",
        { title: 'Supabase non configuré', type: 'error' }
      );
      return;
    }
    if (!fullName || !phone || !profession || !email || !password) {
      showToast(
        'Nom, téléphone, profession, email et mot de passe sont obligatoires.',
        { title: 'Champs manquants', type: 'error' }
      );
      return;
    }
    if (!EMAIL_REGEX.test(email.trim())) {
      showToast('Merci de saisir une adresse e-mail valide.', { title: 'E-mail invalide', type: 'error' });
      return;
    }
    if (!PHONE_REGEX.test(phone.trim())) {
      showToast('Merci de saisir un numéro de téléphone valide (8 à 15 chiffres).', {
        title: 'Téléphone invalide',
        type: 'error',
      });
      return;
    }
    if (password.length < 6) {
      showToast('Minimum 6 caractères.', { title: 'Mot de passe trop court', type: 'error' });
      return;
    }
    if (!acceptsTerms) {
      showToast("Merci d'accepter les conditions d'inscription pour continuer.", {
        title: 'Conditions non acceptées',
        type: 'error',
      });
      return;
    }
    setLoading(true);
    const { error, needsEmailConfirmation } = await signUp(email, password, {
      fullName,
      phone,
      profession,
      region,
      country,
      address,
      acceptsNotifications,
    });
    setLoading(false);
    if (error) {
      showToast(error, { title: 'Inscription impossible', type: 'error' });
    } else if (needsEmailConfirmation) {
      showToast(
        'Un e-mail de confirmation vous a été envoyé. Cliquez sur le lien reçu avant de vous connecter.',
        { title: 'Vérifiez votre e-mail 📩', type: 'info' }
      );
    } else {
      showToast('Votre compte a bien été créé.', { title: 'Bienvenue ✓', type: 'success' });
      if (navigation.canGoBack()) navigation.goBack();
    }
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Créer un compte" showBack />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionLabel}>Informations obligatoires</Text>
        <TextInput
          value={fullName}
          onChangeText={setFullName}
          placeholder="Nom et prénom *"
          placeholderTextColor={colors.creamFaint}
          style={styles.input}
        />
        <TextInput
          value={phone}
          onChangeText={setPhone}
          placeholder="Numéro de téléphone *"
          placeholderTextColor={colors.creamFaint}
          keyboardType="phone-pad"
          style={styles.input}
        />
        <TextInput
          value={profession}
          onChangeText={setProfession}
          placeholder="Profession *"
          placeholderTextColor={colors.creamFaint}
          style={styles.input}
        />
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="Email *"
          placeholderTextColor={colors.creamFaint}
          autoCapitalize="none"
          keyboardType="email-address"
          style={styles.input}
        />
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Mot de passe (min. 6 caractères) *"
          placeholderTextColor={colors.creamFaint}
          secureTextEntry
          style={styles.input}
        />

        <Text style={styles.sectionLabel}>Informations optionnelles</Text>
        <Text style={styles.fieldLabel}>📍 Ville</Text>
        <CityPicker value={region} onChange={(v) => setRegion(v)} />
        <TextInput
          value={country}
          onChangeText={setCountry}
          placeholder="Pays"
          placeholderTextColor={colors.creamFaint}
          style={styles.input}
        />
        <TextInput
          value={address}
          onChangeText={setAddress}
          placeholder="Adresse"
          placeholderTextColor={colors.creamFaint}
          style={styles.input}
        />

        <Text style={styles.privacyNote}>
          Ces informations nous permettent de mieux vous connaître et d'améliorer votre
          expérience. Nous mesurons aussi votre navigation sur le site (pages consultées, temps
          passé) à des fins statistiques internes, sans jamais les partager avec des tiers.
        </Text>
        <Pressable onPress={() => navigation.navigate('PrivacyPolicy')}>
          <Text style={styles.privacyLink}>📜 Lire notre politique de confidentialité</Text>
        </Pressable>

        <View style={styles.termsBox}>
          <Text style={styles.termsTitle}>📜 Conditions d'inscription</Text>
          <Text style={styles.termsIntro}>En créant mon compte, j'accepte :</Text>
          <Text style={styles.termsItem}>1. Fournir des informations exactes (nom, téléphone et profession).</Text>
          <Text style={styles.termsItem}>
            2. Passer uniquement des commandes sérieuses et avec une réelle intention d'achat.
          </Text>
          <Text style={styles.termsItem}>3. Respecter les règles de livraison et de paiement.</Text>
          <Text style={styles.termsItem}>
            4. Ne pas utiliser le site pour des activités frauduleuses, du spam ou des abus.
          </Text>
          <Text style={styles.termsItem}>
            5. En cas de 3 commandes non honorées ou de comportement abusif, mon compte peut être examiné,
            limité ou bloqué par l'administration.
          </Text>
          <Text style={styles.termsItem}>
            6. J'accepte de recevoir les notifications commerciales uniquement si je donne mon accord.
          </Text>
        </View>

        <Pressable style={styles.checkboxRow} onPress={() => setAcceptsTerms((v) => !v)}>
          <View style={[styles.checkbox, acceptsTerms && styles.checkboxChecked]}>
            {acceptsTerms && <Text style={styles.checkboxMark}>✓</Text>}
          </View>
          <Text style={styles.checkboxLabel}>J'ai lu et j'accepte les conditions d'inscription.</Text>
        </Pressable>

        <Pressable style={styles.checkboxRow} onPress={() => setAcceptsNotifications((v) => !v)}>
          <View style={[styles.checkbox, acceptsNotifications && styles.checkboxChecked]}>
            {acceptsNotifications && <Text style={styles.checkboxMark}>✓</Text>}
          </View>
          <Text style={styles.checkboxLabel}>
            Je souhaite recevoir les notifications concernant les nouveaux produits et offres
            d'ALBASSE SHOPPING.
          </Text>
        </Pressable>
        <Text style={styles.checkboxHint}>
          Modifiable à tout moment dans Mon compte → Notifications.
        </Text>

        <GoldButton label="Créer mon compte" onPress={handleSubmit} loading={loading} style={{ marginTop: spacing.md }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingTop: spacing.xl, paddingBottom: 60 },
  sectionLabel: {
    color: colors.creamMuted,
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
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
  fieldLabel: { color: colors.creamMuted, fontFamily: fonts.bodyMedium, fontSize: 12, marginBottom: 6 },
  privacyNote: {
    color: colors.creamFaint,
    fontFamily: fonts.body,
    fontSize: 11,
    lineHeight: 16,
    marginTop: spacing.sm,
  },
  privacyLink: { color: colors.gold, fontFamily: fonts.bodyMedium, fontSize: 12, marginTop: spacing.sm },
  termsBox: {
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  termsTitle: { color: colors.goldLight, fontFamily: fonts.bodySemiBold, fontSize: 13, marginBottom: 6 },
  termsIntro: { color: colors.creamMuted, fontFamily: fonts.body, fontSize: 11, marginBottom: 6 },
  termsItem: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 11, lineHeight: 16, marginBottom: 4 },
  checkboxRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: spacing.md },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxChecked: { backgroundColor: colors.gold },
  checkboxMark: { color: colors.background, fontFamily: fonts.bodyBold, fontSize: 13 },
  checkboxLabel: { flex: 1, color: colors.cream, fontFamily: fonts.body, fontSize: 12, lineHeight: 17 },
  checkboxHint: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 10, marginTop: 4, marginLeft: 30 },
});
