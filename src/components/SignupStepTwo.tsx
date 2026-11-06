// Étape 2 de l'inscription (docs/ecran-entree.md) : juste après la création du compte avec le formulaire court de l'écran d'entrée, les 3 questions
// (Homme / Femme, date de naissance, célibataire / marié) restent OBLIGATOIRES, comme avant ; puis les informations facultatives et la case des notifications
// (cochée d'office, comme avant). Le compte existe déjà : si le client ferme le site avant de finir, ces questions reviennent (store/signupStepStore).
import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { supabase } from '../lib/supabase';
import { colors, fonts, spacing, accountField, accountFieldPlaceholder } from '../theme';
import { useAuthStore } from '../store/authStore';
import { useToastStore } from '../store/toastStore';
import { useSignupStepStore } from '../store/signupStepStore';
import { navigationRef } from '../navigation/navigationRef';
import { GoldButton } from './GoldButton';
import { CityPicker } from './CityPicker';
import { GenderPicker } from './GenderPicker';
import { MaritalPicker } from './MaritalPicker';
import { hasGenderColumn, type Gender } from '../lib/clientGender';
import { BIRTH_EXAMPLE, checkBirthMarital, formatBirthInput, hasBirthColumn, hasMaritalColumn, type MaritalStatus } from '../lib/clientBirthMarital';
import { isValidEmail, phoneDigits } from '../lib/phoneAuth';
import { isMissingColumn } from '../lib/dbErrors';
import { installAfterSignUpDue, markInstallPageShown } from '../lib/installAfterSignUp';
import { stepTwoMissing } from '../lib/entryScreen';

const LOGO = require('../../assets/logo.jpg');

