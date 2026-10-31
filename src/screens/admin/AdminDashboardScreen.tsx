import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { useAuthStore } from '../../store/authStore';
import { useDashboardStats } from '../../hooks/useDashboardStats';
import { colors, fonts, radius, spacing } from '../../theme';
import { ScreenHeader } from '../../components/ScreenHeader';
import { NotificationBell } from '../../components/NotificationBell';
import { AdminMenuGroups } from '../../components/AdminMenuGroups';
import { campaignLabel, realVisitsLabel, sharePercent } from '../../lib/visitStats';

const formatXAF = (n: number) => `${n.toLocaleString('fr-FR')} FCFA`;

export function AdminDashboardScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const profile = useAuthStore((s) => s.profile);
  const { stats, isLoading, refresh } = useDashboardStats();

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
      <ScreenHeader title="Tableau de bord" showBack right={<NotificationBell />} />
      <ScrollView
        contentContainerStyle={{ padding: spacing.md, paddingBottom: 60 }}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refresh} tintColor={colors.gold} />}
      >
        <AdminMenuGroups />

        {isLoading && !stats ? (
          <Text style={styles.loading}>Chargement…</Text>
        ) : stats ? (
          <>
            <View style={styles.statsGrid}>
              <StatCard icon="💰" label="CA livré aujourd'hui" value={formatXAF(stats.revenueToday)} />
              <StatCard icon="🛒" label="Commandes livrées aujourd'hui" value={String(stats.ordersToday)} />
              <StatCard icon="👥" label="Nouveaux clients" value={String(stats.newCustomersToday)} />
              <StatCard icon="👀" label="Visiteurs aujourd'hui" value={String(stats.visitorsToday)} testID="dashboard-visitors" />
              {stats.visitQuality && (
                <StatCard icon="✅" label="Vraies visites aujourd'hui" value={String(stats.visitQuality.realVisitors)} testID="dashboard-real-visits" />
              )}
              <StatCard icon="📱" label="Raccourcis installés (total)" value={String(stats.appInstallsTotal)} />
            </View>
            {stats.visitQuality && (
              <Text style={styles.downloadsToday} testID="dashboard-real-help">
                {`Vraie visite = la personne reste 20 secondes ou plus, voit 2 pages ou plus, ou est connectée. Aujourd'hui : ${realVisitsLabel(stats.visitQuality.realVisitors, stats.visitQuality.visitors)} visiteurs.`}
              </Text>
            )}
            <Text style={styles.downloadsToday} testID="dashboard-received">
              {`📥 ${stats.ordersReceivedToday} commande(s) reçue(s) aujourd'hui : comptées une fois livrées (les fausses commandes ne comptent jamais)`}
            </Text>
            <Text style={styles.downloadsToday}>
              dont {stats.appInstallsToday} aujourd'hui · {stats.appDownloadClicksTotal} clic(s) sur "Installer"
            </Text>

            {stats.shortcutsByDevice.length > 0 && (
              <Section title="💻 Raccourcis par appareil">
                {stats.shortcutsByDevice.map((d) => (
                  <View key={d.browser} style={styles.stockRow}>
                    <Text style={styles.stockName}>{d.browser}</Text>
                    <Text style={styles.rankValue}>{d.count} install{d.count > 1 ? 's' : ''}</Text>
                  </View>
                ))}
              </Section>
            )}

            {stats.shortcutsByBrowser.length > 0 && (
              <Section title="🌐 Raccourcis par navigateur">
                {stats.shortcutsByBrowser.map((b) => (
                  <View key={b.browser} style={styles.stockRow}>
                    <Text style={styles.stockName}>{b.browser}</Text>
                    <Text style={styles.rankValue}>{b.count} install{b.count > 1 ? 's' : ''}</Text>
                  </View>
                ))}
              </Section>
            )}

            <Section title="🔥 Produits les plus consultés">
              {stats.mostViewedProducts.length === 0 ? (
                <Text style={styles.emptyText}>Pas encore de données.</Text>
              ) : (
                stats.mostViewedProducts.map((p, i) => (
                  <RankRow key={p.product_id} rank={i + 1} label={p.name} value={`${p.count} vue(s)`} />
                ))
              )}
            </Section>

            <Section title="⭐ Produits les plus vendus">
              {stats.bestSellingProducts.length === 0 ? (
                <Text style={styles.emptyText}>Pas encore de ventes.</Text>
              ) : (
                stats.bestSellingProducts.map((p, i) => (
                  <RankRow key={p.product_id} rank={i + 1} label={p.name} value={`${p.count} vendu(s)`} />
                ))
              )}
            </Section>

            <Section title="📦 Stock faible">
              {stats.lowStockProducts.length === 0 ? (
                <Text style={styles.emptyText}>Tous les stocks sont suffisants. ✓</Text>
              ) : (
                stats.lowStockProducts.map((p) => (
                  <View key={p.id} style={styles.stockRow}>
                    <Text style={styles.stockName} numberOfLines={1}>
                      {p.name}
                    </Text>
                    <Text style={[styles.stockValue, p.stock === 0 && styles.stockZero]}>
                      {p.stock === 0 ? 'Rupture' : `${p.stock} restant(s)`}
                    </Text>
                  </View>
                ))
              )}
            </Section>

            <Pressable
              style={styles.sourceLinkCard}
              onPress={() => navigation.navigate('AdminSourcePerformance')}
            >
              <Text style={styles.sourceLinkIcon}>📡</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.sourceLinkTitle}>Performance par source — vue détaillée</Text>
                <Text style={styles.sourceLinkSubtitle}>
                  Visiteurs séparés par plateforme, nouveaux/revenants, classement, campagnes UTM
                </Text>
              </View>
              <Text style={styles.sourceLinkArrow}>→</Text>
            </Pressable>

            <Pressable style={styles.sourceLinkCard} onPress={() => navigation.navigate('AdminZaraStats')} testID="dashboard-zara-link">
              <Text style={styles.sourceLinkIcon}>💬</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.sourceLinkTitle}>Statistiques de Zara</Text>
                <Text style={styles.sourceLinkSubtitle}>
                  Ventes, comptes créés et installations grâce à Zara, iPhone / Android
                </Text>
              </View>
              <Text style={styles.sourceLinkArrow}>→</Text>
            </Pressable>

            <Pressable style={styles.sourceLinkCard} onPress={() => navigation.navigate('AdminBrowsing')} testID="dashboard-browsing-link">
              <Text style={styles.sourceLinkIcon}>🔎</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.sourceLinkTitle}>Suivi de navigation</Text>
                <Text style={styles.sourceLinkSubtitle}>
                  Les articles regardés par les visiteurs, le niveau d'intérêt, les recherches, les suggestions de Zara
                </Text>
              </View>
              <Text style={styles.sourceLinkArrow}>→</Text>
            </Pressable>

            <Pressable style={styles.sourceLinkCard} onPress={() => navigation.navigate('AdminCallbacks')} testID="dashboard-callbacks-link">
              <Text style={styles.sourceLinkIcon}>📲</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.sourceLinkTitle}>Rappels WhatsApp</Text>
                <Text style={styles.sourceLinkSubtitle}>
                  Les clients qui ont laissé leur numéro à Zara : à écrire au réveil
                </Text>
              </View>
              <Text style={styles.sourceLinkArrow}>→</Text>
            </Pressable>

            {stats.visitQuality && stats.visitQuality.bySource.length > 0 && (
              <Section title="🎯 Qualité des visites (aujourd'hui)">
                <View style={styles.sourceHeaderRow}>
                  <Text style={[styles.sourceHeaderCell, { flex: 2.6 }]}>Source</Text>
                  <Text style={styles.sourceHeaderCell}>Visiteurs</Text>
                  <Text style={styles.sourceHeaderCell}>Vrais</Text>
                  <Text style={styles.sourceHeaderCell}>Part</Text>
                </View>
                {stats.visitQuality.bySource.map((s) => (
                  <View key={s.source} style={styles.sourceRow} testID={`dashboard-quality-${s.source}`}>
                    <Text style={[styles.sourceCell, { flex: 2.6, fontFamily: fonts.bodySemiBold }]} numberOfLines={1}>
                      {s.source}
                    </Text>
                    <Text style={styles.sourceCell}>{s.visitors}</Text>
                    <Text style={styles.sourceCell}>{s.realVisitors}</Text>
                    <Text style={[styles.sourceCell, styles.sourceConversion]}>{sharePercent(s.realVisitors, s.visitors)}</Text>
                  </View>
                ))}
                {stats.visitQuality.byCampaign.length > 0 && (
                  <>
                    <Text style={styles.qualityCampaignTitle}>Campagnes (visites · vraies)</Text>
                    {stats.visitQuality.byCampaign.slice(0, 6).map((c) => (
                      <View key={`${c.source}|${c.medium}|${c.campaign}`} style={styles.sourceRow} testID={`dashboard-campaign-${c.campaign}`}>
                        <Text style={[styles.sourceCell, { flex: 2.6 }]} numberOfLines={1}>
                          {campaignLabel(c)}
                        </Text>
                        <Text style={styles.sourceCell}>{c.sessions}</Text>
                        <Text style={styles.sourceCell}>{c.realSessions}</Text>
                        <Text style={[styles.sourceCell, styles.sourceConversion]}>{sharePercent(c.realSessions, c.sessions)}</Text>
                      </View>
                    ))}
                  </>
                )}
              </Section>
            )}

            <Section title="📡 Performance par source (résumé)">
              {stats.sourcePerformance.length === 0 ? (
                <Text style={styles.emptyText}>Pas encore de données.</Text>
              ) : (
                <>
                  <View style={styles.sourceHeaderRow}>
                    <Text style={[styles.sourceHeaderCell, { flex: 1.4 }]}>Source</Text>
                    <Text style={styles.sourceHeaderCell}>Visites</Text>
                    <Text style={styles.sourceHeaderCell}>Vues</Text>
                    <Text style={styles.sourceHeaderCell}>Panier</Text>
                    <Text style={styles.sourceHeaderCell}>Cmd.</Text>
                    <Text style={styles.sourceHeaderCell}>Conv.</Text>
                  </View>
                  {stats.sourcePerformance.map((s) => (
                    <View key={s.source} style={styles.sourceRow}>
                      <Text style={[styles.sourceCell, { flex: 1.4, fontFamily: fonts.bodySemiBold }]} numberOfLines={1}>
                        {s.source}
                      </Text>
                      <Text style={styles.sourceCell}>{s.sessions}</Text>
                      <Text style={styles.sourceCell}>{s.productViews}</Text>
                      <Text style={styles.sourceCell}>{s.cartAdds}</Text>
                      <Text style={styles.sourceCell}>{s.orders}</Text>
                      <Text style={[styles.sourceCell, styles.sourceConversion]}>
                        {s.conversionRate.toFixed(1)}%
                      </Text>
                    </View>
                  ))}
                </>
              )}
            </Section>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

