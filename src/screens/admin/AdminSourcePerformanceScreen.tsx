import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useAuthStore } from '../../store/authStore';
import { useSourcePerformance, PERIOD_LABELS, SOURCE_STYLE, type Period } from '../../hooks/useSourcePerformance';
import { formatDuration } from '../../lib/formatDuration';
import { colors, fonts, radius, spacing } from '../../theme';
import { ScreenHeader } from '../../components/ScreenHeader';
import { DateField } from '../../components/DateField';

const formatXAF = (n: number) => `${n.toLocaleString('fr-FR')} FCFA`;

const PERIOD_ORDER: Period[] = ['today', 'yesterday', '7d', '30d', 'month', 'lastMonth', 'custom'];

export function AdminSourcePerformanceScreen() {
  const profile = useAuthStore((s) => s.profile);
  const {
    period,
    setPeriod,
    customStart,
    setCustomStart,
    customEnd,
    setCustomEnd,
    rows,
    campaigns,
    leaderboard,
    isLoading,
  } = useSourcePerformance();

  if (!profile?.is_admin) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Admin" showBack />
        <Text style={styles.denied}>Accès réservé aux administrateurs.</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Performance par source" showBack />
      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 60 }}>
        <Text style={styles.privacyNote}>
          🔒 Ces statistiques proviennent d'outils de mesure d'audience internes (sessions, pages et produits
          consultés). Aucune donnée personnelle sensible n'est collectée ; les visiteurs sont informés de ce suivi
          lors de leur navigation sur le site.
        </Text>

        <View style={styles.periodRow}>
          {PERIOD_ORDER.map((p) => (
            <Pressable
              key={p}
              style={[styles.periodChip, period === p && styles.periodChipActive]}
              onPress={() => setPeriod(p)}
            >
              <Text style={[styles.periodChipText, period === p && styles.periodChipTextActive]}>
                {PERIOD_LABELS[p]}
              </Text>
            </Pressable>
          ))}
        </View>

        {period === 'custom' && (
          <View style={styles.customRange}>
            <View style={{ flex: 1 }}>
              <DateField label="Du" value={customStart} onChange={setCustomStart} />
            </View>
            <View style={{ flex: 1 }}>
              <DateField label="Au" value={customEnd} onChange={setCustomEnd} />
            </View>
          </View>
        )}

        {isLoading ? (
          <Text style={styles.loading}>Chargement…</Text>
        ) : (
          <>
            <Section title="🔥 Classement automatique">
              <RankFact icon="🏆" label="Meilleure source en ventes" value={leaderboard.bestSales} />
              <RankFact icon="👑" label="Meilleur taux de conversion" value={leaderboard.bestConversion} />
              <RankFact icon="👀" label="Plus de visiteurs" value={leaderboard.mostVisitors} />
              <RankFact icon="⏱️" label="Plus long temps moyen" value={leaderboard.longestAvgTime} />
            </Section>

            <Section title="📈 Performance par source">
              {rows.map((r) => {
                const style = SOURCE_STYLE[r.source];
                return (
                  <View key={r.source} style={[styles.sourceCard, { borderColor: style.color }]}>
                    <Text style={[styles.sourceTitle, { color: style.color }]}>
                      {style.emoji} {r.source}
                    </Text>
                    <View style={styles.metricsGrid}>
                      <Metric icon="👀" label="Visiteurs" value={String(r.visitors)} />
                      <Metric icon="🆕" label="Nouveaux" value={String(r.newVisitors)} />
                      <Metric icon="🔄" label="Revenants" value={String(r.returningVisitors)} />
                      <Metric icon="⏱️" label="Temps moyen" value={formatDuration(r.avgTimeSeconds)} />
                      <Metric icon="📄" label="Pages vues" value={String(r.pagesViewed)} />
                      <Metric icon="🛍️" label="Produits vus" value={String(r.productViews)} />
                      <Metric icon="🛒" label="Paniers" value={String(r.cartAdds)} />
                      <Metric icon="💳" label="Commandes" value={String(r.orders)} />
                      <Metric icon="💰" label="Chiffre d'affaires" value={formatXAF(r.revenue)} />
                      <Metric icon="📈" label="Conversion" value={`${r.conversionRate.toFixed(1)}%`} highlight />
                    </View>
                  </View>
                );
              })}
            </Section>

            <Section title="📊 Tableau comparatif">
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View>
                  <View style={styles.tableHeaderRow}>
                    <Text style={[styles.tableHeaderCell, { width: 130 }]}>Source</Text>
                    <Text style={[styles.tableHeaderCell, { width: 70 }]}>Visiteurs</Text>
                    <Text style={[styles.tableHeaderCell, { width: 70 }]}>Nouv.</Text>
                    <Text style={[styles.tableHeaderCell, { width: 80 }]}>Vus</Text>
                    <Text style={[styles.tableHeaderCell, { width: 70 }]}>Panier</Text>
                    <Text style={[styles.tableHeaderCell, { width: 80 }]}>Cmds</Text>
                    <Text style={[styles.tableHeaderCell, { width: 110 }]}>CA</Text>
                    <Text style={[styles.tableHeaderCell, { width: 70 }]}>Conv.</Text>
                  </View>
                  {rows.map((r) => {
                    const style = SOURCE_STYLE[r.source];
                    return (
                      <View key={r.source} style={styles.tableRow}>
                        <Text style={[styles.tableCell, { width: 130, fontFamily: fonts.bodySemiBold }]}>
                          {style.emoji} {r.source}
                        </Text>
                        <Text style={[styles.tableCell, { width: 70 }]}>{r.visitors}</Text>
                        <Text style={[styles.tableCell, { width: 70 }]}>{r.newVisitors}</Text>
                        <Text style={[styles.tableCell, { width: 80 }]}>{r.productViews}</Text>
                        <Text style={[styles.tableCell, { width: 70 }]}>{r.cartAdds}</Text>
                        <Text style={[styles.tableCell, { width: 80 }]}>{r.orders}</Text>
                        <Text style={[styles.tableCell, { width: 110 }]}>{formatXAF(r.revenue)}</Text>
                        <Text style={[styles.tableCell, { width: 70, color: colors.goldLight, fontFamily: fonts.bodyBold }]}>
                          {r.conversionRate.toFixed(1)}%
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </ScrollView>
            </Section>

            <Section title="🎯 Détail des campagnes (UTM)">
              {campaigns.length === 0 ? (
                <Text style={styles.emptyText}>Aucune campagne UTM détectée sur cette période.</Text>
              ) : (
                campaigns.map((c) => (
                  <View key={c.campaign} style={styles.campaignRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.campaignName}>{c.campaign}</Text>
                      <Text style={styles.campaignMeta}>
                        {SOURCE_STYLE[c.source].emoji} {c.source}
                        {c.medium ? ` · ${c.medium}` : ''}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.campaignRevenue}>{formatXAF(c.revenue)}</Text>
                      <Text style={styles.campaignMeta}>
                        {c.visitors} visiteur(s) · {c.orders} cmd · {c.conversionRate.toFixed(1)}%
                      </Text>
                    </View>
                  </View>
                ))
              )}
            </Section>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function RankFact({ icon, label, value }: { icon: string; label: string; value: string | null }) {
  const style = value ? SOURCE_STYLE[value as keyof typeof SOURCE_STYLE] : null;
  return (
    <View style={styles.rankFactRow}>
      <Text style={styles.rankFactIcon}>{icon}</Text>
      <Text style={styles.rankFactLabel}>{label}</Text>
      <Text style={[styles.rankFactValue, style && { color: style.color }]}>
        {value ? `${style?.emoji ?? ''} ${value}` : '—'}
      </Text>
    </View>
  );
}

function Metric({ icon, label, value, highlight }: { icon: string; label: string; value: string; highlight?: boolean }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricIcon}>{icon}</Text>
      <Text style={[styles.metricValue, highlight && { color: colors.goldLight }]}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  denied: { color: colors.creamFaint, fontFamily: fonts.body, textAlign: 'center', marginTop: 40 },
  loading: { color: colors.creamFaint, fontFamily: fonts.body, textAlign: 'center', marginTop: 40 },
  privacyNote: {
    color: colors.creamMuted,
    fontFamily: fonts.body,
    fontSize: 11,
    lineHeight: 16,
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  periodRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: spacing.sm },
  periodChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
  },
  periodChipActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  periodChipText: { color: colors.creamMuted, fontFamily: fonts.bodyMedium, fontSize: 12 },
  periodChipTextActive: { color: colors.background, fontFamily: fonts.bodyBold },
  customRange: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  section: { marginBottom: spacing.lg },
  sectionTitle: { color: colors.cream, fontFamily: fonts.display, fontSize: 16, marginBottom: spacing.sm },
  sectionBody: { gap: spacing.sm },
  emptyText: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 12, padding: spacing.sm },
  rankFactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    padding: spacing.sm,
    gap: 10,
  },
  rankFactIcon: { fontSize: 18 },
  rankFactLabel: { flex: 1, color: colors.creamMuted, fontFamily: fonts.bodyMedium, fontSize: 12 },
  rankFactValue: { color: colors.cream, fontFamily: fonts.bodyBold, fontSize: 13 },
  sourceCard: {
    backgroundColor: colors.panel,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
  },
  sourceTitle: { fontFamily: fonts.displayBold, fontSize: 15, marginBottom: spacing.sm },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metric: { width: '31%', alignItems: 'center', backgroundColor: colors.panelAlt, borderRadius: radius.sm, paddingVertical: 8 },
  metricIcon: { fontSize: 14, marginBottom: 2 },
  metricValue: { color: colors.cream, fontFamily: fonts.bodyBold, fontSize: 13 },
  metricLabel: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 9, textAlign: 'center', marginTop: 2 },
  tableHeaderRow: { flexDirection: 'row', paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: colors.border },
  tableHeaderCell: { color: colors.creamFaint, fontFamily: fonts.bodySemiBold, fontSize: 10, textTransform: 'uppercase' },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tableCell: { color: colors.creamMuted, fontFamily: fonts.body, fontSize: 12 },
  campaignRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  campaignName: { color: colors.cream, fontFamily: fonts.bodySemiBold, fontSize: 13 },
  campaignMeta: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 10, marginTop: 2 },
  campaignRevenue: { color: colors.goldLight, fontFamily: fonts.bodyBold, fontSize: 13 },
});
