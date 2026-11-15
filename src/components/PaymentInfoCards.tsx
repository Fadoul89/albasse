// Bas de la page de commande : les cartes Moov Money et Airtel Money (numéro + « Copier le numéro »). Voir lib/paymentCards.ts.
import React from 'react';
import { View, Text, Pressable, StyleSheet, Linking, Platform } from 'react-native';
import { colors, fonts, radius, spacing } from '../theme';
import { useToastStore } from '../store/toastStore';
import { PAYMENT_CARDS_TEXT, paymentCards, type PaymentCard, type PaymentCardSettings } from '../lib/paymentCards';

const BADGE: Record<PaymentCard['key'], string> = { moov: '#1E6FD9', airtel: '#D7263D' };

export function PaymentInfoCards({ settings }: { settings: PaymentCardSettings | null | undefined }) {
  const showToast = useToastStore((s) => s.show);
  const cards = paymentCards(settings);

  const copy = async (card: PaymentCard) => {
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(card.copyValue);
        showToast(PAYMENT_CARDS_TEXT.copied(card.number), { title: 'Numéro copié ✓', type: 'success' });
        return;
      }
    } catch {
      // le téléphone refuse la copie : on montre le numéro pour le recopier à la main
    }
    showToast(PAYMENT_CARDS_TEXT.copyFailed(card.number), { title: 'Copie impossible', type: 'info' });
  };

  return (
    <View style={styles.box} testID="payment-info">
      <Text style={styles.title} testID="payment-info-title">{PAYMENT_CARDS_TEXT.title}</Text>
      <Text style={styles.intro} testID="payment-info-intro">{PAYMENT_CARDS_TEXT.intro}</Text>
      {cards.map((card) => (
        <View key={card.key} style={styles.card} testID={`payment-card-${card.key}`}>
          <View style={[styles.badge, { backgroundColor: BADGE[card.key] }]}>
            <Text style={styles.badgeText}>{card.name}</Text>
          </View>
          <Text style={styles.label}>{PAYMENT_CARDS_TEXT.numberLabel}</Text>
          <Text style={styles.number} selectable testID={`payment-card-${card.key}-number`}>{card.number}</Text>
          {card.holder ? (
            <Text style={styles.holder} testID={`payment-card-${card.key}-holder`}>{`${PAYMENT_CARDS_TEXT.holderLabel} : ${card.holder}`}</Text>
          ) : null}
          <Pressable
            style={styles.copyBtn}
            onPress={() => copy(card)}
            accessibilityRole="button"
            testID={`payment-card-${card.key}-copy`}
          >
            <Text style={styles.copyText}>📋 {PAYMENT_CARDS_TEXT.copy}</Text>
          </Pressable>
          {card.url ? (
            <Pressable
              style={styles.linkBtn}
              onPress={() => void Linking.openURL(card.url as string)}
              accessibilityRole="link"
              testID={`payment-card-${card.key}-link`}
            >
              <Text style={styles.linkText}>🔗 {PAYMENT_CARDS_TEXT.link}</Text>
            </Pressable>
          ) : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { marginTop: spacing.lg, gap: spacing.sm },
  title: { color: colors.cream, fontFamily: fonts.displayBold, fontSize: 17 },
  intro: { color: colors.creamMuted, fontFamily: fonts.body, fontSize: 12.5, lineHeight: 19 },
  card: {
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 6,
  },
  badge: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  badgeText: { color: '#FFFFFF', fontFamily: fonts.bodySemiBold, fontSize: 13 },
  label: { color: colors.creamMuted, fontFamily: fonts.body, fontSize: 12, marginTop: 4 },
  number: { color: colors.goldLight, fontFamily: fonts.displayBold, fontSize: 24, letterSpacing: 1 },
  holder: { color: colors.cream, fontFamily: fonts.bodyMedium, fontSize: 14 },
  copyBtn: {
    alignSelf: 'flex-start',
    backgroundColor: colors.panelAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.gold,
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginTop: 4,
  },
  copyText: { color: colors.goldLight, fontFamily: fonts.bodySemiBold, fontSize: 13 },
  linkBtn: { alignSelf: 'flex-start', paddingVertical: 6 },
  linkText: { color: colors.goldLight, fontFamily: fonts.bodyMedium, fontSize: 13, textDecorationLine: 'underline' },
});
