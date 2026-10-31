// Admin › Clients : l'analyse par genre. Pour les hommes, les femmes et ceux qui n'ont pas précisé : combien de clients, combien ont commandé,
// combien de commandes, le montant des ventes et la moyenne par client. Les chiffres viennent des mêmes clients que le reste de l'écran
// (voir lib/clientGender.ts : genderSummary). Rien n'est deviné : « Non précisé » tant que le client n'a pas choisi.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts, radius, spacing } from '../theme';
import { GENDER_ICON, GENDER_LABEL, averagePerClient, genderSummary, percent, type GenderCustomer, type GenderKey } from '../lib/clientGender';

const formatXAF = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} FCFA`;

const ROWS: { key: GenderKey; icon: string; label: string }[] = [
  { key: 'homme', icon: GENDER_ICON.homme, label: `${GENDER_LABEL.homme}s` },
  { key: 'femme', icon: GENDER_ICON.femme, label: `${GENDER_LABEL.femme}s` },
  { key: 'unknown', icon: '❔', label: 'Non précisé' },
];

export function GenderStatsCard({ customers }: { customers: GenderCustomer[] }) {
  const summary = genderSummary(customers);
  return (
    <View style={styles.card} testID="gender-stats">
      <Text style={styles.title}>👫 Analyse par genre</Text>
      <Text style={styles.sub} testID="gender-stats-known">
        {`Genre connu pour ${summary.known} client${summary.known > 1 ? 's' : ''} sur ${summary.total} (${percent(summary.known, summary.total)}).`}
      </Text>
      {ROWS.map(({ key, icon, label }) => {
        const b = summary.buckets[key];
        return (
          <View key={key} style={styles.group} testID={`gender-stat-${key}`}>
            <View style={styles.head}>
              <Text style={styles.name}>{`${icon} ${label}`}</Text>
              <Text style={styles.count} testID={`gender-stat-${key}-clients`}>
                {`${b.clients} client${b.clients > 1 ? 's' : ''} · ${percent(b.clients, summary.total)}`}
              </Text>
            </View>
            <View style={styles.bar}>
              <View style={[styles.barFill, key === 'unknown' && styles.barFillUnknown, { width: `${summary.total > 0 ? Math.round((b.clients / summary.total) * 100) : 0}%` }]} />
            </View>
            <Text style={styles.line} testID={`gender-stat-${key}-orders`}>
              {`🛒 ${b.withOrders} ont commandé (${percent(b.withOrders, b.clients)}) · ${b.orders} commande${b.orders > 1 ? 's' : ''}`}
            </Text>
            <Text style={styles.line} testID={`gender-stat-${key}-sales`}>
              {`💰 Ventes : ${formatXAF(b.revenue)} · moyenne par client : ${formatXAF(averagePerClient(b.revenue, b.clients))}`}
            </Text>
          </View>
        );
      })}
      {summary.buckets.unknown.clients > 0 ? (
        <Text style={styles.hint}>
          Les clients « Non précisé » : Zara leur demande une fois sur l'accueil. Vous pouvez aussi choisir Homme ou Femme sur la fiche du client.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.panelAlt,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  title: { color: colors.goldLight, fontFamily: fonts.bodySemiBold, fontSize: 15, marginBottom: 2 },
  sub: { color: colors.creamMuted, fontFamily: fonts.body, fontSize: 12, marginBottom: spacing.sm },
  group: { marginTop: spacing.sm },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 },
  name: { color: colors.cream, fontFamily: fonts.bodySemiBold, fontSize: 14 },
  count: { color: colors.goldLight, fontFamily: fonts.bodySemiBold, fontSize: 13 },
  bar: { height: 6, borderRadius: 3, backgroundColor: colors.panel, overflow: 'hidden', marginTop: 4, marginBottom: 4 },
  barFill: { height: 6, borderRadius: 3, backgroundColor: colors.gold },
  barFillUnknown: { backgroundColor: colors.creamFaint },
  line: { color: colors.creamMuted, fontFamily: fonts.body, fontSize: 12, lineHeight: 18 },
  hint: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 11, lineHeight: 16, marginTop: spacing.md },
});