export function SignupStepTwo() {
  const profile = useAuthStore((s) => s.profile);
  const refreshProfile = useAuthStore((s) => s.refreshProfile);
  const disarm = useSignupStepStore((s) => s.disarm);
  const showToast = useToastStore((s) => s.show);
  const [gender, setGender] = useState<'' | Gender>('');
  const [birthDate, setBirthDate] = useState('');
  const [marital, setMarital] = useState<'' | MaritalStatus>('');
  const [email, setEmail] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [profession, setProfession] = useState('');
  const [region, setRegion] = useState('');
  const [country, setCountry] = useState('Tchad');
  const [address, setAddress] = useState('');
  const [acceptsNotifications, setAcceptsNotifications] = useState(true);
  const [loading, setLoading] = useState(false);

  // le profil est là et rien ne manque (ancien reste sur le téléphone, ou colonnes pas encore lancées) : plus rien à demander
  useEffect(() => {
    if (profile && !stepTwoMissing(profile)) disarm();
  }, [profile, disarm]);

  const showGender = hasGenderColumn(profile);
  const showBirth = hasBirthColumn(profile);
  const showMarital = hasMaritalColumn(profile);

  const finish = async () => {
    if (!profile) return;
    if (showGender && !gender) {
      showToast('Merci de choisir « Homme » ou « Femme ».', { title: 'Choix manquant', type: 'error' });
      return;
    }
    let birthIso: string | undefined;
    let maritalValue: MaritalStatus | undefined;
    if (showBirth || showMarital) {
      const extras = checkBirthMarital({ birth: showBirth ? birthDate : BIRTH_EXAMPLE, marital: showMarital ? marital : 'celibataire' }, Date.now());
      if (!extras.ok) {
        showToast(extras.message, { title: extras.title, type: 'error' });
        return;
      }
      if (showBirth) birthIso = extras.birthDate;
      if (showMarital) maritalValue = extras.marital;
    }
    if (email.trim() && !isValidEmail(email)) {
      showToast('Merci de saisir une adresse e-mail valide, ou laissez la case vide.', { title: 'E-mail invalide', type: 'error' });
      return;
    }
    if (whatsappNumber.trim() && !phoneDigits(whatsappNumber)) {
      showToast('Merci de saisir un numéro WhatsApp valide (8 à 15 chiffres).', { title: 'Numéro WhatsApp invalide', type: 'error' });
      return;
    }
    setLoading(true);
    // même enregistrement que l'inscription complète : les infos de base d'abord, puis le genre, puis la naissance et la situation (demandes à part :
    // une colonne pas encore créée dans la base ne fait jamais échouer le reste)
    const core = await supabase
      .from('profiles')
      .update({
        whatsapp_number: whatsappNumber.trim() || profile.phone || null,
        profession: profession.trim() || null,
        ...(email.trim() ? { email: email.trim() } : {}),
        region: region || null,
        country: country || null,
        address: address || null,
        notify_new_products: acceptsNotifications,
        notify_promotions: acceptsNotifications,
        notify_flash_sale: acceptsNotifications,
      })
      .eq('id', profile.id);
    if (core.error) {
      setLoading(false);
      showToast("Vos réponses n'ont pas pu être enregistrées. Vérifiez votre connexion et réessayez.", { title: 'Enregistrement impossible', type: 'error' });
      return;
    }
    if (showGender && gender) {
      const { error } = await supabase.from('profiles').update({ gender }).eq('id', profile.id);
      if (error && !isMissingColumn(error, 'gender')) {
        setLoading(false);
        showToast("Votre réponse n'a pas pu être enregistrée. Réessayez dans un instant.", { title: 'Enregistrement impossible', type: 'error' });
        return;
      }
    }
    if (birthIso || maritalValue) {
      const { error } = await supabase
        .from('profiles')
        .update({ ...(birthIso ? { birth_date: birthIso } : {}), ...(maritalValue ? { marital_status: maritalValue } : {}) })
        .eq('id', profile.id);
      if (error && !isMissingColumn(error, 'birth_date') && !isMissingColumn(error, 'marital_status')) {
        setLoading(false);
        showToast("Vos réponses n'ont pas pu être enregistrées. Réessayez dans un instant.", { title: 'Enregistrement impossible', type: 'error' });
        return;
      }
    }
    await refreshProfile();
    setLoading(false);
    disarm();
    showToast('Votre compte est complet.', { title: 'Bienvenue ✓', type: 'success' });
    // téléphone sans le raccourci : la page d'installation (une seule fois), comme après l'ancienne inscription
    if (installAfterSignUpDue()) {
      markInstallPageShown();
      setTimeout(() => {
        if (navigationRef.isReady()) navigationRef.navigate('Install');
      }, 800);
    }
  };

  if (!profile) {
    return (
      <View style={styles.cover} testID="signup-step2-loading">
        <ActivityIndicator color={colors.gold} style={{ marginTop: 120 }} />
      </View>
    );
  }
  if (!stepTwoMissing(profile)) return null;

  return (
    <View style={styles.cover} testID="signup-step2">
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Image source={LOGO} style={styles.logo} contentFit="cover" />
        <Text style={styles.brand}>ALBASSE SHOPPING</Text>
        <Text style={styles.title}>Dernière étape 🎉</Text>
        <Text style={styles.text}>Votre compte est créé. Encore 3 petites questions pour vous proposer les bons articles.</Text>
        <View style={styles.block}>
          <Text style={styles.sectionLabel}>Créer mon compte · étape 2 sur 2</Text>
          {showGender && (
            <>
              <Text style={styles.fieldLabel}>Vous êtes * </Text>
              <GenderPicker value={gender} onChange={setGender} testIDPrefix="step2-gender" light />
            </>
          )}
          {showBirth && (
            <>
              <Text style={styles.fieldLabel}>🎂 Date de naissance * </Text>
              <TextInput
                testID="step2-birth"
                autoComplete="birthdate-full"
                value={birthDate}
                onChangeText={(v) => setBirthDate(formatBirthInput(v))}
                placeholder={`Jour / mois / année (ex. ${BIRTH_EXAMPLE})`}
                placeholderTextColor={accountFieldPlaceholder}
                keyboardType="number-pad"
                maxLength={10}
                style={accountField}
              />
            </>
          )}
          {showMarital && (
            <>
              <Text style={styles.fieldLabel}>💍 Situation * </Text>
              <MaritalPicker value={marital} onChange={setMarital} testIDPrefix="step2-marital" light />
            </>
          )}

          <Text style={styles.sectionLabel}>Informations optionnelles</Text>
          <TextInput
            testID="step2-email"
            autoComplete="email"
            value={email}
            onChangeText={setEmail}
            placeholder="E-mail (facultatif)"
            placeholderTextColor={accountFieldPlaceholder}
            autoCapitalize="none"
            keyboardType="email-address"
            style={accountField}
          />
          <TextInput value={whatsappNumber} onChangeText={setWhatsappNumber} placeholder="Numéro WhatsApp (si différent du téléphone)" placeholderTextColor={accountFieldPlaceholder} keyboardType="phone-pad" style={accountField} />
          <TextInput value={profession} onChangeText={setProfession} placeholder="Profession" placeholderTextColor={accountFieldPlaceholder} style={accountField} />
          <Text style={styles.fieldLabel}>📍 Ville</Text>
          <CityPicker value={region} onChange={(v) => setRegion(v)} light />
          <TextInput value={country} onChangeText={setCountry} placeholder="Pays" placeholderTextColor={accountFieldPlaceholder} style={accountField} />
          <TextInput value={address} onChangeText={setAddress} placeholder="Adresse" placeholderTextColor={accountFieldPlaceholder} style={accountField} />

          <Pressable testID="step2-notifications" style={styles.checkboxRow} onPress={() => setAcceptsNotifications((v) => !v)}>
            <View style={[styles.checkbox, acceptsNotifications && styles.checkboxChecked]}>{acceptsNotifications && <Text style={styles.checkboxMark}>✓</Text>}</View>
            <Text style={styles.checkboxLabel}>Je souhaite recevoir les notifications concernant les nouveaux produits et offres d'ALBASSE SHOPPING.</Text>
          </Pressable>
          <Text style={styles.checkboxHint}>Modifiable à tout moment dans Mon compte → Notifications.</Text>
          <GoldButton label="Terminer" onPress={finish} loading={loading} style={{ marginTop: spacing.md }} testID="step2-submit" />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  cover: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.background, zIndex: 50 },
  content: { flexGrow: 1, alignItems: 'center', padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  logo: { width: 76, height: 76, borderRadius: 38, marginBottom: spacing.sm, borderWidth: 2, borderColor: colors.gold },
  brand: { fontFamily: fonts.display, fontSize: 22, color: colors.goldLight, letterSpacing: 1, marginBottom: spacing.md },
  title: { fontFamily: fonts.bodyBold, fontSize: 22, color: colors.cream, marginBottom: 4 },
  text: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.creamMuted, textAlign: 'center', maxWidth: 360 },
  block: { width: '100%', maxWidth: 420, marginTop: spacing.lg },
  sectionLabel: { color: colors.creamMuted, fontFamily: fonts.bodySemiBold, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.sm, marginTop: spacing.md },
  fieldLabel: { color: colors.creamMuted, fontFamily: fonts.bodyMedium, fontSize: 12, marginBottom: 6 },
  checkboxRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: spacing.md },
  checkbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: colors.gold, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  checkboxChecked: { backgroundColor: colors.gold },
  checkboxMark: { color: colors.background, fontFamily: fonts.bodyBold, fontSize: 13 },
  checkboxLabel: { flex: 1, color: colors.cream, fontFamily: fonts.body, fontSize: 12, lineHeight: 17 },
  checkboxHint: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 10, marginTop: 4, marginLeft: 30 },
});
