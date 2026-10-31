import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable } from 'react-native';
import { colors, fonts, radius, spacing } from '../theme';
import { useAuthStore } from '../store/authStore';
import { useToastStore } from '../store/toastStore';
import { GoldButton } from './GoldButton';
import { changePasswordError, passwordProblem } from '../lib/passwordRecovery';

// « Compte › Changer mon mot de passe » : le client connecté choisit lui-même son mot de passe (par exemple après la commande sans compte,
// quand il n'a pas gardé le code de 6 chiffres). Il est déjà connecté, donc pas besoin de l'ancien code.
export function ChangePasswordCard({ onClose }: { onClose: () => void }) {
  const updatePassword = useAuthStore((s) => s.updatePassword);
  const showToast = useToastStore((s) => s.show);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [visible, setVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const save = async () => {
    const message = passwordProblem(password, confirm);
    if (message) {
      setProblem(message);
      return;
    }
    setProblem(null);
    setSaving(true);
    const { error } = await updatePassword(password);
    setSaving(false);
    if (error) {
      const text = changePasswordError(error);
      setProblem(text);
      showToast(text, { title: 'Changement impossible', type: 'error' });
      return;
    }
    showToast('Votre mot de passe a été changé. Utilisez-le la prochaine fois que vous vous connectez.', { title: 'Mot de passe changé ✓', type: 'success' });
    onClose();
  };

  return (
    <View style={styles.card} testID="password-card">
      <Text style={styles.title}>🔑 Changer mon mot de passe</Text>
      <Text style={styles.help}>Choisissez un mot de passe d’au moins 6 caractères, facile à retenir pour vous. Gardez-le bien.</Text>
      <Text style={styles.label}>Nouveau mot de passe</Text>
      <TextInput
        value={password}
        onChangeText={(t) => {
          setPassword(t);
          setProblem(null);
        }}
        secureTextEntry={!visible}
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="Nouveau mot de passe"
        placeholderTextColor={colors.creamFaint}
        testID="password-input-new"
        style={[styles.input, problem ? styles.inputError : null]}
      />
      <Text style={styles.label}>Écrivez-le encore une fois</Text>
      <TextInput
        value={confirm}
        onChangeText={(t) => {
          setConfirm(t);
          setProblem(null);
        }}
        secureTextEntry={!visible}
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="Même mot de passe"
        placeholderTextColor={colors.creamFaint}
        testID="password-input-confirm"
        style={[styles.input, problem ? styles.inputError : null]}
      />
      <Pressable onPress={() => setVisible((v) => !v)} testID="password-show" style={styles.showRow}>
        <Text style={styles.link}>{visible ? '🙈 Cacher les mots de passe' : '👁️ Voir les mots de passe'}</Text>
      </Pressable>
      {problem ? (
        <Text style={styles.error} testID="password-error">
          {problem}
        </Text>
      ) : null}
      <GoldButton label="Enregistrer le mot de passe" onPress={save} loading={saving} style={{ marginTop: spacing.md }} />
      <GoldButton label="Annuler" onPress={onClose} variant="outline" disabled={saving} style={{ marginTop: spacing.sm }} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.panelAlt,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  title: { color: colors.goldLight, fontFamily: fonts.bodySemiBold, fontSize: 15, marginBottom: 4 },
  help: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 12, lineHeight: 18, marginBottom: spacing.md },
  label: { color: colors.creamMuted, fontFamily: fonts.bodyMedium, fontSize: 12, marginBottom: 6 },
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
  inputError: { borderColor: colors.red },
  showRow: { marginBottom: spacing.xs },
  link: { color: colors.gold, fontFamily: fonts.bodyMedium, fontSize: 12 },
  error: { color: colors.red, fontFamily: fonts.bodyMedium, fontSize: 12, marginTop: 4 },
});
