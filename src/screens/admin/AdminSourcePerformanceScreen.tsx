import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl } from 'react-native';
import { useAuthStore } from '../../store/authStore';
import { useSourcePerformance, PERIOD_LABELS, SOURCE_STYLE, type Period } from '../../hooks/useSourcePerformance';
import { formatDuration } from '../../lib/formatDuration';
import { sharePercent } from '../../lib/visitStats';
import { hostHint } from '../../lib/sourceReport';
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
    totals,
    attribution,
    setAttribution,
    hasFirstVisit,
    unattributed,
    otherHosts,
    isLoading,
    refresh,
  } = useSourcePerformance();
  // les « vrais visiteurs » existent seulement quand add-source-report.sql est lancé (sinon, l'ancien calcul de la page : sans cette partie)
  const hasReal = rows.some((r) => r.realVisitors !== undefined);

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
      <ScrollView
        contentContainerStyle={{ padding: spacing.md, paddingBottom: 60 }}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refresh} tintColor={colors.gold} />}
      >
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
            {totals ? (
              <Text style={styles.totals} testID="source-totals">
                {`Sur la période : ${totals.sessions} visites · ${totals.visitors} visiteurs · ${totals.realVisitors} vrais visiteurs (${sharePercent(totals.realVisitors, totals.visitors)}). Un vrai visiteur reste 20 secondes ou plus, voit 2 pages ou plus, ou est connecté.`}
              </Text>
            ) : null}
            {/* comment ranger les ventes (21 novembre 2026) : la première visite du client, ou la visite où il a commandé */}
            {hasFirstVisit ? (
              <View style={styles.attributionBox} testID="source-attribution">
                <Text style={styles.attributionLabel}>Ranger les ventes selon :</Text>
                <View style={styles.segment}>
                  {(
                    [
                      ['first', '🧭 Première visite'],
                      ['order', '🛒 Visite de la commande'],
                    ] as const
                  ).map(([mode, label]) => (
                    <Pressable
                      key={mode}
                      style={[styles.segmentItem, attribution === mode && styles.segmentItemActive]}
                      onPress={() => setAttribution(mode)}
                      accessibilityRole="button"
                      aria-selected={attribution === mode}
                      testID={`source-attribution-${mode}`}
                    >
                      <Text style={[styles.segmentText, attribution === mode && styles.segmentTextActive]}>{label}</Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={styles.attributionHint}>
                  {attribution === 'first'
                    ? 'Première visite : la vente va à la source où le client est venu la toute première fois. Exemple : il voit votre vidéo TikTok, il revient 2 jours après et commande → la vente compte pour TikTok.'
                    : 'Visite de la commande : la vente va à la source de la visite pendant laquelle le client a commandé.'}
                </Text>
              </View>
            ) : null}

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
                      {r.checkoutSite !== undefined ? (
                        <>
                          <Metric icon="👆" label="« Commander » sur le site" value={String(r.checkoutSite)} testID={`source-checkout-site-${r.source}`} />
                          <Metric icon="💬" label="« Commander » sur WhatsApp" value={String(r.checkoutWhatsapp ?? 0)} testID={`source-checkout-whatsapp-${r.source}`} />
                          {r.cartAdds - r.checkoutSite - (r.checkoutWhatsapp ?? 0) > 0 ? (
                            <Metric icon="🛒" label="« Commander » (avant la mise à jour)" value={String(r.cartAdds - r.checkoutSite - (r.checkoutWhatsapp ?? 0))} />
                          ) : null}
                        </>
                      ) : (
                        <Metric icon="🛒" label="Clics « Commander »" value={String(r.cartAdds)} />
                      )}
                      <Metric icon="💳" label="Commandes livrées" value={String(r.orders)} testID={`source-orders-${r.source}`} />
                      <Metric icon="💰" label="Chiffre d'affaires" value={formatXAF(r.revenue)} testID={`source-revenue-${r.source}`} />
                      <Metric icon="📈" label="Conversion" value={`${r.conversionRate.toFixed(1)}%`} highlight />
                      {r.realVisitors !== undefined ? (
                        <>
                          <Metric icon="✅" label="Vrais visiteurs" value={String(r.realVisitors)} testID={`source-real-${r.source}`} />
                          <Metric icon="🎯" label="Part de vrais" value={sharePercent(r.realVisitors, r.visitors)} />
                        </>
                      ) : null}
                    </View>
                  </View>
                );
              })}
              {unattributed ? (
                <Text style={styles.note} testID="source-unattributed">
                  {unattributed.orders > 0
                    ? `📦 ${unattributed.orders} commande${unattributed.orders > 1 ? 's' : ''} livrée${unattributed.orders > 1 ? 's' : ''} sans visite connue (passée${unattributed.orders > 1 ? 's' : ''} par WhatsApp ou ajoutée${unattributed.orders > 1 ? 's' : ''} à la main) : ${formatXAF(unattributed.revenue)}. `
                    : ''}
                  Les clics « Commander sur WhatsApp » ne deviennent des ventes que si la commande est ajoutée dans l'admin et passée en « Livrée ».
                </Text>
              ) : null}
            </Section>

            {otherHosts ? (
              <Section title="🔎 D'où viennent les visiteurs « Autre » ?">
                {otherHosts.length === 0 ? (
                  <Text style={styles.emptyText}>Aucun visiteur « Autre » sur cette période.</Text>
                ) : (
                  otherHosts.map((h) => (
                    <View key={h.label ?? '—'} style={styles.hostRow} testID={`source-other-host-${h.label ?? 'inconnu'}`}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.hostName}>{h.label ?? 'Inconnu'}</Text>
                        {hostHint(h.label) ? <Text style={styles.hostHint}>{hostHint(h.label)}</Text> : null}
                      </View>
                      <Text style={styles.hostCount}>{h.visitors}</Text>
                    </View>
                  ))
                )}
                <Text style={styles.hostFoot}>
                  Le site note seulement le nom du site ou de l'appli d'où vient le visiteur, jamais rien de personnel. Visible pour les nouvelles visites, depuis la mise à jour du 21 novembre 2026.
                </Text>
              </Section>
            ) : null}

            <Section title="📊 Tableau comparatif">
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View>
                  <View style={styles.tableHeaderRow}>
                    <Text style={[styles.tableHeaderCell, { width: 130 }]}>Source</Text>
                    <Text style={[styles.tableHeaderCell, { width: 70 }]}>Visiteurs</Text>
                    <Text style={[styles.tableHeaderCell, { width: 70 }]}>Nouv.</Text>
                    {hasReal ? <Text style={[styles.tableHeaderCell, { width: 70 }]}>Vrais</Text> : null}
                    <Text style={[styles.tableHeaderCell, { width: 80 }]}>Vus</Text>
                    <Text style={[styles.tableHeaderCell, { width: 70 }]}>Clics cmd</Text>
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
                        {hasReal ? <Text style={[styles.tableCell, { width: 70 }]}>{r.realVisitors ?? 0}</Text> : null}
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
                  <View key={c.campaign} style={styles.campaignRow} testID={`source-campaign-${c.campaign}`}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.campaignName}>{c.campaign}</Text>
                      <Text style={styles.campaignMeta}>
                        {SOURCE_STYLE[c.source].emoji} {c.source}
                        {c.medium ? ` · ${c.medium}` : ''}
                      </Text>
                      <Text style={styles.campaignMeta}>
                        {c.visitors} visiteur(s)
                        {c.realVisitors !== undefined ? ` · ${c.realVisitors} vrai(s) (${sharePercent(c.realVisitors, c.visitors)})` : ''} · {c.orders} cmd · {c.conversionRate.toFixed(1)}%
                      </Text>
                    </View>
                    <Text style={styles.campaignRevenue}>{formatXAF(c.revenue)}</Text>
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

