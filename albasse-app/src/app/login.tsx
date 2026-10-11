import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { colors, fonts, radius, spacing } from '../theme';
import { useAuthStore } from '../store/authStore';
import { GoldButton } from '../components/GoldButton';
import { ScreenHeader } from '../components/ScreenHeader';

export default function LoginScreen() {
  const signIn = useAuthStore((s) => s.signIn);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email || !password) {
      Alert.alert('Champs manquants', 'Entrez votre email et votre mot de passe.');
      return;
    }
    setLoading(true);
    const { error } = await signIn(email.trim(), password);
    setLoading(false);
    if (error) {
      Alert.alert('Connexion impossible', error);
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
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
        <Pressable onPress={() => router.push('/register')} style={{ marginTop: spacing.lg }}>
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
