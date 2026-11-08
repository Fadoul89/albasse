// Admin › Clients › fiche d'un client › « 🛠️ Gérer le compte » (docs/gestion-de-compte.md) :
//   ✏️ Modifier la fiche · 📱 Changer le numéro de connexion (ou ✉️ l'e-mail d'un ancien compte) · 🔒 Fermer le compte (commandes gardées) · 🗑️ Supprimer pour de bon (sans commande)
// + le journal des actions. Chaque action demande une confirmation claire ; rien ne part sans elle. Les règles sont dans lib/clientAccount.ts.
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { colors, fonts, radius, spacing } from '../theme';
import { useToastStore } from '../store/toastStore';
import { GoldButton } from './GoldButton';
import { visibleEmail } from '../lib/phoneAuth';
import { formatClientNumber } from '../lib/clientNumber';
import {
  EDIT_LABELS,
  buildChanges,
  canDelete,
  deleteConfirmWord,
  editableFields,
  initialForm,
  isClosedEmail,
  loginLabel,
  logLine,
  type AccountInfo,
  type EditForm,
  type EditKey,
  type ProfileLike,
} from '../lib/clientAccount';
import { fetchAccountInfo, fetchAccountLog, runAccountAction, saveProfile, type LogRow } from '../lib/clientAccountApi';

interface Props {
  profile: ProfileLike & { id: string; client_number?: number | null };
  // la fiche a changé : l'écran relit le client
  onChanged: () => void;
  // le compte n'existe plus : l'écran revient à la liste
  onDeleted: () => void;
}
type Panel = null | 'edit' | 'login' | 'close' | 'delete';