function StatCard({ icon, label, value, testID }: { icon: string; label: string; value: string; testID?: string }) {
  return (
    <View style={styles.statCard} testID={testID}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
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

function RankRow({ rank, label, value }: { rank: number; label: string; value: string }) {
  return (
    <View style={styles.rankRow}>
      <Text style={styles.rankNumber}>#{rank}</Text>
      <Text style={styles.rankLabel} numberOfLines={1}>
        {label}
      </Text>
      <Text style={styles.rankValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  denied: { color: colors.creamFaint, fontFamily: fonts.body, textAlign: 'center', marginTop: 40 },
  loading: { color: colors.creamFaint, fontFamily: fonts.body, textAlign: 'center', marginTop: 40 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.lg },
  statCard: {
    width: '48%',
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  statIcon: { fontSize: 20, marginBottom: 6 },
  statValue: { color: colors.goldLight, fontFamily: fonts.displayBold, fontSize: 18 },
  statLabel: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 11, textAlign: 'center', marginTop: 4 },
  downloadsToday: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 11, marginTop: -4, marginBottom: spacing.lg },
  section: { marginBottom: spacing.lg },
  sectionTitle: { color: colors.cream, fontFamily: fonts.display, fontSize: 16, marginBottom: spacing.sm },
  sectionBody: { backgroundColor: colors.panel, borderRadius: radius.md, padding: spacing.sm },
  emptyText: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 12, padding: spacing.sm },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 8,
  },
  rankNumber: { color: colors.gold, fontFamily: fonts.bodyBold, fontSize: 12, width: 24 },
  rankLabel: { flex: 1, color: colors.cream, fontFamily: fonts.bodyMedium, fontSize: 13 },
  rankValue: { color: colors.goldLight, fontFamily: fonts.bodySemiBold, fontSize: 12 },
  stockRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 8,
  },
  stockName: { flex: 1, color: colors.cream, fontFamily: fonts.bodyMedium, fontSize: 13 },
  stockValue: { color: colors.gold, fontFamily: fonts.bodySemiBold, fontSize: 12 },
  stockZero: { color: colors.red },
  sourceHeaderRow: { flexDirection: 'row', paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: colors.border },
  sourceHeaderCell: {
    flex: 1,
    color: colors.creamFaint,
    fontFamily: fonts.bodySemiBold,
    fontSize: 10,
    textTransform: 'uppercase',
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sourceCell: { flex: 1, color: colors.creamMuted, fontFamily: fonts.body, fontSize: 12 },
  qualityCampaignTitle: { color: colors.creamFaint, fontFamily: fonts.bodySemiBold, fontSize: 10, textTransform: 'uppercase', marginTop: 12, marginBottom: 2 },
  sourceConversion: { color: colors.goldLight, fontFamily: fonts.bodyBold },
  sourceLinkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.gold,
    gap: 10,
  },
  sourceLinkIcon: { fontSize: 22 },
  sourceLinkTitle: { color: colors.goldLight, fontFamily: fonts.bodySemiBold, fontSize: 13 },
  sourceLinkSubtitle: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 11, marginTop: 2 },
  sourceLinkArrow: { color: colors.gold, fontSize: 18 },
});
