// Le petit sondage du site (docs/sondage-client.md) : à la création du compte on ne demande que le nom, le téléphone et le mot de passe ; le reste est demandé ICI,
// dans une petite carte sur l'accueil (pas une fenêtre : elle ne gêne jamais la fenêtre « Télécharge l'app »). Une question à la fois, chaque réponse enregistrée tout
// de suite, « Plus tard » toujours possible : la carte revient 3 jours après, trois fois au plus (lib/clientSurvey). Rien n'est jamais deviné ni coché à la place du client.
// Questions : Homme / Femme, date de naissance, célibataire / marié, numéro WhatsApp, accord pour les nouveautés et offres. Cachée pour l'équipe, pour un client qui a
// tout répondu, et pour les colonnes que la base n'a pas encore (scripts SQL pas lancés).
import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, TextInput, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, fonts, radius, spacing } from '../theme';
import { useAuthStore } from '../store/authStore';
import { useToastStore } from '../store/toastStore';
import { GenderPicker } from './GenderPicker';
import { MaritalPicker } from './MaritalPicker';
import type { Gender } from '../lib/clientGender';
import { BIRTH_EXAMPLE, formatBirthInput, type MaritalStatus } from '../lib/clientBirthMarital';
import {
  NOTIFICATIONS_ON,
  NO_LOCAL,
  checkSurveyBirth,
  checkSurveyWhatsapp,
  parseAskState,
  parseSurveyLocal,
  surveyAskDue,
  surveyPending,
  surveyProgress,
  type SurveyLocal,
} from '../lib/clientSurvey';

const ASK_KEY = 'albasse_survey_ask_v1_';
const LOCAL_KEY = 'albasse_survey_local_v1_';
// comptes pour lesquels la carte a déjà été montrée pendant cette visite (même si le téléphone refuse de garder la date) : jamais deux fois de suite
const shownThisVisit = new Set<string>();

