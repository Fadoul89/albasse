import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { useAuthStore } from '../../store/authStore';
import { useDashboardStats } from '../../hooks/useDashboardStats';
import { colors, fonts, radius, spacing } from '../../theme';
import { ScreenHeader } from '../../components/ScreenHeader';
import { NotificationBell } from '../../components/NotificationBell';

const formatXAF = (n: number) => `${n.toLocaleString('fr-FR')} FCFA`;

export function AdminDashboardScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const profile = useAuthStore((s) => s.profile);
  const { stats, isLoading } = useDashboardStats();

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
      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 60 }} refreshControl={undefined}>
        {isLoading && !stats ? (
          <Text style={styles.loading}>Chargement…</Text>
        ) : stats ? (
          <>
            <View style={styles.statsGrid}>
              <StatCard icon="💰" label="CA aujourd'hui" value={formatXAF(stats.revenueToday)} />
              <StatCard icon="🛒" label="Commandes aujourd'hui" value={String(stats.ordersToday)} />
              <StatCard icon="👥" label="Nouveaux clients" value={String(stats.newCustomersToday)} />
              <StatCard icon="👀" label="Visiteurs aujourd'hui" value={String(stats.visitorsToday)} />
            </View>

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

function StatCard({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.statCard}>
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