const formatDateTime = (iso: string) => new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export function AdminAccountManager({ profile, onChanged, onDeleted }: Props) {
  const showToast = useToastStore((s) => s.show);
  const [info, setInfo] = useState<AccountInfo | null>(null);
  const [problem, setProblem] = useState<string | null>(null); // la base ne répond pas (script pas lancé, panne)
  const [log, setLog] = useState<LogRow[]>([]);
  const [panel, setPanel] = useState<Panel>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<EditForm>(() => initialForm(profile));
  const [loginValue, setLoginValue] = useState('');
  const [reason, setReason] = useState('');
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    const r = await fetchAccountInfo(profile.id);
    if (r.ok) {
      setInfo(r.value);
      setProblem(null);
    } else {
      setInfo(null);
      setProblem(r.message);
    }
    setLog(await fetchAccountLog(profile.id));
  }, [profile.id]);

  useEffect(() => {
    void load();
  }, [load]);
  // la fiche relue (après une modification) : le formulaire repart des vraies valeurs
  useEffect(() => {
    setForm(initialForm(profile));
  }, [profile.full_name, profile.phone, profile.whatsapp_number, profile.email, profile.region, profile.country, profile.address, profile.profession]);

  const number = formatClientNumber(profile.client_number);
  const closed = info?.loginKind === 'closed' || isClosedEmail(profile.email);
  const close = () => {
    setPanel(null);
    setLoginValue('');
    setReason('');
    setConfirm('');
  };
  const open = (p: Panel) => {
    setMessage(null);
    setConfirm('');
    setPanel(panel === p ? null : p);
  };
  const done = (text: string, title: string) => {
    setMessage({ ok: true, text });
    showToast(text, { title, type: 'success' });
    close();
  };
  const fail = (text: string) => {
    setMessage({ ok: false, text });
    showToast(text, { title: 'Rien n’a été fait', type: 'error' });
  };

  const saveEdit = async () => {
    if (!info) return;
    const { changes, problem: bad } = buildChanges(initialForm(profile), form, info.loginKind);
    if (bad) return fail(bad);
    setBusy(true);
    const r = await saveProfile(profile.id, changes);
    setBusy(false);
    if (!r.ok) return fail(r.message);
    done('La fiche du client est à jour.', 'Fiche modifiée ✓');
    onChanged();
    void load();
  };

  const changeLogin = async () => {
    if (!info) return;
    setBusy(true);
    const r = await runAccountAction({ action: 'change_login', userId: profile.id, value: loginValue });
    setBusy(false);
    if (!r.ok) return fail(r.message);
    done(info.loginKind === 'phone' ? 'Le client se connecte maintenant avec son nouveau numéro, et le même mot de passe.' : 'Le client se connecte maintenant avec son nouvel e-mail, et le même mot de passe.', 'Connexion changée ✓');
    onChanged();
    void load();
  };

  const closeAccount = async () => {
    setBusy(true);
    const r = await runAccountAction({ action: 'close', userId: profile.id, reason, confirm });
    setBusy(false);
    if (!r.ok) return fail(r.message);
    done('Le compte est fermé. Les commandes sont gardées.', 'Compte fermé 🔒');
    onChanged();
    void load();
  };

  const deleteAccount = async () => {
    setBusy(true);
    const r = await runAccountAction({ action: 'delete', userId: profile.id, confirm });
    setBusy(false);
    if (!r.ok) return fail(r.message);
    showToast('Le compte a été supprimé pour de bon.', { title: 'Compte supprimé 🗑️', type: 'success' });
    onDeleted();
  };

  const fields = info ? editableFields(info.loginKind) : [];
  const delCheck = info ? canDelete(info) : { ok: false, why: null };
  const word = deleteConfirmWord(profile.client_number, profile.id);
  const isPhoneLogin = info?.loginKind === 'phone';

  return (
    <View style={styles.wrap} testID="admin-account-section">
      <Text style={styles.title}>🛠️ Gérer le compte</Text>
      {problem ? (
        <Text style={styles.warn} testID="admin-account-problem">{problem}</Text>
      ) : !info ? (
        <Text style={styles.small}>Lecture…</Text>
      ) : (
        <>
          <Text style={styles.line} testID="admin-account-login">Connexion : {loginLabel(info)}</Text>
          <Text style={styles.line} testID="admin-account-orders">
            Commandes : {info.orders}
            {number ? ` · Numéro client : ${number}` : ''}
          </Text>

          {message ? (
            <Text style={[styles.msg, message.ok ? styles.msgOk : styles.msgBad]} testID="admin-account-message">
              {message.text}
            </Text>
          ) : null}

          {info.isAdmin ? (
            <Text style={styles.small} testID="admin-account-isadmin">Un compte administrateur ne se gère pas ici.</Text>
          ) : closed ? (
            <Text style={styles.small} testID="admin-account-closed">Ce compte est fermé : plus de modification possible. Le nom et les coordonnées sont effacés ; les commandes sont gardées.</Text>
          ) : (
            <View style={styles.buttons}>
              <Pressable style={[styles.btn, panel === 'edit' && styles.btnOn]} onPress={() => open('edit')} testID="admin-account-edit-open" accessibilityRole="button">
                <Text style={styles.btnText}>✏️ Modifier la fiche</Text>
              </Pressable>
              <Pressable style={[styles.btn, panel === 'login' && styles.btnOn]} onPress={() => open('login')} testID="admin-account-login-open" accessibilityRole="button">
                <Text style={styles.btnText}>{isPhoneLogin ? '📱 Changer le numéro de connexion' : '✉️ Changer l’e-mail de connexion'}</Text>
              </Pressable>
              <Pressable style={[styles.btn, styles.btnWarn, panel === 'close' && styles.btnOn]} onPress={() => open('close')} testID="admin-account-close-open" accessibilityRole="button">
                <Text style={styles.btnText}>🔒 Fermer le compte</Text>
              </Pressable>
              <Pressable style={[styles.btn, styles.btnDanger, panel === 'delete' && styles.btnOn]} onPress={() => open('delete')} testID="admin-account-delete-open" accessibilityRole="button">
                <Text style={styles.btnText}>🗑️ Supprimer pour de bon</Text>
              </Pressable>
            </View>
          )}

          {panel === 'edit' ? (
            <View style={styles.panel} testID="admin-account-edit">
              {fields.map((key: EditKey) => (
                <View key={key}>
                  <Text style={styles.label}>
                    {EDIT_LABELS[key]}
                    {key === 'email' ? ' (facultatif)' : ''}
                  </Text>
                  <TextInput
                    testID={`admin-account-field-${key}`}
                    value={form[key]}
                    onChangeText={(v) => setForm((f) => ({ ...f, [key]: v }))}
                    placeholderTextColor={colors.creamFaint}
                    autoCapitalize={key === 'email' ? 'none' : 'sentences'}
                    keyboardType={key === 'phone' || key === 'whatsapp_number' ? 'phone-pad' : key === 'email' ? 'email-address' : 'default'}
                    style={styles.input}
                  />
                </View>
              ))}
              {isPhoneLogin ? <Text style={styles.small}>Le téléphone de connexion se change avec « Changer le numéro de connexion ».</Text> : <Text style={styles.small}>L’e-mail de connexion se change avec « Changer l’e-mail de connexion ».</Text>}
              <GoldButton label="Enregistrer la fiche" onPress={saveEdit} loading={busy} style={{ marginTop: spacing.sm }} testID="admin-account-edit-save" />
              <Pressable onPress={close} testID="admin-account-cancel"><Text style={styles.cancel}>Annuler</Text></Pressable>
            </View>
          ) : null}

          {panel === 'login' ? (
            <View style={styles.panel} testID="admin-account-login-panel">
              <Text style={styles.text}>
                {isPhoneLogin
                  ? 'Le client se connectera avec le NOUVEAU numéro et son mot de passe actuel. L’ancien numéro ne marchera plus. Utile quand il a perdu ou changé de téléphone.'
                  : 'Le client se connectera avec le NOUVEL e-mail et son mot de passe actuel. L’ancien e-mail ne marchera plus.'}
              </Text>
              <Text style={styles.label}>{isPhoneLogin ? 'Nouveau numéro de téléphone' : 'Nouvel e-mail'}</Text>
              <TextInput
                testID="admin-account-login-input"
                value={loginValue}
                onChangeText={setLoginValue}
                placeholder={isPhoneLogin ? 'ex. 66 12 34 56' : 'ex. client@gmail.com'}
                placeholderTextColor={colors.creamFaint}
                autoCapitalize="none"
                keyboardType={isPhoneLogin ? 'phone-pad' : 'email-address'}
                style={styles.input}
              />
              <GoldButton label="Changer la connexion" onPress={changeLogin} loading={busy} disabled={!loginValue.trim()} style={{ marginTop: spacing.sm }} testID="admin-account-login-confirm" />
              <Pressable onPress={close} testID="admin-account-cancel"><Text style={styles.cancel}>Annuler</Text></Pressable>
            </View>
          ) : null}

          {panel === 'close' ? (
            <View style={styles.panel} testID="admin-account-close-panel">
              <Text style={styles.text}>Fermer ce compte :</Text>
              <Text style={styles.bullet}>• le nom, le téléphone, le WhatsApp, l’adresse et la photo sont effacés ;</Text>
              <Text style={styles.bullet}>• le client ne peut plus se connecter (mot de passe annulé) ;</Text>
              <Text style={styles.bullet}>• ses {info.orders} commande{info.orders > 1 ? 's' : ''} sont GARDÉE{info.orders > 1 ? 'S' : ''} pour votre comptabilité ;</Text>
              <Text style={styles.bullet}>• son numéro de téléphone est libéré : il pourra se réinscrire avec un nouveau compte.</Text>
              <Text style={styles.warn}>Cela ne peut pas être annulé.</Text>
              <Text style={styles.label}>Motif (facultatif)</Text>
              <TextInput testID="admin-account-reason" value={reason} onChangeText={setReason} placeholder="ex. téléphone volé, doublon…" placeholderTextColor={colors.creamFaint} style={styles.input} maxLength={200} />
              <Text style={styles.label}>Pour confirmer, tapez FERMER</Text>
              <TextInput testID="admin-account-close-confirm-input" value={confirm} onChangeText={setConfirm} autoCapitalize="characters" placeholder="FERMER" placeholderTextColor={colors.creamFaint} style={styles.input} />
              <GoldButton label="Fermer le compte" onPress={closeAccount} loading={busy} disabled={confirm.trim().toUpperCase() !== 'FERMER'} style={{ marginTop: spacing.sm }} testID="admin-account-close-confirm" />
              <Pressable onPress={close} testID="admin-account-cancel"><Text style={styles.cancel}>Annuler</Text></Pressable>
            </View>
          ) : null}

          {panel === 'delete' ? (
            <View style={styles.panel} testID="admin-account-delete-panel">
              {delCheck.ok ? (
                <>
                  <Text style={styles.text}>Supprimer pour de bon ce compte sans aucune commande : il disparaît complètement (favoris, messages, historique). Cela ne peut pas être annulé.</Text>
                  <Text style={styles.label}>Pour confirmer, tapez {word}</Text>
                  <TextInput testID="admin-account-delete-confirm-input" value={confirm} onChangeText={setConfirm} autoCapitalize="characters" placeholder={word} placeholderTextColor={colors.creamFaint} style={styles.input} />
                  <GoldButton label="Supprimer pour de bon" onPress={deleteAccount} loading={busy} disabled={confirm.trim().toUpperCase() !== word.toUpperCase()} style={{ marginTop: spacing.sm }} testID="admin-account-delete-confirm" />
                </>
              ) : (
                <Text style={styles.warn} testID="admin-account-delete-refused">{delCheck.why}</Text>
              )}
              <Pressable onPress={close} testID="admin-account-cancel"><Text style={styles.cancel}>Annuler</Text></Pressable>
            </View>
          ) : null}

          {log.length > 0 ? (
            <View style={styles.logBox} testID="admin-account-log">
              <Text style={styles.label}>📜 Journal des actions</Text>
              {log.map((r) => (
                <Text key={r.id} style={styles.logLine}>
                  {formatDateTime(r.created_at)} · {logLine(r.action, r.detail)}
                  {r.adminName ? ` · par ${r.adminName}` : ''}
                </Text>
              ))}
            </View>
          ) : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: colors.panel, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.md },
  title: { color: colors.goldLight, fontFamily: fonts.bodyBold, fontSize: 14, marginBottom: spacing.sm },
  line: { color: colors.cream, fontFamily: fonts.bodyMedium, fontSize: 13, marginBottom: 2 },
  small: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 12, lineHeight: 17, marginTop: 6 },
  text: { color: colors.creamMuted, fontFamily: fonts.body, fontSize: 13, lineHeight: 19, marginBottom: 6 },
  bullet: { color: colors.creamMuted, fontFamily: fonts.body, fontSize: 12.5, lineHeight: 18 },
  warn: { color: '#f87171', fontFamily: fonts.bodySemiBold, fontSize: 12.5, lineHeight: 18, marginTop: 6 },
  msg: { fontFamily: fonts.bodySemiBold, fontSize: 12.5, marginTop: 6, lineHeight: 18 },
  msgOk: { color: '#25D366' },
  msgBad: { color: '#f87171' },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: spacing.sm },
  btn: { borderWidth: 1, borderColor: colors.gold, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 9 },
  btnWarn: { borderColor: '#f59e0b' },
  btnDanger: { borderColor: '#f87171' },
  btnOn: { backgroundColor: colors.panelAlt },
  btnText: { color: colors.cream, fontFamily: fonts.bodySemiBold, fontSize: 12.5 },
  panel: { backgroundColor: colors.panelAlt, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.sm },
  label: { color: colors.creamMuted, fontFamily: fonts.bodySemiBold, fontSize: 12, marginTop: 8, marginBottom: 4 },
  input: { backgroundColor: colors.panel, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, color: colors.cream, fontFamily: fonts.body, fontSize: 14, paddingHorizontal: 12, paddingVertical: 10 },
  cancel: { color: colors.creamFaint, fontFamily: fonts.bodyMedium, fontSize: 13, textAlign: 'center', paddingVertical: 10 },
  logBox: { marginTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: spacing.sm },
  logLine: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 11.5, lineHeight: 17, marginTop: 3 },
});
