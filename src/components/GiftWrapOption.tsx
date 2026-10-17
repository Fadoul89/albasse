import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { colors, fonts, radius, spacing } from '../theme';
import { GIFT_WRAP_FEE } from '../constants/shopRules';

const GIFT_IMAGE = require('../../assets/gift-box.png');
const formatXAF = (n: number) => `${n.toLocaleString('fr-FR')} FCFA`;

export { GIFT_IMAGE };

// Image cadeau sur laquelle le client touche pour ajouter l'emballage cadeau a sa commande.
export function GiftWrapOption({ checked, onToggle }: { checked: boolean; onToggle: () => void }) {
  return (
    <Pressable
      style={[styles.card, checked && styles.cardActive]}
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      aria-checked={checked}
      accessibilityLabel={`Emballage cadeau, ${formatXAF(GIFT_WRAP_FEE)}`}
      testID="gift-wrap-option"
    >
      <Image source={GIFT_IMAGE} style={styles.image} contentFit="contain" />
      <View style={styles.text}>
        <Text style={styles.title}>Emballage cadeau</Text>
        <Text style={styles.sub}>Votre commande arrive joliment emballée</Text>
        <Text style={styles.price}>{`+ ${formatXAF(GIFT_WRAP_FEE)}`}</Text>
      </View>
      <View style={[styles.check, checked && styles.checkActive]}>{checked ? <Text style={styles.checkMark}>✓</Text> : null}</View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    padding: spacing.sm + 2,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  cardActive: { borderColor: colors.gold, backgroundColor: colors.panelAlt },
  image: { width: 62, height: 62 },
  text: { flex: 1, minWidth: 0 },
  title: { color: colors.cream, fontFamily: fonts.bodyBold, fontSize: 15 },
  sub: { color: colors.creamMuted, fontFamily: fonts.body, fontSize: 12, marginTop: 1 },
  price: { color: colors.goldLight, fontFamily: fonts.bodyBold, fontSize: 13, marginTop: 4 },
  check: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: colors.creamFaint, alignItems: 'center', justifyContent: 'center' },
  checkActive: { borderColor: colors.gold, backgroundColor: colors.gold },
  checkMark: { color: colors.background, fontFamily: fonts.bodyBold, fontSize: 15, lineHeight: 18 },
});
