// Le formulaire « Créer un compte » : SEULEMENT nom, téléphone, mot de passe, e-mail (facultatif) et les conditions. Il sert à l'écran d'entrée (compte obligatoire)
// et à la page Inscription. Tout le reste (Homme / Femme, date de naissance, situation, numéro WhatsApp, notifications) est demandé APRÈS, à l'intérieur du site,
// comme un petit sondage sur l'accueil (components/SurveyCard, docs/sondage-client.md) : jamais un obstacle pour créer son compte.
import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable } from 'react-native';
import { colors, fonts, radius, spacing, accountField, accountFieldPlaceholder } from '../theme';
import { useAuthStore } from '../store/authStore';
import { useToastStore } from '../store/toastStore';
import { isSupabaseConfigured } from '../lib/supabase';
import { isValidEmail, phoneDigits } from '../lib/phoneAuth';
import { rememberLogin } from '../lib/rememberLogin';
import { installAfterSignUpDue, markInstallPageShown } from '../lib/installAfterSignUp';
import { navigationRef } from '../navigation/navigationRef';
import { GoldButton } from './GoldButton';
import { inviterFirstName, readStoredInviteCode } from '../lib/friendInvitesApi';
import { checkStepOne } from '../lib/entryScreen';
import { inviterGreeting } from '../lib/friendInvites';

