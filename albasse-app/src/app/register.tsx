import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { colors, fonts, radius, spacing } from '../theme';
import { useAuthStore } from '../store/authStore';
import { GoldButton } from '../components/GoldButton';
import { ScreenHeader } from '../components/ScreenHeader';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function RegisterScreen() {
  const signUp = useAuthStore((s) => s.signUp);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [acceptsTerms, setAcceptsTerms] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!fullName || !phone || !email || !password) {
      Alert.alert('Champs manquants', 'Nom, téléphone, email et mot de passe sont obligatoires.');
      return;
    }
    if (!EMAIL_REGEX.test(email.trim())) {
      Alert.alert('E-mail invalide', 'Merci de saisir une adresse e-mail valide.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Mot de passe trop court', 'Minimum 6 caractères.');
      return;
    }
    if (!acceptsTerms) {
      Alert.alert('Conditions non acceptées', "Merci d'accepter les conditions pour continuer.");
      return;
    }

    setLoading(true);
    const { error, needsEmailConfirmation } = await signUp(email.trim(), password, { fullName, phone });
    setLoading(false);

    if (error) {
      Alert.alert('Inscription impossible', error);
    } else if (needsEmailConfirmation) {
      Alert.alert(
        'Vérifiez votre e-mail 📩',
        'Un e-mail de confirmation vous a été envoyé. Cliquez sur le lien reçu avant de vous connecter.',
        [{ text: 'OK', onPress: () => router.replace('/login') }]
      );
    } else {
      Alert.alert('Bienvenue ✓', 'Votre compte a bien été créé.');
      if (router.canGoBack()) router.back();
      else router.replace('/');
    }
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Créer un compte" showBack />
      <ScrollView contentContainerStyle={styles.content}>
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

        <Pressable style={styles.checkboxRow} onPress={() => setAcceptsTerms((v) => !v)}>
          <View style={[styles.checkbox, acceptsTerms && styles.checkboxChecked]}>
            {acceptsTerms && <Text style={styles.checkboxMark}>✓</Text>}
          </View>
          <Text style={styles.checkboxLabel}>
            J'ai lu et j'accepte les conditions d'utilisation et la politique de confidentialité.
          </Text>
        </Pressable>

        <GoldButton label="Créer mon compte" onPress={handleSubmit} loading={loading} style={{ marginTop: spacing.lg }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: 60 },
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
