// Compte obligatoire à l'entrée (voir lib/accountWall) : couvre la page tant que le visiteur n'a pas de compte.
// « Créer mon compte » (nom, téléphone, mot de passe) ou « J'ai déjà un compte » ; après la connexion, il revient sur la page demandée.
import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { Image } from 'expo-image';
import { navigationRef } from '../navigation/navigationRef';
import { colors, fonts, spacing } from '../theme';
import { GoldButton } from './GoldButton';

const LOGO = require('../../assets/logo.jpg');

export function AccountWall() {
  const go = (route: 'Register' | 'Login' | 'PrivacyPolicy' | 'Contact') => {
    if (navigationRef.isReady()) navigationRef.navigate(route);
  };
  return (
    <View style={styles.cover} testID="account-wall">
      <ScrollView contentContainerStyle={styles.content}>
        <Image source={LOGO} style={styles.logo} contentFit="cover" />
        <Text style={styles.brand}>ALBASSE SHOPPING</Text>
        <Text style={styles.title}>Bienvenue 👋</Text>
        <Text style={styles.text}>Créez votre compte gratuit pour découvrir nos articles et commander.</Text>
        <Text style={styles.small}>Seulement votre nom, votre numéro de téléphone et un mot de passe. L’e-mail est facultatif.</Text>
        <View style={styles.buttons}>
          <GoldButton label="Créer mon compte" onPress={() => go('Register')} />
          <GoldButton label="J’ai déjà un compte" variant="outline" onPress={() => go('Login')} />
        </View>
        <View style={styles.links}>
          <Pressable onPress={() => go('PrivacyPolicy')}>
            <Text style={styles.link}>Confidentialité</Text>
          </Pressable>
          <Text style={styles.dot}>·</Text>
          <Pressable onPress={() => go('Contact')}>
            <Text style={styles.link}>Contact</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  cover: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.background, zIndex: 50 },
  content: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  logo: { width: 88, height: 88, borderRadius: 44, marginBottom: spacing.md, borderWidth: 2, borderColor: colors.gold },
  brand: { fontFamily: fonts.display, fontSize: 22, color: colors.goldLight, letterSpacing: 1, marginBottom: spacing.lg },
  title: { fontFamily: fonts.bodyBold, fontSize: 22, color: colors.cream, marginBottom: spacing.sm },
  text: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.cream, textAlign: 'center', maxWidth: 360 },
  small: {
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 18,
    color: colors.creamMuted,
    textAlign: 'center',
    maxWidth: 360,
    marginTop: spacing.sm,
  },
  buttons: { width: '100%', maxWidth: 360, gap: spacing.sm, marginTop: spacing.xl },
  links: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: spacing.xl },
  link: { color: colors.gold, fontFamily: fonts.bodyMedium, fontSize: 12 },
  dot: { color: colors.creamFaint, fontSize: 12 },
});
