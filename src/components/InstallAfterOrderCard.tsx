import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts, radius, spacing } from '../theme';
import { GoldButton } from './GoldButton';
import { navigationRef } from '../navigation/navigationRef';
import { useInstallGuideStore } from '../store/installGuideStore';
import { installOfferAfterOrderDue } from '../lib/installAfterSignUp';
import { trackAppDownloadClick } from '../lib/appDownloadTracking';
import { trackShortcutInstallIfNeeded } from '../lib/appInstallTracking';
import { subscribeToWebPush } from '../lib/webPushSubscription';
import { inAppName, installNotReadyMessage, isAndroidDevice, isInAppBrowser, isIosDevice, openInChromeChecked, triggerPwaInstallPrompt } from '../lib/pwaInstallPrompt';

// Carte « Installez l'application » sur la page de confirmation d'une commande (le client a confiance : c'est le bon moment).
// Même parcours que la fenêtre « Télécharge l'app » du site (AppDownloadPopup) :
//   iPhone : le tutoriel vidéo ; navigateur de TikTok / Facebook (Android) : Chrome, ou les étapes de la page /installer ; sinon la boîte d'installation de Chrome.
// Cachée sur ordinateur, dans l'application, et quand l'application est déjà installée.
export function InstallAfterOrderCard() {
  const [due] = useState(() => installOfferAfterOrderDue());
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  if (!due) return null;

  if (done) {
    return (
      <View style={styles.box} testID="confirm-install-done">
        <Text style={styles.title}>✅ Application installée</Text>
        <Text style={styles.text}>Retrouvez Albasse Shopping sur l'écran d'accueil de votre téléphone : suivez vos commandes en un toucher.</Text>
      </View>
    );
  }

  const ios = isIosDevice();

  const install = async () => {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      if (ios) {
        // Safari n'a pas de boîte d'installation : le tutoriel vidéo montre les étapes
        trackAppDownloadClick('commande', 'ios-guide');
        useInstallGuideStore.getState().show();
        return;
      }
      // navigateur de TikTok, Facebook, WhatsApp... : l'installation n'y marche pas, il faut passer par le vrai navigateur (TikTok refuse d'ouvrir Chrome)
      if (isAndroidDevice() && isInAppBrowser()) {
        if (inAppName() === 'tiktok') {
          trackAppDownloadClick('commande', 'etapes');
          navigationRef.navigate('Install');
          return;
        }
        const left = await openInChromeChecked();
        trackAppDownloadClick('commande', left ? 'chrome-intent' : 'chrome-bloque');
        if (!left) navigationRef.navigate('Install');
        return;
      }
      const outcome = await triggerPwaInstallPrompt();
      trackAppDownloadClick('commande', outcome === 'accepted' ? 'accepte' : outcome === 'dismissed' ? 'refuse' : 'indisponible');
      if (outcome === 'unavailable') {
        // Chrome n'est pas encore prêt : le client peut réessayer dans un instant
        setMessage(installNotReadyMessage());
        return;
      }
      if (outcome === 'accepted') {
        trackShortcutInstallIfNeeded();
        subscribeToWebPush();
        setDone(true);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.box} testID="confirm-install">
      <Text style={styles.title}>📲 Installez l'application Albasse Shopping</Text>
      <Text style={styles.text}>
        Suivez votre commande, retrouvez votre facture et profitez des ventes flash en un toucher, depuis l'écran d'accueil de votre téléphone. C'est gratuit.
      </Text>
      <GoldButton
        label={ios ? '📲 Voir comment installer' : "📲 Installer l'application"}
        onPress={install}
        loading={busy}
        style={{ marginTop: spacing.sm, width: '100%' }}
      />
      {message ? (
        <Text style={styles.message} testID="confirm-install-message">
          {message}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: colors.panel, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.gold, padding: spacing.md, marginTop: spacing.lg, width: '100%', alignItems: 'center' },
  title: { color: colors.goldLight, fontFamily: fonts.bodyBold, fontSize: 15, textAlign: 'center', marginBottom: 6 },
  text: { color: colors.cream, fontFamily: fonts.body, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  message: { color: colors.creamMuted, fontFamily: fonts.body, fontSize: 12.5, lineHeight: 18, textAlign: 'center', marginTop: spacing.sm },
});
