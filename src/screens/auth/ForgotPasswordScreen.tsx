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
import { alertPasswordRequest } from '../../lib/passwordRequestAlert';
import { forgotEmailMessage, forgotMessage, forgotNumberMessage, looksLikeClientNumber, parseClientNumber, zaraForgotLine } from '../../lib/clientNumber';
import { ZaraSays } from '../../components/ZaraSays';

export function ForgotPasswordScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const resetPassword = useAuthStore((s) => s.resetPassword);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  // compte créé avec le numéro : pas d'e-mail pour envoyer le lien, l'équipe aide sur WhatsApp
  const [phoneHelp, setPhoneHelp] = useState<string | null>(null);
  // le client a tapé son numéro client (AS-000123) : pareil, l'équipe retrouve le compte et donne un nouveau code
  const [numberHelp, setNumberHelp] = useState<string | null>(null);
  // numéro client (AS-000123), facultatif : il aide l'équipe à retrouver le bon compte, même si le client a changé de téléphone
  const [clientNo, setClientNo] = useState('');
  const showToast = useToastStore((s) => s.show);
  const { settings } = useStoreSettings();

  const openShopWhatsApp = (text: string) => {
    const shop = phoneDigits(settings.whatsapp ?? '') ?? '23560605151';
    Linking.openURL(`https://wa.me/${shop}?text=${encodeURIComponent(text)}`);
  };
  const askOnWhatsApp = () => openShopWhatsApp(numberHelp ? forgotNumberMessage(numberHelp) : forgotMessage(phoneHelp ?? '', clientNo));
  // e-mail tapé mais rien reçu (compte créé avec le numéro de téléphone, ou e-mail mal écrit) : l'équipe aide sur WhatsApp
  const askAfterEmail = () => openShopWhatsApp(forgotEmailMessage(email));

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
      // le numéro client (AS-000123) : l'équipe est prévenue sur Telegram avec la fiche, le client écrit sur WhatsApp
      if (looksLikeClientNumber(email)) {
        void alertPasswordRequest(email);
        setNumberHelp(email.trim());
        return;
      }
      if (!phoneDigits(email)) {
        showToast('Merci de saisir un e-mail, un numéro de téléphone ou un numéro client (AS-000123).', { title: 'Invalide', type: 'error' });
        return;
      }
      // l'équipe est prévenue sur Telegram (sans attendre que le client écrive sur WhatsApp) ; jamais bloquant
      void alertPasswordRequest(email);
      setPhoneHelp(email.trim());
      return;
    }
    void alertPasswordRequest(email);
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
        {/* Zara guide le client (elle n'ouvre pas son chat : un visiteur sans compte ne le voit pas quand le compte est obligatoire) */}
        <ZaraSays testID="forgot-zara" text={zaraForgotLine(numberHelp || phoneHelp ? 'whatsapp' : sent ? 'emailSent' : 'start')} />
        {numberHelp ? (
          <View testID="forgot-phone-help">
            <Text style={styles.info} testID="forgot-number-help">
              Nous avons noté votre numéro client ({parseClientNumber(numberHelp) !== null ? `AS-${String(parseClientNumber(numberHelp)).padStart(6, '0')}` : numberHelp}). Écrivez-nous sur WhatsApp : notre équipe retrouve votre
              compte et vous donne un nouveau code. Vous pourrez ensuite le changer dans « Compte » › « Changer mon mot de passe ».
            </Text>
            <GoldButton label="💬 Écrire sur WhatsApp" onPress={askOnWhatsApp} style={{ marginTop: spacing.md }} />
          </View>
        ) : phoneHelp ? (
          <View testID="forgot-phone-help">
            <Text style={styles.info}>
              Votre compte a été créé avec votre numéro de téléphone. Écrivez-nous sur WhatsApp : notre équipe vous donne
              un nouveau code. Vous pourrez ensuite le changer dans « Compte » › « Changer mon mot de passe ».
            </Text>
            <TextInput
              value={clientNo}
              onChangeText={setClientNo}
              testID="forgot-client-number"
              placeholder="Numéro client (facultatif, ex. AS-000123)"
              placeholderTextColor={accountFieldPlaceholder}
              autoCapitalize="characters"
              autoCorrect={false}
              style={accountField}
            />
            <Text style={styles.small} testID="forgot-client-number-hint">
              {clientNo.trim() && parseClientNumber(clientNo) === null
                ? 'Ce numéro n’a pas la bonne forme (exemple : AS-000123). Vous pouvez aussi laisser vide.'
                : 'Votre numéro client est dans « Compte ». Si vous le connaissez, l’équipe retrouve votre compte plus vite.'}
            </Text>
            <GoldButton label="💬 Écrire sur WhatsApp" onPress={askOnWhatsApp} style={{ marginTop: spacing.md }} />
          </View>
        ) : sent ? (
          <View testID="forgot-email-sent">
            <Text style={styles.info}>
              Si un compte existe avec l'adresse {email.trim()}, un e-mail contenant un lien de réinitialisation vient
              de lui être envoyé. Pensez à vérifier vos spams.
            </Text>
            <Text style={styles.info}>
              Rien reçu ? Votre compte a peut-être été créé avec votre numéro de téléphone : écrivez-nous sur WhatsApp, notre équipe vous donne un nouveau code.
            </Text>
            <GoldButton label="💬 Rien reçu ? Écrire sur WhatsApp" onPress={askAfterEmail} testID="forgot-email-whatsapp" style={{ marginTop: spacing.sm }} />
          </View>
        ) : (
          <>
            <Text style={styles.info}>
              Indiquez l'e-mail de votre compte : nous vous enverrons un lien pour choisir un nouveau mot de passe. Compte
              créé avec votre numéro de téléphone ? Écrivez votre numéro de téléphone, ou votre numéro client (AS-000123).
            </Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              testID="forgot-identifier"
              placeholder="E-mail, téléphone ou numéro client"
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
  small: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 12, lineHeight: 17, marginTop: 4 },
});
