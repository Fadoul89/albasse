import React, { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { navigationRef } from '../navigation/navigationRef';
import { COOKIE_TEXT, onChoiceChange, readChoice, saveChoice, shouldShowBanner, type CookieChoice } from '../lib/cookieConsent';
import { initTikTokPixel, stopTikTokPixel } from '../lib/tiktokPixel';
import { colors, fonts, radius, spacing } from '../theme';

/** Applique le choix : « Accepter » charge le pixel TikTok, « Refuser » n'envoie rien (et arrête le pixel si le visiteur change d'avis). */
export function applyChoice(choice: CookieChoice) {
  saveChoice(choice);
  if (choice === 'accepted') initTikTokPixel();
  else stopTikTokPixel();
}

/** Au démarrage : le pixel ne se charge que si le visiteur avait déjà accepté. */
export function startPixelIfAccepted() {
  if (readChoice() === 'accepted') initTikTokPixel();
}

export function CookieBanner() {
  const isWeb = Platform.OS === 'web';
  const [choice, setChoice] = useState<CookieChoice | null>(() => readChoice());

  useEffect(() => {
    setChoice(readChoice());
    return onChoiceChange(setChoice);
  }, []);

  if (!shouldShowBanner(choice, isWeb)) return null;

  const more = () => {
    if (navigationRef.isReady()) navigationRef.navigate('PrivacyPolicy');
  };

  return (
    <View style={styles.wrap} pointerEvents="box-none" testID="cookie-banner-wrap">
      <View style={styles.banner} accessibilityRole="alert" testID="cookie-banner">
        <Text style={styles.title}>{COOKIE_TEXT.title}</Text>
        <Text style={styles.body}>{COOKIE_TEXT.body}</Text>
        <View style={styles.row}>
          <Pressable onPress={() => applyChoice('refused')} style={[styles.btn, styles.refuse]} accessibilityRole="button" testID="cookie-refuse">
            <Text style={styles.refuseText}>{COOKIE_TEXT.refuse}</Text>
          </Pressable>
          <Pressable onPress={() => applyChoice('accepted')} style={[styles.btn, styles.accept]} accessibilityRole="button" testID="cookie-accept">
            <Text style={styles.acceptText}>{COOKIE_TEXT.accept}</Text>
          </Pressable>
        </View>
        <Pressable onPress={more} hitSlop={8} accessibilityRole="link" testID="cookie-more">
          <Text style={styles.more}>{COOKIE_TEXT.more}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 1100, alignItems: 'center', padding: spacing.sm },
  banner: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: colors.panel,
    borderColor: colors.gold,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 8,
  },
  title: { color: colors.goldLight, fontFamily: fonts.bodySemiBold, fontSize: 14 },
  body: { color: colors.cream, fontFamily: fonts.body, fontSize: 13, lineHeight: 19 },
  row: { flexDirection: 'row', gap: 10, marginTop: 4 },
  btn: { flex: 1, minHeight: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  accept: { backgroundColor: colors.gold },
  acceptText: { color: colors.background, fontFamily: fonts.bodyBold, fontSize: 14 },
  refuse: { backgroundColor: 'transparent', borderColor: colors.goldLight, borderWidth: 1 },
  refuseText: { color: colors.goldLight, fontFamily: fonts.bodySemiBold, fontSize: 14 },
  more: { color: colors.goldLight, fontFamily: fonts.bodySemiBold, fontSize: 12, textDecorationLine: 'underline', textAlign: 'center' },
});
