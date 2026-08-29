import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts, radius, spacing } from '../theme';
import { GoldButton } from '../components/GoldButton';

const formatXAF = (n: number) => `${n.toLocaleString('fr-FR')} FCFA`;

interface Props {
  route: RouteProp<RootStackParamList, 'OrderConfirmation'>;
}

export function OrderConfirmationScreen({ route }: Props) {
  const { orderId, total, instructions } = route.params;
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.icon}>🎉</Text>
        <Text style={styles.title}>Merci d'avoir acheté avec ALBASSE SHOPPING !</Text>
        <Text style={styles.subtitle}>
          Votre commande #{orderId.slice(0, 8)} a bien été enregistrée.
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Total à régler</Text>
          <Text style={styles.cardValue}>{formatXAF(total)}</Text>
        </View>

        {instructions ? (
          <View style={styles.instructionsBox}>
            <Text style={styles.instructionsText}>{instructions}</Text>
          </View>
        ) : null}

        <GoldButton
          label="Voir mes commandes"
          onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Orders' }] })}
          style={{ marginTop: spacing.xl, width: '100%' }}
        />
        <GoldButton
          label="Continuer mes achats"
          variant="outline"
          onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Tabs' }] })}
          style={{ marginTop: spacing.sm, width: '100%' }}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, paddingTop: spacing.xxl },
  icon: { fontSize: 56, marginBottom: spacing.md },
  title: {
    color: colors.goldLight,
    fontFamily: fonts.display,
    fontSize: 21,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtitle: {
    color: colors.creamFaint,
    fontFamily: fonts.body,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  card: {
    backgroundColor: colors.panel,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.gold,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
  },
  cardLabel: { color: colors.creamMuted, fontFamily: fonts.bodyMedium, fontSize: 12 },
  cardValue: { color: colors.goldLight, fontFamily: fonts.displayBold, fontSize: 26, marginTop: 4 },
  instructionsBox: {
    backgroundColor: colors.panelAlt,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.lg,
    width: '100%',
  },
  instructionsText: { color: colors.cream, fontFamily: fonts.body, fontSize: 13, lineHeight: 19, textAlign: 'center' },
});
