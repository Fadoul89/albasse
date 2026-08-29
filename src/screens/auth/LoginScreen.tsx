import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { colors, fonts, radius, spacing } from '../../theme';
import { useAuthStore } from '../../store/authStore';
import { useToastStore } from '../../store/toastStore';
import { GoldButton } from '../../components/GoldButton';
import { ScreenHeader } from '../../components/ScreenHeader';
import { isSupabaseConfigured } from '../../lib/supabase';

export function LoginScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const signIn = useAuthStore((s) => s.signIn);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const showToast = useToastStore((s) => s.show);

  const handleSubmit = async () => {
    if (!isSupabaseConfigured) {
      showToast(
        "Ajoutez EXPO_PUBLIC_SUPABASE_URL et EXPO_PUBLIC_SUPABASE_ANON_KEY dans .env pour activer les comptes.",
        { title: 'Supabase non configuré', type: 'error' }
      );
      return;
    }
    if (!email || !password) {
      showToast('Entrez votre email et votre mot de passe.', { title: 'Champs manquants', type: 'error' });
      return;
    }
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) {
      showToast(error, { title: 'Connexion impossible', type: 'error' });
    } else if (navigation.canGoBack()) {
      navigation.goBack();
    }
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Connexion" showBack />
      <View style={styles.content}>
        <Text style={styles.brand}>ALBASSE SHOPPING</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="Email"
          placeholderTextColor={colors.creamFaint}
          autoCapitalize="none"
          keyboardType="email-address"
          style={styles.input}
        />
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Mot de passe"
          placeholderTextColor={colors.creamFaint}
          secureTextEntry
          style={styles.input}
        />
        <GoldButton label="Se connecter" onPress={handleSubmit} loading={loading} style={{ marginTop: spacing.md }} />
        <Pressable onPress={() => navigation.navigate('Register')} style={{ marginTop: spacing.lg }}>
          <Text style={styles.link}>Pas encore de compte ? Créer un compte</Text>
        </Pressable>
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
  link: { color: colors.gold, fontFamily: fonts.bodyMedium, fontSize: 13, textAlign: 'center' },
});
