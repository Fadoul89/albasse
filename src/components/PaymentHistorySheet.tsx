// L'historique des paiements d'un affilié (bouton « Déjà payé ») : dans l'espace affilié et dans l'admin › Affiliés.
// Un paiement = les commissions marquées payées le même jour (voir paymentHistory dans src/lib/affiliateStats.ts).
import React from 'react';
import { Modal, View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fonts, radius, spacing } from '../theme';
import { orderCountLabel, orderRef, type PaymentHistory } from '../lib/affiliateStats';

const formatXAF = (n: number) => `${n.toLocaleString('fr-FR')} FCFA`;

interface Props {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  totalLabel: string; // « Total reçu » (affilié) / « Total payé » (admin)
  sideLines: string[]; // à droite du total : « 3 paiements », « sur Mobile Money … » / « Reste à payer : … »
  history: PaymentHistory;
  // admin : l'heure du paiement et le montant de chaque commande ; affilié : « ✓ Payé »
  detailed?: boolean;
}

export function PaymentHistorySheet({ visible, onClose, title, subtitle, totalLabel, sideLines, history, detailed }: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Fermer l'historique" />
        <View style={styles.sheet} testID="payment-history">
          <View style={styles.grab} />
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={2}>
              💳 {title}
            </Text>
            <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Fermer">
              <Text style={styles.close}>✕</Text>
            </Pressable>
          </View>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}

          <LinearGradient colors={colors.goldGradient} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.totalCard}>
            <View>
              <Text style={styles.totalLabel}>{totalLabel}</Text>
              <Text style={styles.totalValue}>{formatXAF(history.total)}</Text>
            </View>
            <View style={styles.totalSide}>
              {sideLines.map((l) => (
                <Text key={l} style={styles.totalSideText}>
                  {l}
                </Text>
              ))}
            </View>
          </LinearGradient>

          <ScrollView style={styles.list} contentContainerStyle={{ paddingBottom: spacing.md }}>
            {history.payments.length === 0 ? (
              <Text style={styles.empty}>Aucun paiement pour le moment.</Text>
            ) : (
              history.payments.map((p) => (
                <View key={p.key} style={styles.payment} testID="payment-row">
                  <View style={styles.paymentTop}>
                    <Text style={styles.paymentDate}>
                      {p.dateLabel}
                      {detailed && p.timeLabel ? ` · ${p.timeLabel}` : ''}
                    </Text>
                    <Text style={styles.paymentAmount}>{formatXAF(p.total)}</Text>
                  </View>
                  <Text style={styles.paymentOrders}>
                    {orderCountLabel(p.orders.length)} :{' '}
                    {p.orders
                      .map((o) => (detailed && o.order_total != null ? `${orderRef(o)} (${formatXAF(o.order_total)})` : orderRef(o)))
                      .join(' · ')}
                  </Text>
                  {!detailed ? <Text style={styles.paid}>✓ Payé</Text> : null}
                </View>
              ))
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(3, 14, 45, 0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.panel,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: 1,
    borderColor: 'rgba(199, 154, 62, 0.5)',
    paddingHorizontal: spacing.md,
    paddingTop: 10,
    maxHeight: '82%',
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  grab: { width: 42, height: 4, borderRadius: 2, backgroundColor: colors.decorFaint, alignSelf: 'center', marginBottom: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  title: { flex: 1, color: colors.cream, fontFamily: fonts.display, fontSize: 17 },
  close: { color: colors.creamMuted, fontFamily: fonts.bodyBold, fontSize: 18 },
  subtitle: { color: colors.creamMuted, fontFamily: fonts.body, fontSize: 11, marginTop: 4 },
  totalCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, marginVertical: 12, gap: 10 },
  totalLabel: { color: colors.background, fontFamily: fonts.bodySemiBold, fontSize: 11 },
  totalValue: { color: colors.background, fontFamily: fonts.bodyBold, fontSize: 20 },
  totalSide: { flexShrink: 1, alignItems: 'flex-end' },
  totalSideText: { color: colors.background, fontFamily: fonts.bodySemiBold, fontSize: 11, textAlign: 'right' },
  list: { flexGrow: 0 },
  empty: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 12, textAlign: 'center', marginVertical: 24 },
  payment: { backgroundColor: colors.panelAlt, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 11, marginBottom: 8 },
  paymentTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  paymentDate: { color: colors.cream, fontFamily: fonts.bodyBold, fontSize: 13, flexShrink: 1 },
  paymentAmount: { color: colors.goldLight, fontFamily: fonts.bodyBold, fontSize: 13 },
  paymentOrders: { color: colors.creamMuted, fontFamily: fonts.body, fontSize: 11, marginTop: 5, lineHeight: 16 },
  paid: { color: colors.successText, fontFamily: fonts.bodyBold, fontSize: 11, marginTop: 2 },
});
