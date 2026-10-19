// Connexion avec le numéro de téléphone (ou l'e-mail des anciens comptes) et « Se souvenir de mon mot de passe » (lib/rememberLogin).
// Sur la page Connexion et en haut de l'écran d'entrée « compte obligatoire ».
import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable } from 'react-native';
import { colors, fonts, radius, spacing } from '../theme';
import { useAuthStore } from '../store/authStore';
import { useToastStore } from '../store/toastStore';
import { isSupabaseConfigured } from '../lib/supabase';
import { rememberLogin, rememberedIdentifier } from '../lib/rememberLogin';
import { GoldButton } from './GoldButton';

export function LoginForm({ onSuccess, onForgot }: { onSuccess: () => void; onForgot: () => void }) {
  const signIn = useAuthStore((s) => s.signIn);
  const showToast = useToastStore((s) => s.show);
  const [identifier, setIdentifier] = useState(rememberedIdentifier);
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!isSupabaseConfigured) {
      showToast(
        "Ajoutez EXPO_PUBLIC_SUPABASE_URL et EXPO_PUBLIC_SUPABASE_ANON_KEY dans .env pour activer les comptes.",
        { title: 'Supabase non configuré', type: 'error' }
      );
      return;
    }
    if (!identifier.trim() || !password) {
      showToast('Entrez votre numéro de téléphone (ou e-mail) et votre mot de passe.', { title: 'Champs manquants', type: 'error' });
      return;
    }
    setLoading(true);
    const { error } = await signIn(identifier, password);
    setLoading(false);
    if (error) {
      showToast(error, { title: 'Connexion impossible', type: 'error' });
      return;
    }
    rememberLogin(identifier, remember);
    onSuccess();
  };

  return (
    <View>
      <TextInput
        testID="login-identifier"
        value={identifier}
        onChangeText={setIdentifier}
        placeholder="Numéro de téléphone ou e-mail"
        placeholderTextColor={colors.creamFaint}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete={remember ? 'username' : 'off'}
        textContentType="username"
        style={styles.input}
      />
      <TextInput
        testID="login-password"
        value={password}
        onChangeText={setPassword}
        placeholder="Mot de passe"
        placeholderTextColor={colors.creamFaint}
        secureTextEntry
        autoComplete={remember ? 'current-password' : 'off'}
        textContentType="password"
        onSubmitEditing={handleSubmit}
        style={styles.input}
      />
      <Pressable
        testID="login-remember"
        style={styles.checkboxRow}
        onPress={() => setRemember((v) => !v)}
        role="checkbox"
        aria-checked={remember}
      >
        <View style={[styles.checkbox, remember && styles.checkboxChecked]}>
          {remember && <Text style={styles.checkboxMark}>✓</Text>}
        </View>
        <Text style={styles.checkboxLabel}>Se souvenir de mon mot de passe</Text>
      </Pressable>
      <GoldButton label="Se connecter" onPress={handleSubmit} loading={loading} style={{ marginTop: spacing.md }} />
      <Pressable onPress={onForgot} style={{ marginTop: spacing.md }}>
        <Text style={styles.link}>Mot de passe oublié ?</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
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
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 2 },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: colors.gold },
  checkboxMark: { color: colors.background, fontFamily: fonts.bodyBold, fontSize: 13 },
  checkboxLabel: { color: colors.cream, fontFamily: fonts.body, fontSize: 13 },
  link: { color: colors.gold, fontFamily: fonts.bodyMedium, fontSize: 13, textAlign: 'center' },
});
