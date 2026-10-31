import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Linking } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { colors, fonts, spacing, accountField, accountFieldPlaceholder } from '../../theme';
import { useAuthStore } from '../../store/authStore';
import { useToastStore } from '../../store/toastStore';
import { GoldButton } from '../../components/GoldButton';
import { ScreenHeader } from '../../components/ScreenHeader';
import { isSupabaseConfigured } from '../../lib/supabase';
import { useStoreSettings } from '../../hooks/useStoreSettings';
import { phoneDigits } from '../../lib/phoneAuth';

export function ForgotPasswordScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const resetPassword = useAuthStore((s) => s.resetPassword);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  // compte créé avec le numéro : pas d'e-mail pour envoyer le lien, l'équipe aide sur WhatsApp
  const [phoneHelp, setPhoneHelp] = useState<string | null>(null);
  const showToast = useToastStore((s) => s.show);
  const { settings } = useStoreSettings();

  const askOnWhatsApp = () => {
    const shop = phoneDigits(settings.whatsapp ?? '') ?? '23560605151';
    const text = `Bonjour Albasse Shopping, j'ai oublié le mot de passe de mon compte (numéro ${phoneHelp}). Pouvez-vous m'aider ?`;
    Linking.openURL(`https://wa.me/${shop}?text=${encodeURIComponent(text)}`);
  };

  const handleSubmit = async () => {
    if (!isSupabaseConfigured) {
      showToast(
        "Ajoutez EXPO_PUBLIC_SUPABASE_URL et EXPO_PUBLIC_SUPABASE_ANON_KEY dans .env pour activer les comptes.",
        { title: 'Supabase non configuré', type: 'error' }
      );
      return;
    }
    if (!email.trim()) {
      showToast('Entrez votre e-mail ou votre numéro de téléphone.', { title: 'Champ manquant', type: 'error' });
      return;
    }
    if (!email.includes('@')) {
      if (!phoneDigits(email)) {
        showToast('Merci de saisir un e-mail ou un numéro de téléphone valide.', { title: 'Invalide', type: 'error' });
        return;
      }
      setPhoneHelp(email.trim());
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
        {phoneHelp ? (
          <View testID="forgot-phone-help">
            <Text style={styles.info}>
              Votre compte a été créé avec votre numéro de téléphone. Écrivez-nous sur WhatsApp : notre équipe vous donne
              un nouveau code. Vous pourrez ensuite le changer dans « Compte » › « Changer mon mot de passe ».
            </Text>
            <GoldButton label="💬 Écrire sur WhatsApp" onPress={askOnWhatsApp} style={{ marginTop: spacing.md }} />
          </View>
        ) : sent ? (
          <Text style={styles.info}>
            Si un compte existe avec l'adresse {email.trim()}, un e-mail contenant un lien de réinitialisation vient
            de lui être envoyé. Pensez à vérifier vos spams.
          </Text>
        ) : (
          <>
            <Text style={styles.info}>
              Indiquez l'e-mail de votre compte : nous vous enverrons un lien pour choisir un nouveau mot de passe. Compte
              créé avec votre numéro de téléphone ? Écrivez votre numéro.
            </Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              testID="forgot-identifier"
              placeholder="E-mail ou numéro de téléphone"
              placeholderTextColor={accountFieldPlaceholder}
              autoCapitalize="none"
              autoCorrect={false}
              style={accountField}
            />
            <GoldButton
              label="Continuer"
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
});
