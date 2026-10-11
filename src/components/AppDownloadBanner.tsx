import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Platform, Linking, Image } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, fonts, radius, spacing } from '../theme';

// Lien d'installation de l'app Android (build EAS interne — pas de compte
// Google Play requis). A remplacer par le lien de la fiche Play Store une
// fois l'app publiee.
const APP_DOWNLOAD_URL = 'https://expo.dev/accounts/fadoul89/projects/albasse-app/builds/b01f7b23-4ba9-41ea-ad10-d99cdd47887f';

const DISMISS_KEY = 'albasse_app_banner_dismissed';

function isAndroidWeb() {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined') return false;
  return /Android/i.test(navigator.userAgent);
}

export function AppDownloadBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isAndroidWeb()) return;
    AsyncStorage.getItem(DISMISS_KEY).then((dismissed) => {
      if (!dismissed) setVisible(true);
    });
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    setVisible(false);
    AsyncStorage.setItem(DISMISS_KEY, '1');
  };

  const download = () => {
    Linking.openURL(APP_DOWNLOAD_URL);
  };

  return (
    <View style={styles.banner}>
      <Image source={require('../../assets/icon.png')} style={styles.icon} />
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>Albasse Shopping, l'app</Text>
        <Text style={styles.subtitle}>Commandez plus vite depuis votre téléphone</Text>
      </View>
      <Pressable style={styles.downloadBtn} onPress={download}>
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
