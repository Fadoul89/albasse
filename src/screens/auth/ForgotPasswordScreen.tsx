import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { colors, fonts, radius, spacing } from '../../theme';
import { useAuthStore } from '../../store/authStore';
import { useToastStore } from '../../store/toastStore';
import { GoldButton } from '../../components/GoldButton';
import { ScreenHeader } from '../../components/ScreenHeader';
import { isSupabaseConfigured } from '../../lib/supabase';

export function ForgotPasswordScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const resetPassword = useAuthStore((s) => s.resetPassword);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const showToast = useToastStore((s) => s.show);

  const handleSubmit = async () => {
    if (!isSupabaseConfigured) {
      showToast(
        "Ajoutez EXPO_PUBLIC_SUPABASE_URL et EXPO_PUBLIC_SUPABASE_ANON_KEY dans .env pour activer les comptes.",
        { title: 'Supabase non configuré', type: 'error' }
      );
      return;
    }
    if (!email) {
      showToast('Entrez votre email.', { title: 'Champ manquant', type: 'error' });
      return;
    }
    setLoading(true);
    const { error } = await resetPassword(email.trim());
    setLoading(false);
    if (error) {
      showToast(error, { title: 'Envoi impossible', type: 'error' });
      return;
    }
    setSent(true);
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Mot de passe oublié" showBack />
      <View style={styles.content}>
        <Text style={styles.brand}>ALBASSE SHOPPING</Text>
        {sent ? (
          <Text style={styles.info}>
            Si un compte existe avec l'adresse {email.trim()}, un e-mail contenant un lien de réinitialisation vient
            de lui être envoyé. Pensez à vérifier vos spams.
          </Text>
        ) : (
          <>
            <Text style={styles.info}>
              Indiquez l'e-mail de votre compte. Nous vous enverrons un lien pour choisir un nouveau mot de passe.
            </Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="Email"
              placeholderTextColor={colors.creamFaint}
              autoCapitalize="none"
              keyboardType="email-address"
              style={styles.input}
            />
            <GoldButton
              label="Envoyer le lien"
              onPress={handleSubmit}
              loading={loading}
              style={{ marginTop: spacing.md }}
            />
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingTop: spacing.xl },
  brand: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.goldLight,
    textAlign: 'center',
    marginBottom: spacing.xl,
    letterSpacing: 1,
  },
  info: { color: colors.creamMuted, fontFamily: fonts.body, fontSize: 14, lineHeight: 21, marginBottom: spacing.md },
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
});
