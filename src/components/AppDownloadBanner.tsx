import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Platform, Image } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, fonts, radius, spacing } from '../theme';
import { trackAppDownloadClick } from '../lib/appDownloadTracking';
import { isRunningInsideApp } from '../lib/runningInApp';
import { inAppName, installNotReadyMessage, isAndroidDevice, isAppInstalledOnDevice, isInAppBrowser, isIosDevice, isRunningAsInstalledPwa, openInChromeChecked, triggerPwaInstallPrompt } from '../lib/pwaInstallPrompt';
import { navigationRef } from '../navigation/navigationRef';
import { subscribeToWebPush } from '../lib/webPushSubscription';
import { trackShortcutInstallIfNeeded } from '../lib/appInstallTracking';
import { useInstallGuideStore } from '../store/installGuideStore';

const DISMISS_KEY = 'albasse_app_banner_dismissed';

function isEligibleWeb() {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined') return false;
  // déjà installée sur ce téléphone : pas de bouton « Installer »
  if (isRunningInsideApp() || isRunningAsInstalledPwa() || isAppInstalledOnDevice()) return false;
  return true;
}

export function AppDownloadBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isEligibleWeb()) return;
    AsyncStorage.getItem(DISMISS_KEY).then((dismissed) => {
      if (!dismissed) setVisible(true);
    });
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    setVisible(false);
    AsyncStorage.setItem(DISMISS_KEY, '1');
  };

  const install = async () => {
    if (isIosDevice()) {
      // Safari n'a pas de boite d'installation : tutoriel video + etapes.
      trackAppDownloadClick('banner', 'ios-guide');
      useInstallGuideStore.getState().show();
      return;
    }
    // navigateur de TikTok, Facebook, WhatsApp... : l'installation n'y marche pas, il faut passer par le vrai navigateur. TikTok refuse
    // d'ouvrir Chrome tout seul (« L'action ne peut pas être réalisée ») : ses visiteurs voient tout de suite les étapes (page /installer).
    // Ailleurs, on tente Chrome ; si le lien est bloqué, même page : une alerte n'apparaît pas dans tous ces navigateurs.
    if (isAndroidDevice() && isInAppBrowser()) {
      if (inAppName() === 'tiktok') {
        trackAppDownloadClick('banner', 'etapes');
        navigationRef.navigate('Install');
        return;
      }
      const left = await openInChromeChecked();
      trackAppDownloadClick('banner', left ? 'chrome-intent' : 'chrome-bloque');
      if (!left) navigationRef.navigate('Install');
      return;
    }
    const outcome = await triggerPwaInstallPrompt();
    trackAppDownloadClick('banner', outcome === 'accepted' ? 'accepte' : outcome === 'dismissed' ? 'refuse' : 'indisponible');
    if (outcome === 'unavailable') {
      window.alert(installNotReadyMessage());
    } else if (outcome === 'accepted') {
      trackShortcutInstallIfNeeded();
      subscribeToWebPush();
    }
  };

  return (
    <View style={styles.banner}>
      <Image source={require('../../assets/logo.jpg')} style={styles.icon} />
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>Albasse Shopping, l'app</Text>
        <Text style={styles.subtitle}>Commandez plus vite depuis votre appareil</Text>
      </View>
      <Pressable style={styles.downloadBtn} onPress={install}>
        <Text style={styles.downloadBtnText}>Installer</Text>
      </Pressable>
      <Pressable onPress={dismiss} hitSlop={10} style={styles.closeBtn}>
        <Text style={styles.closeBtnText}>✕</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.panelAlt,
    borderBottomWidth: 1,
    borderBottomColor: colors.gold,
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
  },
  icon: { width: 40, height: 40, borderRadius: radius.sm },
  title: { color: colors.goldLight, fontFamily: fonts.bodyBold, fontSize: 13 },
  subtitle: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 11, marginTop: 1 },
  downloadBtn: {
    backgroundColor: colors.gold,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  downloadBtnText: { color: colors.background, fontFamily: fonts.bodyBold, fontSize: 12 },
  closeBtn: { padding: 4 },
  closeBtnText: { color: colors.creamFaint, fontSize: 16 },
});
