// Nouveau logo (24 novembre 2026) : l'icône d'un raccourci déjà installé sur un écran d'accueil ne se met jamais à jour
// toute seule (limite d'Android/iOS/Chrome, pas du site) — seul le contenu des pages se rafraîchit automatiquement.
// Ce guide s'affiche une seule fois, uniquement pour ceux qui ouvrent DÉJÀ l'app installée (raccourci PWA ou coquille
// Android), pour leur expliquer comment réinstaller et voir le nouveau logo.
import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Modal, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, fonts, radius, spacing } from '../theme';
import { isRunningInsideApp } from '../lib/runningInApp';
import { isAndroidDevice, isIosDevice, isRunningAsInstalledPwa } from '../lib/pwaInstallPrompt';

const SEEN_KEY = 'albasse_logo_update_guide_seen_v1';
const SHOW_DELAY_MS = 1500;

function isEligible(): boolean {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined') return false;
  return isRunningInsideApp() || isRunningAsInstalledPwa();
}

function steps(): string[] {
  if (isIosDevice()) {
    return [
      "Appuyez longuement sur l'icône « Albasse Shopping » de votre écran d'accueil",
      'Touchez « Supprimer l\'app »',
      'Revenez sur ce site, touchez Partager puis « Sur l\'écran d\'accueil »',
    ];
  }
  if (isAndroidDevice()) {
    return [
      "Appuyez longuement sur l'icône « Albasse Shopping » de votre écran d'accueil",
      'Touchez « Désinstaller » ou glissez-la vers « Supprimer »',
      'Revenez sur ce site et touchez de nouveau « Installer »',
    ];
  }
  return [
    "Supprimez le raccourci « Albasse Shopping » de votre écran d'accueil",
    'Revenez sur ce site et réinstallez-le',
  ];
}

export function LogoUpdateGuide() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isEligible()) return;
    let cancelled = false;
    AsyncStorage.getItem(SEEN_KEY).then((seen) => {
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
    await AsyncStorage.setItem(SEEN_KEY, '1');
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={dismiss}>
      <View style={styles.overlay}>
        <View style={styles.card} testID="logo-update-guide">
          <Text style={styles.title}>🎨 Nouveau logo disponible !</Text>
          <Text style={styles.message}>
            L'icône de l'application reste celle d'avant sur votre écran d'accueil — votre téléphone ne la change jamais
            tout seul. Pour voir le nouveau logo :
          </Text>
          {steps().map((s, i) => (
            <View key={i} style={styles.stepRow} testID={`logo-update-step-${i}`}>
              <Text style={styles.stepNumber}>{i + 1}</Text>
              <Text style={styles.stepText}>{s}</Text>
            </View>
          ))}
          <Pressable style={styles.primaryBtn} onPress={dismiss} testID="logo-update-guide-close">
            <Text style={styles.primaryBtnText}>J'ai compris</Text>
          </Pressable>
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
  },
  title: { color: colors.goldLight, fontFamily: fonts.displayBold, fontSize: 18, marginBottom: spacing.sm, textAlign: 'center' },
  message: { color: colors.cream, fontFamily: fonts.body, fontSize: 13, lineHeight: 19, marginBottom: spacing.md },
  stepRow: { flexDirection: 'row', gap: 10, marginBottom: spacing.sm, alignItems: 'flex-start' },
  stepNumber: {
    color: colors.background,
    backgroundColor: colors.gold,
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    width: 20,
    height: 20,
    borderRadius: 10,
    textAlign: 'center',
    lineHeight: 20,
  },
  stepText: { flex: 1, color: colors.cream, fontFamily: fonts.body, fontSize: 13, lineHeight: 19 },
  primaryBtn: { marginTop: spacing.sm, backgroundColor: colors.gold, borderRadius: radius.pill, paddingVertical: 13, alignItems: 'center' },
  primaryBtnText: { color: colors.background, fontFamily: fonts.bodyBold, fontSize: 13 },
});
