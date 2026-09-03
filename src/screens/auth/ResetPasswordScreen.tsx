import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { colors, fonts, radius, spacing } from '../../theme';
import { useAuthStore } from '../../store/authStore';
import { useToastStore } from '../../store/toastStore';
import { GoldButton } from '../../components/GoldButton';
import { ScreenHeader } from '../../components/ScreenHeader';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';

export function ResetPasswordScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const updatePassword = useAuthStore((s) => s.updatePassword);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [linkError, setLinkError] = useState(false);
  const showToast = useToastStore((s) => s.show);

  useEffect(() => {
    if (Platform.OS !== 'web' || !isSupabaseConfigured) {
      setLinkError(true);
      return;
    }
    const hash = window.location.hash?.startsWith('#') ? window.location.hash.slice(1) : '';
    const params = new URLSearchParams(hash);
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');

    if (!accessToken || !refreshToken) {
      setLinkError(true);
      return;
    }

    supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken }).then(({ error }) => {
      if (error) {
        setLinkError(true);
      } else {
        setSessionReady(true);
        window.history.replaceState(null, '', window.location.pathname);
      }
    });
  }, []);

  const handleSubmit = async () => {
    if (password.length < 6) {
      showToast('Le mot de passe doit contenir au moins 6 caractères.', { title: 'Mot de passe trop court', type: 'error' });
      return;
    }
    if (password !== confirmPassword) {
      showToast('Les deux mots de passe ne correspondent pas.', { title: 'Mots de passe différents', type: 'error' });
      return;
    }
    setLoading(true);
    const { error } = await updatePassword(password);
    setLoading(false);
    if (error) {
      showToast(error, { title: 'Échec', type: 'error' });
      return;
    }
    showToast('Vous pouvez vous connecter avec votre nouveau mot de passe.', { title: 'Mot de passe modifié ✓', type: 'success' });
    navigation.navigate('Tabs');
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Nouveau mot de passe" showBack />
      <View style={styles.content}>
        <Text style={styles.brand}>ALBASSE SHOPPING</Text>
        {linkError ? (
          <Text style={styles.info}>
            Ce lien de réinitialisation est invalide ou a expiré. Retournez sur l'écran de connexion et demandez un
            nouveau lien.
          </Text>
        ) : !sessionReady ? (
          <Text style={styles.info}>Vérification du lien…</Text>
        ) : (
          <>
            <Text style={styles.info}>Choisissez votre nouveau mot de passe.</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Nouveau mot de passe"
              placeholderTextColor={colors.creamFaint}
              secureTextEntry
              style={styles.input}
            />
            <TextInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Confirmer le mot de passe"
              placeholderTextColor={colors.creamFaint}
              secureTextEntry
              style={styles.input}
            />
            <GoldButton
              label="Valider"
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
