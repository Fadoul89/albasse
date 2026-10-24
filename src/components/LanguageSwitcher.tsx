import React, { useState } from 'react';
import { Text, Pressable, StyleSheet, Platform } from 'react-native';
import { fonts, radius } from '../theme';
import { isArabicPage, translateToArabic, translateToFrench } from '../lib/googleTranslate';

// Un seul bouton : celui de l'autre langue (« العربية » sur le site en français, « 🇫🇷 FR » sur le site traduit en arabe).
export function LanguageSwitcher() {
  const [arabic] = useState(isArabicPage);
  if (Platform.OS !== 'web') return null;

  return arabic ? (
    <Pressable testID="lang-fr" style={[styles.btn, styles.btnFrench]} onPress={translateToFrench}>
      <Text style={styles.btnText}>🇫🇷 FR</Text>
    </Pressable>
  ) : (
    <Pressable testID="lang-ar" style={[styles.btn, styles.btnArabic]} onPress={translateToArabic}>
      <Text style={styles.btnText}>العربية</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  btnArabic: { backgroundColor: '#2e8b57' },
  btnFrench: { backgroundColor: '#1e5fd8' },
  btnText: { color: '#ffffff', fontFamily: fonts.bodyBold, fontSize: 11 },
});
