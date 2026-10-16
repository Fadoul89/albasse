import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Modal, Platform } from 'react-native';
import { Image } from 'expo-image';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, fonts, radius, spacing } from '../theme';
import { trackAppDownloadClick } from '../lib/appDownloadTracking';
import { isRunningInsideApp } from '../lib/runningInApp';
import { isRunningAsInstalledPwa, triggerPwaInstallPrompt } from '../lib/pwaInstallPrompt';
import { subscribeToWebPush } from '../lib/webPushSubscription';
import { trackShortcutInstallIfNeeded } from '../lib/appInstallTracking';

const SHOW_DELAY_MS = 2500;

// Reapparait une fois par jour (comme les promos) plutot que d'etre
// definitivement ferme, pour vraiment solliciter le visiteur a chaque
// visite au lieu d'un simple bandeau qu'on oublie.
function seenKey() {
  return `albasse_app_popup_seen_${new Date().toISOString().slice(0, 10)}`;
}

function isAndroidWeb() {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined') return false;
  if (isRunningInsideApp() || isRunningAsInstalledPwa()) return false;
  return /Android/i.test(navigator.userAgent);
}

export function AppDownloadPopup() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isAndroidWeb()) return;
    let cancelled = false;
    AsyncStorage.getItem(seenKey()).then((seen) => {
      if (cancelled || seen) return;
      const timer = setTimeout(() => setVisible(true), SHOW_DELAY_MS);
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
    trackAppDownloadClick('popup');
    const outcome = await triggerPwaInstallPrompt();
    if (outcome === 'unavailable') {
      window.alert(
        "Pour installer : appuyez sur les trois points (⋮) en haut de Chrome, puis « Ajouter à l'écran d'accueil »."
      );
    } else if (outcome === 'accepted') {
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
            Commandez plus vite, suivez vos commandes et profitez des ventes flash directement depuis votre téléphone.
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
