import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, fonts, radius, spacing } from '../theme';
import {
  isWebPushSupported,
  hasWebPushPermission,
  isWebPushBlocked,
  subscribeToWebPush,
  getWebPushIssue,
  PUSH_PERMISSION_NOT_GRANTED,
} from '../lib/webPushSubscription';
import { isRunningAsInstalledPwa } from '../lib/pwaInstallPrompt';

// « _v2 » : l'ancien bandeau se refermait pour toujours apres un echec
// d'enregistrement (erreur 403 pour les clients connectes). Cette nouvelle cle
// le fait reapparaitre une fois chez ceux qui l'avaient perdu.
const DISMISS_KEY = 'albasse_push_banner_dismissed_v2';

function isDismissed(): Promise<boolean> {
  return AsyncStorage.getItem(DISMISS_KEY).then((v) => v === '1');
}

// Visite directe = referrer absent ou domaine externe (lien partage WhatsApp / réseaux sociaux)
function isExternalArrival(): boolean {
  if (typeof document === 'undefined') return false;
  const ref = document.referrer;
  if (!ref) return true;
  try {
    return !new URL(ref).hostname.includes('albasseshopping.com');
  } catch {
    return true;
  }
}

interface Props {
  style?: object;
  // Page d'accueil de l'application installee : le visiteur ouvre l'icone, pas
  // un lien partage. Sur iPhone, c'est le seul endroit ou l'autorisation peut
  // etre demandee (Apple exige un toucher, pas un affichage automatique).
  whenInstalled?: boolean;
}

export function WebPushBanner({ style, whenInstalled }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (!isWebPushSupported()) return;
    if (hasWebPushPermission() || isWebPushBlocked()) return;
    if (whenInstalled ? !isRunningAsInstalledPwa() : !isExternalArrival()) return;

    isDismissed().then((dismissed) => {
      if (!dismissed) setVisible(true);
    });
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    setVisible(false);
    AsyncStorage.setItem(DISMISS_KEY, '1');
  };

  const subscribe = async () => {
    const ok = await subscribeToWebPush();
    if (ok) {
      setVisible(false);
      return;
    }
    const issue = getWebPushIssue();
    if (issue === PUSH_PERMISSION_NOT_GRANTED) {
      // Le visiteur a refuse : on ne le sollicite plus.
      dismiss();
      return;
    }
    // Vrai probleme : on le dit et on garde le bandeau pour pouvoir reessayer.
    window.alert(`Les notifications n'ont pas pu être activées. Réessayez dans un instant.\n\n(Détail technique : ${issue})`);
  };

  return (
    <View style={[styles.banner, style]}>
      <Text style={styles.icon}>🔔</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.text} numberOfLines={2}>
          Recevoir les alertes ventes flash et nouveaux produits
        </Text>
      </View>
      <Pressable style={styles.subscribeBtn} onPress={subscribe}>
        <Text style={styles.subscribeBtnText}>Activer</Text>
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
    backgroundColor: '#0f2d1a',
    borderBottomWidth: 2,
    borderBottomColor: '#4CAF50',
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
  },
  icon: { fontSize: 20 },
  text: { color: '#e8f5e9', fontFamily: fonts.body, fontSize: 12, lineHeight: 16 },
  subscribeBtn: {
    backgroundColor: '#4CAF50',
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  subscribeBtnText: { color: '#ffffff', fontFamily: fonts.bodyBold, fontSize: 12 },
  closeBtn: { padding: 4 },
  closeBtnText: { color: '#A5D6A7', fontSize: 16 },
});
