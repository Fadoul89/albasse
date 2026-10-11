import React from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { colors, fonts, radius, spacing } from '../theme';
import { formatXAF } from '../lib/format';
import { useDashboardStats } from '../hooks/useDashboardStats';
import { useAuthStore } from '../store/authStore';
import { ScreenHeader } from '../components/ScreenHeader';

export default function AdminDashboardScreen() {
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
      <ScreenHeader title="Tableau de bord" showBack />
      <ScrollView
        contentContainerStyle={{ padding: spacing.md, paddingBottom: 60 }}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refresh} tintColor={colors.gold} />}
      >
        {!stats ? (
          <Text style={styles.loading}>Chargement…</Text>
        ) : (
          <>
            <View style={styles.statsGrid}>
              <StatCard icon="💰" label="CA aujourd'hui" value={formatXAF(stats.revenueToday)} />
              <StatCard icon="🛒" label="Commandes aujourd'hui" value={String(stats.ordersToday)} />
              <StatCard icon="👥" label="Nouveaux clients" value={String(stats.newCustomersToday)} />
              <StatCard icon="📱" label="Installations app (total)" value={String(stats.appInstallsTotal)} />
            </View>
            <Text style={styles.downloadsToday}>
              dont {stats.appInstallsToday} aujourd'hui · {stats.appDownloadClicksTotal} clic(s) de téléchargement
            </Text>

            <Pressable style={styles.linkCard} onPress={() => router.push('/admin-orders')}>
              <Text style={styles.linkCardText}>📦 Voir toutes les commandes →</Text>
            </Pressable>
            <Pressable style={styles.linkCard} onPress={() => router.push('/admin-products')}>
              <Text style={styles.linkCardText}>🛠️ Gérer les produits →</Text>
            </Pressable>

            <Section title="🔥 Produits les plus consultés">
              {stats.mostViewedProducts.length === 0 ? (
                <Text style={styles.emptyText}>Pas encore de données.</Text>
              ) : (
                stats.mostViewedProducts.map((p, i) => <RankRow key={p.product_id} rank={i + 1} label={p.name} value={`${p.count} vue(s)`} />)
              )}
            </Section>

            <Section title="⭐ Produits les plus vendus">
              {stats.bestSellingProducts.length === 0 ? (
                <Text style={styles.emptyText}>Pas encore de ventes.</Text>
              ) : (
                stats.bestSellingProducts.map((p, i) => <RankRow key={p.product_id} rank={i + 1} label={p.name} value={`${p.count} vendu(s)`} />)
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
          </>
        )}
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
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.md },
  statCard: { width: '48%', backgroundColor: colors.panel, borderRadius: radius.md, padding: spacing.md, alignItems: 'center' },
  statIcon: { fontSize: 20, marginBottom: 6 },
  statValue: { color: colors.goldLight, fontFamily: fonts.displayBold, fontSize: 18 },
  statLabel: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 11, textAlign: 'center', marginTop: 4 },
  downloadsToday: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 11, marginTop: -4, marginBottom: spacing.md },
  linkCard: { backgroundColor: colors.gold, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm },
  linkCardText: { color: colors.background, fontFamily: fonts.bodyBold, fontSize: 13, textAlign: 'center' },
  section: { marginBottom: spacing.lg, marginTop: spacing.sm },
  sectionTitle: { color: colors.cream, fontFamily: fonts.display, fontSize: 16, marginBottom: spacing.sm },
  sectionBody: { backgroundColor: colors.panel, borderRadius: radius.md, padding: spacing.sm },
  emptyText: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 12, padding: spacing.sm },
  rankRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 8 },
  rankNumber: { color: colors.gold, fontFamily: fonts.bodyBold, fontSize: 12, width: 24 },
  rankLabel: { flex: 1, color: colors.cream, fontFamily: fonts.bodyMedium, fontSize: 13 },
  rankValue: { color: colors.goldLight, fontFamily: fonts.bodySemiBold, fontSize: 12 },
  stockRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 8 },
  stockName: { flex: 1, color: colors.cream, fontFamily: fonts.bodyMedium, fontSize: 13 },
  stockValue: { color: colors.gold, fontFamily: fonts.bodySemiBold, fontSize: 12 },
  stockZero: { color: colors.red },
});