export function SurveyCard() {
  const profile = useAuthStore((s) => s.profile);
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const showToast = useToastStore((s) => s.show);
  const [open, setOpen] = useState(false);
  const [total, setTotal] = useState(0); // les questions qui restaient à l'ouverture de la carte (« Question 2 sur 4 »)
  const [local, setLocal] = useState<SurveyLocal>(NO_LOCAL);
  const [saving, setSaving] = useState(false);
  const [birth, setBirth] = useState('');
  const [otherNumber, setOtherNumber] = useState(false);
  const [whatsapp, setWhatsapp] = useState('');

  const profileId = profile?.id ?? null;
  useEffect(() => {
    if (!profile || !profileId || shownThisVisit.has(profileId)) return;
    let alive = true;
    const askKey = ASK_KEY + profileId;
    const localKey = LOCAL_KEY + profileId;
    Promise.all([AsyncStorage.getItem(askKey).catch(() => null), AsyncStorage.getItem(localKey).catch(() => null)]).then(([askRaw, localRaw]) => {
      if (!alive) return;
      const state = parseAskState(askRaw);
      const kept = parseSurveyLocal(localRaw);
      const now = Date.now();
      if (!surveyAskDue(profile, kept, state, now)) return;
      shownThisVisit.add(profileId);
      AsyncStorage.setItem(askKey, JSON.stringify({ count: state.count + 1, last: now })).catch(() => {});
      setLocal(kept);
      setTotal(surveyPending(profile, kept).length);
      setOpen(true);
    });
    return () => {
      alive = false;
    };
    // seulement quand le compte change : les réponses faites ensuite ne relancent jamais la demande
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId]);

  const pending = surveyPending(profile, local);
  const current = pending[0];
  if (!open || !profile || !current) return null;

  const remember = (patch: Partial<SurveyLocal>) => {
    const next = { ...local, ...patch };
    setLocal(next);
    AsyncStorage.setItem(LOCAL_KEY + profile.id, JSON.stringify(next)).catch(() => {});
    return next;
  };
  const thanks = (remaining: number) => {
    if (remaining > 0) return;
    setOpen(false);
    showToast('Merci, c’est noté. Zara vous conseillera mieux.', { title: 'Merci ✓', type: 'success' });
  };
  // enregistre une réponse dans le profil ; à la dernière question, la carte se ferme avec un remerciement
  const save = async (changes: Parameters<typeof updateProfile>[0]): Promise<boolean> => {
    if (saving) return false;
    setSaving(true);
    const { error } = await updateProfile(changes);
    setSaving(false);
    if (error) {
      showToast(error, { title: 'Enregistrement impossible', type: 'error' });
      return false;
    }
    thanks(pending.length - 1);
    return true;
  };

  const answerGender = (gender: Gender) => void save({ gender });
  const answerMarital = (marital: MaritalStatus) => void save({ marital_status: marital });
  const answerBirth = async () => {
    const check = checkSurveyBirth(birth, Date.now());
    if (!check.ok) {
      showToast(check.message, { title: check.title, type: 'error' });
      return;
    }
    if (await save({ birth_date: check.value })) setBirth('');
  };
  const answerWhatsappSame = () => {
    remember({ whatsappDone: true });
    thanks(pending.length - 1);
  };
  const answerWhatsappOther = async () => {
    const check = checkSurveyWhatsapp(whatsapp);
    if (!check.ok) {
      showToast(check.message, { title: check.title, type: 'error' });
      return;
    }
    if (await save({ whatsapp_number: check.value })) {
      remember({ whatsappDone: true });
      setOtherNumber(false);
      setWhatsapp('');
    }
  };
  const answerNotifications = async (yes: boolean) => {
    if (yes) {
      if (await save({ ...NOTIFICATIONS_ON })) remember({ notificationsDone: true });
      return;
    }
    remember({ notificationsDone: true });
    thanks(pending.length - 1);
  };

  const progress = surveyProgress(total, pending.length);

  return (
    <View style={styles.card} testID="survey-card">
      <Text style={styles.title}>✨ Zara : un petit sondage</Text>
      <Text style={styles.step} testID="survey-step">
        Question {progress.index} sur {progress.total}
      </Text>

      {current === 'gender' && (
        <View testID="survey-q-gender">
          <Text style={styles.text}>Pour mieux vous conseiller, vous êtes…</Text>
          <GenderPicker value="" onChange={answerGender} testIDPrefix="survey-gender" disabled={saving} />
        </View>
      )}

      {current === 'birth' && (
        <View testID="survey-q-birth">
          <Text style={styles.text}>🎂 Quelle est votre date de naissance ?</Text>
          <TextInput
            testID="survey-birth"
            autoComplete="birthdate-full"
            value={birth}
            onChangeText={(v) => setBirth(formatBirthInput(v))}
            placeholder={`Jour / mois / année (ex. ${BIRTH_EXAMPLE})`}
            placeholderTextColor={colors.creamFaint}
            keyboardType="number-pad"
            maxLength={10}
            style={styles.input}
          />
          <Pressable testID="survey-birth-submit" onPress={answerBirth} disabled={saving} style={[styles.primary, saving && { opacity: 0.6 }]}>
            <Text style={styles.primaryText}>Valider</Text>
          </Pressable>
        </View>
      )}

      {current === 'marital' && (
        <View testID="survey-q-marital">
          <Text style={styles.text}>💍 Quelle est votre situation ?</Text>
          <MaritalPicker value="" onChange={answerMarital} testIDPrefix="survey-marital" disabled={saving} />
        </View>
      )}

      {current === 'whatsapp' && (
        <View testID="survey-q-whatsapp">
          <Text style={styles.text}>💬 Votre numéro WhatsApp est-il le même que votre téléphone ?</Text>
          {profile.phone ? <Text style={styles.hint}>Votre téléphone : {profile.phone}</Text> : null}
          {!otherNumber ? (
            <View style={styles.row}>
              <Pressable testID="survey-whatsapp-same" onPress={answerWhatsappSame} disabled={saving} style={styles.choice}>
                <Text style={styles.choiceText}>Oui, le même</Text>
              </Pressable>
              <Pressable testID="survey-whatsapp-other" onPress={() => setOtherNumber(true)} disabled={saving} style={styles.choice}>
                <Text style={styles.choiceText}>Un autre numéro</Text>
              </Pressable>
            </View>
          ) : (
            <View>
              <TextInput
                testID="survey-whatsapp-input"
                value={whatsapp}
                onChangeText={setWhatsapp}
                placeholder="Votre numéro WhatsApp (ex. 99 22 10 17)"
                placeholderTextColor={colors.creamFaint}
                keyboardType="phone-pad"
                style={styles.input}
              />
              <Pressable testID="survey-whatsapp-submit" onPress={answerWhatsappOther} disabled={saving} style={[styles.primary, saving && { opacity: 0.6 }]}>
                <Text style={styles.primaryText}>Valider</Text>
              </Pressable>
            </View>
          )}
        </View>
      )}

      {current === 'notifications' && (
        <View testID="survey-q-notifications">
          <Text style={styles.text}>🔔 Voulez-vous recevoir les nouveautés et les offres d’Albasse Shopping ?</Text>
          <View style={styles.row}>
            <Pressable testID="survey-notifications-yes" onPress={() => void answerNotifications(true)} disabled={saving} style={styles.choice}>
              <Text style={styles.choiceText}>Oui, avec plaisir</Text>
            </Pressable>
            <Pressable testID="survey-notifications-no" onPress={() => void answerNotifications(false)} disabled={saving} style={styles.choice}>
              <Text style={styles.choiceText}>Non merci</Text>
            </Pressable>
          </View>
          <Text style={styles.hint}>Modifiable à tout moment dans Mon compte → Notifications.</Text>
        </View>
      )}

      <Pressable testID="survey-later" onPress={() => setOpen(false)} disabled={saving} style={styles.later}>
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
  title: { color: colors.goldLight, fontFamily: fonts.bodySemiBold, fontSize: 14, marginBottom: 2 },
  step: { color: colors.creamFaint, fontFamily: fonts.bodyMedium, fontSize: 11, marginBottom: spacing.sm },
  text: { color: colors.cream, fontFamily: fonts.body, fontSize: 13, marginBottom: spacing.sm },
  hint: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 11, marginBottom: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm, marginBottom: 8 },
  choice: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.panel,
  },
  choiceText: { color: colors.cream, fontFamily: fonts.bodySemiBold, fontSize: 14, textAlign: 'center' },
  input: {
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.cream,
    fontFamily: fonts.body,
    fontSize: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginBottom: spacing.sm,
  },
  primary: { backgroundColor: colors.gold, borderRadius: radius.md, alignItems: 'center', paddingVertical: 12, marginBottom: 4 },
  primaryText: { color: colors.background, fontFamily: fonts.bodyBold, fontSize: 14 },
  later: { alignSelf: 'center', paddingVertical: 4, paddingHorizontal: spacing.md },
  laterText: { color: colors.creamFaint, fontFamily: fonts.bodyMedium, fontSize: 12 },
});
