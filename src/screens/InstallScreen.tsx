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
  inAppName,
  isInAppBrowser,
  isIosDevice,
  manualInstallInstructions,
  openInChromeChecked,
  triggerPwaInstallPrompt,
} from '../lib/pwaInstallPrompt';
import { trackAppDownloadClick } from '../lib/appDownloadTracking';
import { trackShortcutInstallIfNeeded } from '../lib/appInstallTracking';
import {
  getWebPushIssue,
  hasWebPushPermission,
  isWebPushBlocked,
  isWebPushSupported,
  PUSH_PERMISSION_NOT_GRANTED,
  subscribeToWebPush,
} from '../lib/webPushSubscription';

// Page « albasseshopping.com/installer » (ou /app) : le lien à donner dans les publicités. Un seul bouton installe le raccourci
// du site sur Android et active les notifications push ; iPhone et navigateurs de Facebook / TikTok / WhatsApp ont leurs propres
// étapes. Ouverte sans compte.
export function InstallScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const showIosGuide = useInstallGuideStore((s) => s.show);
  const [alreadyInstalled] = useState(() => Platform.OS !== 'web' || isAppInstalledOnDevice());
  const [justInstalled, setJustInstalled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pushOn, setPushOn] = useState(() => hasWebPushPermission());
  const [pushBusy, setPushBusy] = useState(false);
  const [pushMessage, setPushMessage] = useState<string | null>(null);

  const ios = isIosDevice();
  const inApp = isInAppBrowser();
  // TikTok refuse d'ouvrir Chrome tout seul (« L'action ne peut pas être réalisée ») : ses visiteurs suivent des étapes, sans bouton qui échoue
  const tiktok = inAppName() === 'tiktok';

  const install = async () => {
    setBusy(true);
    setMessage(null);
    const outcome = await triggerPwaInstallPrompt();
    setBusy(false);
    trackAppDownloadClick('page', outcome === 'accepted' ? 'accepte' : outcome === 'dismissed' ? 'refuse' : 'indisponible');
    if (outcome === 'accepted') {
      setJustInstalled(true);
      trackShortcutInstallIfNeeded();
      // même geste que la fenêtre d'installation du site ; le bouton « Activer les notifications » ci-dessous prend le relais
      // si le téléphone ne montre pas la demande tout de suite
      subscribeToWebPush().then((ok) => ok && setPushOn(true));
    } else setMessage(installNotReadyMessage());
  };

  // navigateur de TikTok / Facebook : la page s'ouvre dans Chrome ; si le lien est bloqué, on dit comment faire à la main
  const openChrome = async () => {
    setMessage(null);
    const left = await openInChromeChecked();
    trackAppDownloadClick('page', left ? 'chrome-intent' : 'chrome-bloque');
    if (!left) setMessage(`Le lien n'a pas pu s'ouvrir tout seul. ${manualInstallInstructions()}`);
  };

  const showGuide = () => {
    trackAppDownloadClick('page', 'ios-guide');
    showIosGuide();
  };

  const enablePush = async () => {
    setPushBusy(true);
    setPushMessage(null);
    const ok = await subscribeToWebPush();
    setPushBusy(false);
    if (ok) setPushOn(true);
    else if (getWebPushIssue() === PUSH_PERMISSION_NOT_GRANTED) setPushMessage("Vous n'avez pas autorisé les notifications. Touchez le bouton pour réessayer.");
    else setPushMessage(`Activation impossible pour le moment (${getWebPushIssue() || 'erreur'}). Réessayez dans un instant.`);
  };

  const installedHere = alreadyInstalled || justInstalled;
  const showPush = Platform.OS === 'web' && installedHere && isWebPushSupported();

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

        {installedHere ? (
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
            <GoldButton label="📲 Voir comment installer sur iPhone" onPress={showGuide} />
            <Text style={styles.hint}>
              {inApp
                ? "Vous êtes dans Instagram, Facebook ou TikTok : ouvrez d'abord ce lien dans Safari (menu ⋯ puis « Ouvrir dans le navigateur »). "
                : ''}
              {manualInstallInstructions()}
            </Text>
          </View>
        ) : tiktok && isAndroidDevice() ? (
          <View style={styles.box} testID="install-tiktok-steps">
            <Text style={styles.boxTitle}>📲 Pour installer, ouvrez cette page dans votre navigateur</Text>
            <Text style={styles.boxText}>1️⃣ Touchez les trois points <Text style={styles.strong}>•••</Text> en haut à droite de TikTok ↗️</Text>
            <Text style={styles.boxText}>2️⃣ Touchez <Text style={styles.strong}>« Ouvrir dans le navigateur »</Text></Text>
            <Text style={styles.boxText}>3️⃣ Dans Chrome, touchez <Text style={styles.strong}>« Installer l'application »</Text></Text>
            <Pressable onPress={openChrome} accessibilityRole="button" style={styles.tryLink}>
              <Text style={styles.skipText}>Essayer d'ouvrir Chrome automatiquement</Text>
            </Pressable>
            {message ? <Text style={styles.hint} testID="install-inapp-hint">{message}</Text> : null}
          </View>
        ) : inApp && isAndroidDevice() ? (
          <View style={styles.actions}>
            <GoldButton label="🌐 Ouvrir dans Chrome pour installer" onPress={openChrome} />
            <Text style={styles.hint} testID="install-inapp-hint">{message ?? manualInstallInstructions()}</Text>
          </View>
        ) : (
          <View style={styles.actions}>
            <GoldButton label="📲 Installer l'application" onPress={install} loading={busy} />
            {message ? <Text style={styles.hint} testID="install-message">{message}</Text> : null}
          </View>
        )}

        {showPush ? (
          <View style={styles.box} testID="install-push">
            <Text style={styles.boxTitle}>{pushOn ? '🔔 Notifications activées' : '🔔 Recevez les promotions et vos alertes de commande'}</Text>
            {pushOn ? (
              <Text style={styles.boxText}>Vous recevrez les ventes flash et les nouvelles de vos commandes sur ce téléphone.</Text>
            ) : isWebPushBlocked() ? (
              <Text style={styles.boxText}>
                Les notifications sont bloquées sur ce téléphone. Autorisez-les dans les réglages du site (le cadenas à côté de l'adresse
                dans Chrome), puis revenez ici.
              </Text>
            ) : (
              <>
                <GoldButton label="🔔 Activer les notifications" onPress={enablePush} loading={pushBusy} />
                {pushMessage ? <Text style={styles.hint} testID="install-push-message">{pushMessage}</Text> : null}
              </>
            )}
          </View>
        ) : null}

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
  strong: { color: colors.goldLight, fontFamily: fonts.bodySemiBold },
  tryLink: { paddingTop: spacing.xs },
  skip: { paddingVertical: spacing.md },
  skipText: { color: colors.gold, fontFamily: fonts.bodyMedium, fontSize: 13 },
});
