import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { colors, fonts, spacing } from '../../theme';
import { useAuthStore } from '../../store/authStore';
import { useToastStore } from '../../store/toastStore';
import { GoldButton } from '../../components/GoldButton';
import { ScreenHeader } from '../../components/ScreenHeader';
import { isSupabaseConfigured } from '../../lib/supabase';
import { LoginForm } from '../../components/LoginForm';

export function LoginScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const signInWithGoogle = useAuthStore((s) => s.signInWithGoogle);
  const [googleLoading, setGoogleLoading] = useState(false);
  const showToast = useToastStore((s) => s.show);

  const handleGoogleSignIn = async () => {
    if (!isSupabaseConfigured) {
      showToast(
        "Ajoutez EXPO_PUBLIC_SUPABASE_URL et EXPO_PUBLIC_SUPABASE_ANON_KEY dans .env pour activer les comptes.",
        { title: 'Supabase non configuré', type: 'error' }
      );
      return;
    }
    setGoogleLoading(true);
    const { error } = await signInWithGoogle();
    setGoogleLoading(false);
    if (error) {
      showToast(error, { title: 'Connexion Google impossible', type: 'error' });
    }
  };

  const afterLogin = () => {
    // la page demandée à l'arrivée sur le site a déjà été rouverte (RootNavigator)
    if (!navigation.isFocused()) return;
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('Tabs');
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Connexion" showBack />
      <View style={styles.content}>
        <Text style={styles.brand}>ALBASSE SHOPPING</Text>
        <LoginForm onSuccess={afterLogin} onForgot={() => navigation.navigate('ForgotPassword')} />

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>ou</Text>
          <View style={styles.dividerLine} />
        </View>
        <GoldButton
          label="Continuer avec Google"
          variant="blue"
          onPress={handleGoogleSignIn}
          loading={googleLoading}
        />

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
  link: { color: colors.gold, fontFamily: fonts.bodyMedium, fontSize: 13, textAlign: 'center' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: spacing.md, gap: 10 },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 12 },
});
