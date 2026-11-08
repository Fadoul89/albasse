// Zara qui parle sur un écran qui n'est PAS son chat (photo ronde + bulle). Utilisée sur « Mot de passe oublié » : un visiteur sans connexion ne voit jamais
// le chat de Zara quand le compte est obligatoire, mais c'est là qu'il a besoin d'elle. Elle n'ouvre rien toute seule et ne demande rien : c'est une voix amicale.
// Docs : docs/zara-mot-de-passe.md.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { colors, fonts, radius, spacing } from '../theme';

const AVATAR = require('../../assets/assistante-avatar.jpg');

export function ZaraSays({ text, testID }: { text: string; testID?: string }) {
  return (
    <View style={styles.row} testID={testID}>
      <Image source={AVATAR} style={styles.avatar} contentFit="cover" accessibilityLabel="Zara" />
      <View style={styles.bubble}>
        <Text style={styles.name}>Zara</Text>
        <Text style={styles.text}>{text}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: spacing.md },
  avatar: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: colors.gold },
  bubble: { flex: 1, backgroundColor: colors.panel, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 10 },
  name: { color: colors.goldLight, fontFamily: fonts.bodyBold, fontSize: 12, marginBottom: 2 },
  text: { color: colors.cream, fontFamily: fonts.body, fontSize: 14, lineHeight: 20 },
});
