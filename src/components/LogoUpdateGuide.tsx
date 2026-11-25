// Nouveau logo (24 novembre 2026) : l'icône d'un raccourci déjà installé sur un écran d'accueil ne se met jamais à jour
// toute seule (limite d'Android/iOS/Chrome, pas du site) — seul le contenu des pages se rafraîchit automatiquement.
// Ce guide s'affiche une seule fois, uniquement pour ceux qui ouvrent DÉJÀ l'app installée (raccourci PWA ou coquille
// Android), pour leur expliquer comment réinstaller et voir le nouveau logo.
import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Modal, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, fonts, radius, spacing } from '../theme';
import { isRunningInsideApp } from '../lib/runningInApp';
import { isAndroidDevice, isIosDevice, isRunningAsInstalledPwa, installNotReadyMessage, triggerPwaInstallPrompt } from '../lib/pwaInstallPrompt';
import { subscribeToWebPush } from '../lib/webPushSubscription';
import { trackShortcutInstallIfNeeded } from '../lib/appInstallTracking';
import { useInstallGuideStore } from '../store/installGuideStore';

const SEEN_KEY = 'albasse_logo_update_guide_seen_v1';
const SHOW_DELAY_MS = 1500;

function isEligible(): boolean {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined') return false;
  return isRunningInsideApp() || isRunningAsInstalledPwa();
}

// Seule l'étape 1 (supprimer l'ancien raccourci) ne peut pas être automatisée : aucune page web n'a le droit de
// retirer un raccourci de l'écran d'accueil (même limite de sécurité que pour le modifier). L'étape 2 l'est : un
// bouton déclenche directement la réinstallation (ou le tutoriel vidéo sur iPhone, où Safari ne propose pas de
// fenêtre d'installation automatique).
function removeStep(): string {
  if (isIosDevice()) return "Appuyez longuement sur l'icône « Albasse Shopping » de votre écran d'accueil, puis touchez « Supprimer l'app »";
  if (isAndroidDevice()) return "Appuyez longuement sur l'icône « Albasse Shopping » de votre écran d'accueil, puis touchez « Désinstaller »";
  return "Supprimez le raccourci « Albasse Shopping » de votre écran d'accueil";
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

  // Étape 2 : réinstaller. Sur iPhone, Safari n'a pas de fenêtre d'installation automatique (ouvre le tutoriel
  // vidéo déjà utilisé ailleurs sur le site). Ailleurs, déclenche directement la fenêtre native « Installer » —
  // elle ne peut s'ouvrir que si l'étape 1 (supprimer l'ancien raccourci) a bien été faite avant.
  const reinstall = async () => {
    if (isIosDevice()) {
      await dismiss();
      useInstallGuideStore.getState().show();
      return;
    }
    const outcome = await triggerPwaInstallPrompt();
    if (outcome === 'unavailable') {
      window.alert(`Supprimez d'abord l'ancien raccourci (étape 1), puis réessayez.\n\n${installNotReadyMessage()}`);
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
        <View style={styles.card} testID="logo-update-guide">
          <Text style={styles.title}>🎨 Nouveau logo disponible !</Text>
          <Text style={styles.message}>
            L'icône de l'application reste celle d'avant sur votre écran d'accueil — votre téléphone ne la change jamais
            tout seul. Pour voir le nouveau logo :
          </Text>
          <View style={styles.stepRow} testID="logo-update-step-0">
            <Text style={styles.stepNumber}>1</Text>
            <Text style={styles.stepText}>{removeStep()}</Text>
          </View>
          <View style={styles.stepRow} testID="logo-update-step-1">
            <Text style={styles.stepNumber}>2</Text>
            <Text style={styles.stepText}>
              {isIosDevice() ? 'Puis réinstallez-le (voir comment, en vidéo)' : 'Puis touchez « Réinstaller » ci-dessous'}
            </Text>
          </View>
          <Pressable style={styles.primaryBtn} onPress={reinstall} testID="logo-update-guide-reinstall">
            <Text style={styles.primaryBtnText}>{isIosDevice() ? '🎥 Voir comment faire' : '📥 Réinstaller maintenant'}</Text>
          </Pressable>
          <Pressable style={styles.secondaryBtn} onPress={dismiss} testID="logo-update-guide-close">
            <Text style={styles.secondaryBtnText}>Plus tard</Text>
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
  secondaryBtn: { marginTop: spacing.sm, borderRadius: radius.pill, paddingVertical: 13, alignItems: 'center', borderWidth: 1, borderColor: colors.gold },
  secondaryBtnText: { color: colors.gold, fontFamily: fonts.bodyMedium, fontSize: 13 },
});