export function RegisterForm({ onSuccess, onPrivacy }: { onSuccess: () => void; onPrivacy: () => void }) {
  const signUp = useAuthStore((s) => s.signUp);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [acceptsTerms, setAcceptsTerms] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const showToast = useToastStore((s) => s.show);
  // Parrainage : le code du lien d'invitation, s'il y en a un, dit « Invité(e) par Amina » (rien n'est affiché si le code n'existe pas)
  const [inviter, setInviter] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    readStoredInviteCode().then((code) => (code ? inviterFirstName(code) : null)).then((name) => alive && setInviter(name));
    return () => {
      alive = false;
    };
  }, []);

  // Le compte est créé avec le nom, le téléphone et le mot de passe (+ l'e-mail s'il est écrit). Les notifications ne sont PAS activées ici : le client
  // donne son accord (ou non) dans le sondage, comme le disent les conditions (« uniquement si je donne mon accord »).
  const handleSubmit = async () => {
    if (!isSupabaseConfigured) {
      showToast(
        "Ajoutez EXPO_PUBLIC_SUPABASE_URL et EXPO_PUBLIC_SUPABASE_ANON_KEY dans .env pour activer les comptes.",
        { title: 'Supabase non configuré', type: 'error' }
      );
      return;
    }
    const step = checkStepOne({ name: fullName, phone, password, terms: acceptsTerms, email }, !!phoneDigits(phone), !email.trim() || isValidEmail(email));
    if (!step.ok) {
      showToast(step.message, { title: step.title, type: 'error' });
      return;
    }
    setLoading(true);
    const { error, needsEmailConfirmation } = await signUp(password, {
      fullName: fullName.trim(),
      phone: phone.trim(),
      email: email.trim(),
      acceptsNotifications: false,
    });
    setLoading(false);
    if (error) {
      showToast(error, { title: 'Inscription impossible', type: 'error' });
      return;
    }
    if (needsEmailConfirmation) {
      showToast('Un e-mail de confirmation vous a été envoyé. Cliquez sur le lien reçu avant de vous connecter.', { title: 'Vérifiez votre e-mail 📩', type: 'info' });
      return;
    }
    showToast('Votre compte a bien été créé.', { title: 'Bienvenue ✓', type: 'success' });
    rememberLogin(phone, true);
    onSuccess();
    // téléphone sans le raccourci : juste après l'inscription, la page d'installation (une seule fois). Le court délai laisse
    // RootNavigator rouvrir la page demandée avant (sinon elle effacerait la page d'installation).
    if (installAfterSignUpDue()) {
      markInstallPageShown();
      setTimeout(() => {
        if (navigationRef.isReady()) navigationRef.navigate('Install');
      }, 800);
    }
  };

  return (
    <View>
      {inviter ? (
        <Text style={styles.invitedBy} testID="register-invited-by">
          🎁 {inviterGreeting(inviter)}
        </Text>
      ) : null}
      <Text style={styles.sectionLabel}>Créer mon compte · c’est rapide</Text>
      <TextInput
        testID="register-name"
        autoComplete="name"
        value={fullName}
        onChangeText={setFullName}
        placeholder="Nom et prénom (obligatoire)"
        placeholderTextColor={accountFieldPlaceholder}
        style={accountField}
      />
      <TextInput
        testID="register-phone"
        autoComplete="tel"
        textContentType="telephoneNumber"
        value={phone}
        onChangeText={setPhone}
        placeholder="Numéro de téléphone (obligatoire)"
        placeholderTextColor={accountFieldPlaceholder}
        keyboardType="phone-pad"
        style={accountField}
      />
      <TextInput
        testID="register-password"
        autoComplete="new-password"
        textContentType="newPassword"
        value={password}
        onChangeText={setPassword}
        placeholder="Mot de passe (obligatoire, min. 6)"
        placeholderTextColor={accountFieldPlaceholder}
        secureTextEntry
        style={accountField}
      />
      <Text style={styles.fieldHint}>Pour vous connecter : votre numéro de téléphone et ce mot de passe.</Text>
      <TextInput
        testID="register-email"
        autoComplete="email"
        value={email}
        onChangeText={setEmail}
        placeholder="Adresse e-mail (facultatif)"
        placeholderTextColor={accountFieldPlaceholder}
        autoCapitalize="none"
        keyboardType="email-address"
        style={accountField}
      />
      <Pressable testID="register-terms" style={styles.checkboxRow} onPress={() => setAcceptsTerms((v) => !v)}>
        <View style={[styles.checkbox, acceptsTerms && styles.checkboxChecked]}>{acceptsTerms && <Text style={styles.checkboxMark}>✓</Text>}</View>
        <Text style={styles.checkboxLabel}>J'ai lu et j'accepte les conditions d'inscription.</Text>
      </Pressable>
      <GoldButton label="Créer mon compte" onPress={handleSubmit} loading={loading} style={{ marginTop: spacing.sm }} testID="register-submit" />
      <Pressable testID="register-terms-toggle" onPress={() => setShowTerms((v) => !v)}>
        <Text style={styles.privacyLink}>{showTerms ? '▲ Masquer les conditions' : '📜 Lire les conditions d’inscription'}</Text>
      </Pressable>
      {showTerms && (
        <View style={styles.termsBox} testID="register-terms-box">
          <Text style={styles.termsItem}>1. Fournir des informations exactes (nom et téléphone).</Text>
          <Text style={styles.termsItem}>2. Passer uniquement des commandes sérieuses et avec une réelle intention d'achat.</Text>
          <Text style={styles.termsItem}>3. Respecter les règles de livraison et de paiement.</Text>
          <Text style={styles.termsItem}>4. Ne pas utiliser le site pour des activités frauduleuses, du spam ou des abus.</Text>
          <Text style={styles.termsItem}>
            5. En cas de 3 commandes non honorées ou de comportement abusif, mon compte peut être examiné, limité ou bloqué par l'administration.
          </Text>
          <Text style={styles.termsItem}>6. J'accepte de recevoir les notifications commerciales uniquement si je donne mon accord.</Text>
          <Pressable onPress={onPrivacy}>
            <Text style={styles.privacyLink}>📜 Lire notre politique de confidentialité</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  invitedBy: { color: '#b45309', fontFamily: fonts.bodySemiBold, fontSize: 14, marginBottom: 10 },
  sectionLabel: {
    color: colors.creamMuted,
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  fieldHint: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 11, marginTop: -2, marginBottom: spacing.sm },
  privacyLink: { color: colors.gold, fontFamily: fonts.bodyMedium, fontSize: 12, marginTop: spacing.sm },
  termsBox: {
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
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
});
