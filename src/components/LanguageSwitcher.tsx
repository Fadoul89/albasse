import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { colors, fonts, radius } from '../theme';
import { translateToArabic, translateToFrench } from '../lib/googleTranslate';

export function LanguageSwitcher() {
  if (Platform.OS !== 'web') return null;

  return (
    <View style={styles.row}>
      <Pressable style={[styles.btn, styles.btnArabic]} onPress={translateToArabic}>
        <Text style={styles.btnText}>العربية</Text>
      </Pressable>
      <Pressable style={[styles.btn, styles.btnFrench]} onPress={translateToFrench}>
        <Text style={styles.btnText}>🇫🇷 FR</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6 },
  btn: {
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  btnArabic: { backgroundColor: '#2e8b57' },
  btnFrench: { backgroundColor: '#1e5fd8' },
  btnText: { color: '#ffffff', fontFamily: fonts.bodyBold, fontSize: 11 },
});
