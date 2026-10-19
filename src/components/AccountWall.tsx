// Compte obligatoire à l'entrée (voir lib/accountWall) : couvre la page tant que le visiteur n'a pas de compte.
// En haut la connexion (numéro ou e-mail, « Se souvenir de mon mot de passe »), en bas « Créer mon compte » (nom, téléphone, mot de
// passe) ; après la connexion, il revient sur la page demandée.
import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Image } from 'expo-image';
import { navigationRef } from '../navigation/navigationRef';
import { colors, fonts, spacing } from '../theme';
import { GoldButton } from './GoldButton';
import { LoginForm } from './LoginForm';

const LOGO = require('../../assets/logo.jpg');

export function AccountWall() {
  const go = (route: 'Register' | 'ForgotPassword') => {
    if (navigationRef.isReady()) navigationRef.navigate(route);
  };
  return (
    <View style={styles.cover} testID="account-wall">
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Image source={LOGO} style={styles.logo} contentFit="cover" />
        <Text style={styles.brand}>ALBASSE SHOPPING</Text>
        <Text style={styles.title}>Bienvenue 👋</Text>
        <Text style={styles.text}>Connectez-vous pour découvrir nos articles et commander.</Text>
        <View style={styles.block}>
          {/* rien à faire après la connexion : le mur disparaît et la page demandée est rouverte (RootNavigator) */}
          <LoginForm onSuccess={() => {}} onForgot={() => go('ForgotPassword')} />
        </View>
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>Pas encore de compte ?</Text>
          <View style={styles.dividerLine} />
        </View>
        <View style={styles.block}>
          <GoldButton label="Créer mon compte" variant="outline" onPress={() => go('Register')} />
          <Text style={styles.small}>Gratuit : votre nom, votre numéro de téléphone et un mot de passe. L’e-mail est facultatif.</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  cover: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.background, zIndex: 50 },
  content: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  logo: { width: 76, height: 76, borderRadius: 38, marginBottom: spacing.sm, borderWidth: 2, borderColor: colors.gold },
  brand: { fontFamily: fonts.display, fontSize: 22, color: colors.goldLight, letterSpacing: 1, marginBottom: spacing.md },
  title: { fontFamily: fonts.bodyBold, fontSize: 22, color: colors.cream, marginBottom: 4 },
  text: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.creamMuted, textAlign: 'center', maxWidth: 360 },
  block: { width: '100%', maxWidth: 360, marginTop: spacing.lg },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, width: '100%', maxWidth: 360, marginTop: spacing.xl },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 12 },
  small: {
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 18,
    color: colors.creamMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