function Metric({ icon, label, value, highlight, testID }: { icon: string; label: string; value: string; highlight?: boolean; testID?: string }) {
  return (
    <View style={styles.metric} testID={testID}>
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
  totals: { color: colors.creamMuted, fontFamily: fonts.body, fontSize: 11, lineHeight: 16, backgroundColor: colors.panel, borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.md },
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
  campaignRevenue: { color: colors.goldLight, fontFamily: fonts.bodyBold, fontSize: 13, marginLeft: spacing.sm },
  attributionBox: { backgroundColor: colors.panel, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.sm, marginBottom: spacing.md, gap: 8 },
  attributionLabel: { color: colors.cream, fontFamily: fonts.bodyBold, fontSize: 13 },
  segment: { flexDirection: 'row', backgroundColor: colors.background, borderRadius: radius.md, padding: 3, gap: 3 },
  segmentItem: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 9, paddingHorizontal: 4, borderRadius: radius.sm },
  segmentItemActive: { backgroundColor: colors.gold },
  segmentText: { color: colors.creamMuted, fontFamily: fonts.bodySemiBold, fontSize: 12, textAlign: 'center' },
  segmentTextActive: { color: colors.background, fontFamily: fonts.bodyBold },
  attributionHint: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 11, lineHeight: 16 },
  note: { color: colors.creamMuted, fontFamily: fonts.body, fontSize: 11.5, lineHeight: 17, backgroundColor: colors.panel, borderRadius: radius.md, padding: spacing.sm },
  hostRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.panel, borderRadius: radius.md, padding: spacing.sm, gap: 10 },
  hostName: { color: colors.cream, fontFamily: fonts.bodySemiBold, fontSize: 13 },
  hostHint: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 11, marginTop: 2 },
  hostCount: { color: colors.goldLight, fontFamily: fonts.bodyBold, fontSize: 14 },
  hostFoot: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 11, lineHeight: 16 },
});
