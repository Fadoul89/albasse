import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts, radius, spacing } from '../theme';
import { ScreenHeader } from '../components/ScreenHeader';
import { GoldButton } from '../components/GoldButton';
import { useInstallGuideStore } from '../store/installGuideStore';
import {
  installNotReadyMessage,
  isAndroidDevice,
  isAppInstalledOnDevice,
  isInAppBrowser,
  isIosDevice,
  manualInstallInstructions,
  openInChrome,
  triggerPwaInstallPrompt,
} from '../lib/pwaInstallPrompt';

// Page « albasseshopping.com/installer » (ou /app) : le lien à donner dans les publicités. Un seul bouton installe le raccourci
// du site sur Android ; iPhone et navigateurs de Facebook / TikTok / WhatsApp ont leurs propres étapes. Ouverte sans compte.
export function InstallScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const showIosGuide = useInstallGuideStore((s) => s.show);
  const [alreadyInstalled] = useState(() => Platform.OS !== 'web' || isAppInstalledOnDevice());
  const [justInstalled, setJustInstalled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const ios = isIosDevice();
  const inApp = isInAppBrowser();

  const install = async () => {
    setBusy(true);
    setMessage(null);
    const outcome = await triggerPwaInstallPrompt();
    setBusy(false);
    if (outcome === 'accepted') setJustInstalled(true);
    else setMessage(installNotReadyMessage());
  };

  const goToShop = () => navigation.navigate('Tabs', { screen: 'Home' } as never);

  return (
    <View style={styles.screen} testID="install-screen">
      <ScreenHeader title="Installer l'application" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.emoji}>📲</Text>
        <Text style={styles.title}>Albasse Shopping sur votre téléphone</Text>
        <Text style={styles.subtitle}>
          Un raccourci sur votre écran d'accueil : vous ouvrez la plateforme en un toucher, comme une vraie application.
        </Text>

        <View style={styles.benefits}>
          <Text style={styles.benefit}>✅ Ouverture en un seul toucher</Text>
          <Text style={styles.benefit}>✅ Les promotions et les alertes de commande sur votre téléphone</Text>
        </View>

        {alreadyInstalled || justInstalled ? (
          <View style={styles.box} testID="install-done">
            <Text style={styles.boxTitle}>{justInstalled ? '✅ Installation lancée' : '✅ Albasse est déjà installée'}</Text>
            <Text style={styles.boxText}>
              {justInstalled
                ? "Cherchez l'icône Albasse sur votre écran d'accueil ou dans la liste de vos applications."
                : "Ouvrez-la depuis l'icône Albasse de votre écran d'accueil."}
            </Text>
          </View>
        ) : ios ? (
          <View style={styles.actions}>
            <GoldButton label="📲 Voir comment installer sur iPhone" onPress={showIosGuide} />
            <Text style={styles.hint}>
              {inApp
                ? "Vous êtes dans Instagram, Facebook ou TikTok : ouvrez d'abord ce lien dans Safari (menu ⋯ puis « Ouvrir dans le navigateur »). "
                : ''}
              {manualInstallInstructions()}
            </Text>
          </View>
        ) : inApp && isAndroidDevice() ? (
          <View style={styles.actions}>
            <GoldButton label="🌐 Ouvrir dans Chrome pour installer" onPress={openInChrome} />
            <Text style={styles.hint}>{manualInstallInstructions()}</Text>
          </View>
        ) : (
          <View style={styles.actions}>
            <GoldButton label="📲 Installer l'application" onPress={install} loading={busy} />
            {message ? <Text style={styles.hint} testID="install-message">{message}</Text> : null}
          </View>
        )}

        <Pressable onPress={goToShop} style={styles.skip} accessibilityRole="button">
          <Text style={styles.skipText}>Continuer vers la plateforme →</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: 60, alignItems: 'center', gap: spacing.md },
  emoji: { fontSize: 56, marginTop: spacing.md },
  title: { color: colors.goldLight, fontFamily: fonts.display, fontSize: 22, textAlign: 'center' },
  subtitle: { color: colors.creamMuted, fontFamily: fonts.body, fontSize: 14, lineHeight: 21, textAlign: 'center', maxWidth: 420 },
  benefits: {
    alignSelf: 'stretch',
    maxWidth: 420,
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 6,
  },
  benefit: { color: colors.cream, fontFamily: fonts.bodyMedium, fontSize: 13, lineHeight: 19 },
  actions: { alignSelf: 'stretch', maxWidth: 420, gap: spacing.sm },
  hint: { color: colors.creamMuted, fontFamily: fonts.body, fontSize: 13, lineHeight: 19 },
  box: {
    alignSelf: 'stretch',
    maxWidth: 420,
    backgroundColor: colors.panelAlt,
    borderRadius: radius.md,
    borderLeftWidth: 4,
    borderLeftColor: colors.gold,
    padding: spacing.md,
    gap: 4,
  },
  boxTitle: { color: colors.goldLight, fontFamily: fonts.bodySemiBold, fontSize: 15 },
  boxText: { color: colors.creamMuted, fontFamily: fonts.body, fontSize: 13, lineHeight: 19 },
  skip: { paddingVertical: spacing.md },
  skipText: { color: colors.gold, fontFamily: fonts.bodyMedium, fontSize: 13 },
});
