import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts } from '../theme';
import type { OrderStatus } from '../types';

const STEPS: { status: OrderStatus; label: string }[] = [
  { status: 'paid', label: 'Confirmée' },
  { status: 'processing', label: 'En préparation' },
  { status: 'shipped', label: 'Expédiée' },
  { status: 'delivered', label: 'Livrée' },
];

export function OrderStatusStepper({ status }: { status: OrderStatus }) {
  if (status === 'cancelled') {
    return (
      <View style={styles.cancelledBox}>
        <Text style={styles.cancelledText}>✕ Commande annulée</Text>
      </View>
    );
  }

  const currentIndex = STEPS.findIndex((s) => s.status === status);

  return (
    <View style={styles.row}>
      {STEPS.map((step, i) => {
        const reached = currentIndex >= i;
        const isLast = i === STEPS.length - 1;
        return (
          <View key={step.status} style={styles.stepWrap}>
            <View style={styles.stepColumn}>
              <View style={[styles.dot, reached && styles.dotActive]}>
                {reached && <Text style={styles.dotCheck}>✓</Text>}
              </View>
              <Text style={[styles.stepLabel, reached && styles.stepLabelActive]} numberOfLines={1}>
                {step.label}
              </Text>
            </View>
            {!isLast && <View style={[styles.connector, currentIndex > i && styles.connectorActive]} />}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', marginVertical: 8 },
  stepWrap: { flexDirection: 'row', alignItems: 'flex-start', flex: 1 },
  stepColumn: { alignItems: 'center', width: 60 },
  dot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.panel,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotActive: { borderColor: colors.gold, backgroundColor: colors.gold },
  dotCheck: { color: colors.background, fontSize: 11, fontFamily: fonts.bodyBold },
  stepLabel: {
    color: colors.creamFaint,
    fontFamily: fonts.body,
    fontSize: 9,
    marginTop: 4,
    textAlign: 'center',
  },
  stepLabelActive: { color: colors.goldLight, fontFamily: fonts.bodySemiBold },
  connector: {
    flex: 1,
    height: 1.5,
    backgroundColor: colors.border,
    marginTop: 10,
    marginHorizontal: -8,
  },
  connectorActive: { backgroundColor: colors.gold },
  cancelledBox: { paddingVertical: 8 },
  cancelledText: { color: colors.red, fontFamily: fonts.bodySemiBold, fontSize: 13 },
});
