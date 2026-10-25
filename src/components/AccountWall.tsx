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

const WHY = [
  'Des articles pour tous les goûts et tous les budgets',
  'Une expérience d’achat simple et pratique',
  'Livraison partout au Tchad 🇹🇩',
  'Un service client à votre écoute',
];

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
        {register ? (
          <View style={styles.welcome} testID="wall-welcome">
            <Text style={styles.title}>🎉 Bienvenue sur Albasse Shopping ! 🛍️</Text>
            <Text style={styles.text}>Bonjour et bienvenue à tous nos nouveaux clients ! ❤️</Text>
            <Text style={styles.text}>
              Nous sommes ravis de vous accueillir sur 🌐 www.albasseshopping.com, votre plateforme de vente en ligne 100 % tchadienne 🇹🇩.
            </Text>
            <Text style={styles.text}>
              Découvrez une large sélection de vêtements, chaussures, parfums, montres et accessoires pour tous les styles et tous les budgets.
            </Text>
            <Text style={styles.why}>✨ Pourquoi choisir Albasse Shopping ?</Text>
            <View style={styles.list}>
              {WHY.map((line) => (
                <Text key={line} style={styles.item}>✅ {line}</Text>
              ))}
            </View>
            <Text style={styles.text}>🤝 Merci de nous faire confiance et de rejoindre notre grande famille !</Text>
            <Text style={styles.cta}>🛒 Créez votre compte dès maintenant et profitez pleinement de votre expérience shopping.</Text>
          </View>
        ) : (
          <>
            <Text style={styles.title}>Bienvenue 👋</Text>
            <Text style={styles.text}>Connectez-vous pour découvrir nos articles et commander.</Text>
          </>
        )}
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
  title: { fontFamily: fonts.bodyBold, fontSize: 22, color: colors.cream, marginBottom: 4, textAlign: 'center' },
  text: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.creamMuted, textAlign: 'center', maxWidth: 360 },
  welcome: { alignItems: 'center', gap: spacing.sm },
  why: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.goldLight, textAlign: 'center', marginTop: 4 },
  list: { gap: 4, alignSelf: 'center', maxWidth: 360 },
  item: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.creamMuted },
  cta: { fontFamily: fonts.bodySemiBold, fontSize: 14, lineHeight: 20, color: colors.goldLight, textAlign: 'center', maxWidth: 360 },
  block: { width: '100%', maxWidth: 420, marginTop: spacing.lg },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, width: '100%', maxWidth: 420, marginTop: spacing.xl },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 12 },
});
