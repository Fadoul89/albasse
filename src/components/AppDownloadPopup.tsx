import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Modal, Platform } from 'react-native';
import { Image } from 'expo-image';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, fonts, radius, spacing } from '../theme';
import { trackAppDownloadClick } from '../lib/appDownloadTracking';
import { isRunningInsideApp } from '../lib/runningInApp';
import { inAppName, installNotReadyMessage, isAndroidDevice, isAppInstalledOnDevice, isInAppBrowser, isIosDevice, isRunningAsInstalledPwa, openInChromeChecked, triggerPwaInstallPrompt } from '../lib/pwaInstallPrompt';
import { navigationRef } from '../navigation/navigationRef';
import { subscribeToWebPush } from '../lib/webPushSubscription';
import { trackShortcutInstallIfNeeded } from '../lib/appInstallTracking';
import { useInstallGuideStore } from '../store/installGuideStore';

const SHOW_DELAY_MS = 2500;

// Reapparait une fois par jour (comme les promos) plutot que d'etre
// definitivement ferme, pour vraiment solliciter le visiteur a chaque
// visite au lieu d'un simple bandeau qu'on oublie.
function seenKey() {
  return `albasse_app_popup_seen_${new Date().toISOString().slice(0, 10)}`;
}

function isEligibleWeb() {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined') return false;
  // déjà installée sur ce téléphone : pas de bouton « Installer »
  if (isRunningInsideApp() || isRunningAsInstalledPwa() || isAppInstalledOnDevice()) return false;
  return true;
}

export function AppDownloadPopup() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isEligibleWeb()) return;
    let cancelled = false;
    AsyncStorage.getItem(seenKey()).then((seen) => {
      if (cancelled || seen) return;
      // Pas par-dessus le tutoriel video deja ouvert depuis le bandeau.
      const timer = setTimeout(() => {
        if (!useInstallGuideStore.getState().visible) setVisible(true);
      }, SHOW_DELAY_MS);
      return () => clearTimeout(timer);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const dismiss = async () => {
    setVisible(false);
    await AsyncStorage.setItem(seenKey(), '1');
  };

  const install = async () => {
    if (isIosDevice()) {
      // Safari n'a pas de boite d'installation : on ferme cette fenetre et on ouvre le tutoriel video.
      trackAppDownloadClick('popup', 'ios-guide');
      await dismiss();
      useInstallGuideStore.getState().show();
      return;
    }
    // navigateur de TikTok, Facebook, WhatsApp... : l'installation n'y marche pas, il faut passer par le vrai navigateur. TikTok refuse
    // d'ouvrir Chrome tout seul (« L'action ne peut pas être réalisée ») : ses visiteurs voient tout de suite les étapes (page /installer).
    // Ailleurs, on tente Chrome ; si le lien est bloqué, même page : une alerte n'apparaît pas dans tous ces navigateurs.
    if (isAndroidDevice() && isInAppBrowser()) {
      if (inAppName() === 'tiktok') {
        trackAppDownloadClick('popup', 'etapes');
        await dismiss();
        navigationRef.navigate('Install');
        return;
      }
      const left = await openInChromeChecked();
      trackAppDownloadClick('popup', left ? 'chrome-intent' : 'chrome-bloque');
      if (!left) {
        await dismiss();
        navigationRef.navigate('Install');
      }
      return;
    }
    const outcome = await triggerPwaInstallPrompt();
    trackAppDownloadClick('popup', outcome === 'accepted' ? 'accepte' : outcome === 'dismissed' ? 'refuse' : 'indisponible');
    if (outcome === 'unavailable') {
      // La fenetre reste ouverte : le visiteur peut reessayer dans un instant.
      window.alert(installNotReadyMessage());
      return;
    }
    if (outcome === 'accepted') {
      trackShortcutInstallIfNeeded();
      subscribeToWebPush();
    }
    await dismiss();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={dismiss}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Pressable style={styles.closeBtn} onPress={dismiss} hitSlop={10}>
            <Text style={styles.closeIcon}>✕</Text>
          </Pressable>

          <Image source={require('../../assets/logo.jpg')} style={styles.icon} contentFit="cover" />

          <Text style={styles.title}>📲 Télécharge l'app Albasse Shopping</Text>
          <Text style={styles.message}>
            Commandez plus vite, suivez vos commandes et profitez des ventes flash directement depuis votre appareil.
          </Text>

          <View style={styles.buttonsRow}>
            <Pressable style={styles.secondaryBtn} onPress={dismiss}>
              <Text style={styles.secondaryBtnText}>Plus tard</Text>
            </Pressable>
            <Pressable style={styles.primaryBtn} onPress={install}>
              <Text style={styles.primaryBtnText}>📥 Installer</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: colors.overlay, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  card: {
    backgroundColor: colors.panelAlt,
    borderRadius: radius.xl,
    padding: spacing.lg,
    width: '100%',
    maxWidth: 380,
    borderWidth: 1.5,
    borderColor: colors.gold,
    alignItems: 'center',
  },
  closeBtn: { position: 'absolute', top: 12, right: 12, zIndex: 1 },
  closeIcon: { color: colors.creamFaint, fontSize: 18 },
  icon: { width: 72, height: 72, borderRadius: radius.lg, marginBottom: spacing.md },
  title: { color: colors.goldLight, fontFamily: fonts.displayBold, fontSize: 18, marginBottom: spacing.sm, textAlign: 'center' },
  message: { color: colors.cream, fontFamily: fonts.body, fontSize: 13, lineHeight: 19, textAlign: 'center', marginBottom: spacing.lg },
  buttonsRow: { flexDirection: 'row', gap: 10, width: '100%' },
  primaryBtn: { flex: 1, backgroundColor: colors.gold, borderRadius: radius.pill, paddingVertical: 13, alignItems: 'center' },
  primaryBtnText: { color: colors.background, fontFamily: fonts.bodyBold, fontSize: 13 },
  secondaryBtn: { flex: 1, borderRadius: radius.pill, paddingVertical: 13, alignItems: 'center', borderWidth: 1, borderColor: colors.gold },
  secondaryBtnText: { color: colors.gold, fontFamily: fonts.bodyMedium, fontSize: 13 },
});
