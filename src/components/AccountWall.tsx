// Compte obligatoire à l'entrée (voir lib/accountWall) : couvre la page tant que le visiteur n'a pas de compte.
// Le formulaire « Créer un compte » s'affiche en premier ; « J'ai déjà un compte » montre la connexion (numéro ou e-mail,
// « Se souvenir de mon mot de passe »). Après l'inscription ou la connexion, l'écran disparaît et la page demandée est là.
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Image } from 'expo-image';
import { navigationRef } from '../navigation/navigationRef';
import { colors, fonts, spacing } from '../theme';
import { GoldButton } from './GoldButton';
import { LoginForm } from './LoginForm';
import { RegisterForm } from './RegisterForm';

const LOGO = require('../../assets/logo.jpg');

export function AccountWall() {
  const [mode, setMode] = useState<'register' | 'login'>('register');
  const go = (route: 'ForgotPassword' | 'PrivacyPolicy') => {
    if (navigationRef.isReady()) navigationRef.navigate(route);
  };
  // rien à faire après l'inscription ou la connexion : le mur disparaît et la page demandée est rouverte (RootNavigator)
  const done = () => {};
  const register = mode === 'register';
  return (
    <View style={styles.cover} testID="account-wall">
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Image source={LOGO} style={styles.logo} contentFit="cover" />
        <Text style={styles.brand}>ALBASSE SHOPPING</Text>
        <Text style={styles.title}>Bienvenue 👋</Text>
        <Text style={styles.text}>
          {register
            ? 'Créez votre compte gratuit pour découvrir nos articles et commander.'
            : 'Connectez-vous pour découvrir nos articles et commander.'}
        </Text>
        <View style={styles.block} testID={register ? 'wall-register' : 'wall-login'}>
          {register ? (
            <RegisterForm onSuccess={done} onPrivacy={() => go('PrivacyPolicy')} />
          ) : (
            <LoginForm onSuccess={done} onForgot={() => go('ForgotPassword')} />
          )}
        </View>
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>{register ? 'Déjà un compte ?' : 'Pas encore de compte ?'}</Text>
          <View style={styles.dividerLine} />
        </View>
        <View style={styles.block}>
          <GoldButton
            label={register ? 'J’ai déjà un compte' : 'Créer mon compte'}
            variant="outline"
            onPress={() => setMode(register ? 'login' : 'register')}
          />
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
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, width: '100%', maxWidth: 420, marginTop: spacing.xl },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 12 },
});
