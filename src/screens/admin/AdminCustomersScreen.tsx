import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, StyleSheet, FlatList, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { colors, fonts, radius, spacing } from '../../theme';
import { useAuthStore } from '../../store/authStore';
import { useCustomers } from '../../hooks/useCustomers';
import {
  formatDuration,
  formatDate,
  engagementLevel,
  ENGAGEMENT_LABEL,
  accountStatus,
  ACCOUNT_STATUS_LABEL,
} from '../../lib/formatDuration';
import { getLoyaltyStatus } from '../../lib/loyalty';
import { ScreenHeader } from '../../components/ScreenHeader';
import type { CustomerSummary } from '../../types';

const formatXAF = (n: number) => `${n.toLocaleString('fr-FR')} FCFA`;
const PAGE_SIZE = 20;

type FilterKey =
  | 'all'
  | 'active'
  | 'recent'
  | 'withOrders'
  | 'withoutOrders'
  | 'statusActive'
  | 'statusInactive'
  | 'statusBanned';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'Tous' },
  { key: 'active', label: 'Les plus actifs' },
  { key: 'recent', label: 'Récemment inscrits' },
  { key: 'withOrders', label: 'Ayant commandé' },
  { key: 'withoutOrders', label: 'Sans commande' },
  { key: 'statusActive', label: '🟢 Actifs' },
  { key: 'statusInactive', label: '🟡 Inactifs' },
  { key: 'statusBanned', label: '🔴 Bannis' },
];

export function AdminCustomersScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const profile = useAuthStore((s) => s.profile);
  const { customers, isLoading } = useCustomers();

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  if (!profile?.is_admin) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Admin" showBack />
        <Text style={styles.denied}>Accès réservé aux administrateurs.</Text>
      </View>
    );
  }

  const stats = useMemo(() => {
    const total = customers.length;
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const newCustomers = customers.filter((c) => new Date(c.profile.created_at).getTime() > sevenDaysAgo).length;
    const activeCustomers = customers.filter((c) => engagementLevel(c.totalDurationSeconds) !== 'low').length;
    const withOrders = customers.filter((c) => c.orderCount > 0).length;
    const avgSeconds = total > 0 ? customers.reduce((s, c) => s + c.totalDurationSeconds, 0) / total : 0;
    const mostActive = customers.filter((c) => engagementLevel(c.totalDurationSeconds) === 'high').length;
    return { total, newCustomers, activeCustomers, withOrders, avgSeconds, mostActive };
  }, [customers]);

  const top10 = useMemo(
    () => [...customers].sort((a, b) => b.totalDurationSeconds - a.totalDurationSeconds).slice(0, 10),
    [customers]
  );

  const filtered = useMemo(() => {
    let list = customers;
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((c) => {
        const p = c.profile;
        return (
          (p.full_name ?? '').toLowerCase().includes(q) ||
          (p.phone ?? '').toLowerCase().includes(q) ||
          (p.profession ?? '').toLowerCase().includes(q) ||
          (p.region ?? '').toLowerCase().includes(q) ||
          (p.country ?? '').toLowerCase().includes(q)
        );
      });
    }
    switch (filter) {
      case 'active':
        return [...list].sort((a, b) => b.totalDurationSeconds - a.totalDurationSeconds);
      case 'recent':
        return [...list].sort((a, b) => b.profile.created_at.localeCompare(a.profile.created_at));
      case 'withOrders':
        return list.filter((c) => c.orderCount > 0);
      case 'withoutOrders':
        return list.filter((c) => c.orderCount === 0);
      case 'statusActive':
        return list.filter((c) => accountStatus(c.profile.banned, c.profile.last_login_at) === 'active');
      case 'statusInactive':
        return list.filter((c) => accountStatus(c.profile.banned, c.profile.last_login_at) === 'inactive');
      case 'statusBanned':
        return list.filter((c) => c.profile.banned);
      default:
        return list;
    }
  }, [customers, query, filter]);

  const visible = filtered.slice(0, visibleCount);

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Gestion des clients" showBack />
      <FlatList
        data={visible}
        keyExtractor={(item) => item.profile.id}
        contentContainerStyle={{ padding: spacing.md }}
        refreshing={isLoading}
        renderItem={({ item }) => (
          <CustomerRow customer={item} onPress={() => navigation.navigate('AdminCustomerDetail', { userId: item.profile.id })} />
        )}
        ListHeaderComponent={
          <View>
            <View style={styles.statsGrid}>
              <StatCard icon="👥" label="Total clients" value={String(stats.total)} />
              <StatCard icon="🆕" label="Nouveaux (7j)" value={String(stats.newCustomers)} />
              <StatCard icon="🟢" label="Clients actifs" value={String(stats.activeCustomers)} />
              <StatCard icon="🛒" label="Ont commandé" value={String(stats.withOrders)} />
              <StatCard icon="⏱️" label="Temps moyen" value={formatDuration(Math.round(stats.avgSeconds))} />
              <StatCard icon="🔥" label="Très actifs" value={String(stats.mostActive)} />
            </View>

            {top10.length > 0 && (
              <View style={styles.topSection}>
                <Text style={styles.sectionTitle}>🔥 Top 10 clients les plus actifs</Text>
                {top10.map((c, i) => (
                  <Pressable
                    key={c.profile.id}
                    style={styles.topRow}
                    onPress={() => navigation.navigate('AdminCustomerDetail', { userId: c.profile.id })}
                  >
                    <Text style={styles.topRank}>#{i + 1}</Text>
                    <Text style={styles.topName} numberOfLines={1}>
                      {c.profile.full_name ?? c.profile.email}
                    </Text>
                    <Text style={styles.topDuration}>{formatDuration(c.totalDurationSeconds)}</Text>
                  </Pressable>
                ))}
              </View>
            )}

            <TextInput
              value={query}
              onChangeText={(t) => {
                setQuery(t);
                setVisibleCount(PAGE_SIZE);
              }}
              placeholder="Rechercher par nom, téléphone, profession, ville, pays…"
              placeholderTextColor={colors.creamFaint}
              style={styles.search}
            />

            <View style={styles.filtersRow}>
              {FILTERS.map((f) => (
                <Pressable
                  key={f.key}
                  style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
                  onPress={() => {
                    setFilter(f.key);
                    setVisibleCount(PAGE_SIZE);
                  }}
                >
                  <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>{f.label}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.tableTitle}>{filtered.length} client(s)</Text>
          </View>
        }
        ListFooterComponent={
          visibleCount < filtered.length ? (
            <Pressable style={styles.loadMoreBtn} onPress={() => setVisibleCount((v) => v + PAGE_SIZE)}>
              <Text style={styles.loadMoreText}>Charger plus ({filtered.length - visibleCount} restants)</Text>
            </Pressable>
          ) : null
        }
        ListEmptyComponent={!isLoading ? <Text style={styles.denied}>Aucun client trouvé.</Text> : null}
      />
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

function CustomerRow({ customer, onPress }: { customer: CustomerSummary; onPress: () => void }) {
  const level = engagementLevel(customer.totalDurationSeconds);
  const status = accountStatus(customer.profile.banned, customer.profile.last_login_at);
  const loyalty = getLoyaltyStatus(customer.profile.loyalty_points);
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View style={styles.rowHeader}>
        <Text style={styles.rowName} numberOfLines={1}>
          {customer.profile.full_name ?? customer.profile.email}
        </Text>
        <Text style={styles.rowBadge}>{ACCOUNT_STATUS_LABEL[status]}</Text>
      </View>
      <Text style={styles.rowLoyalty}>
        {loyalty.current.icon} {loyalty.current.label} · {customer.profile.loyalty_points} pts
      </Text>
      {status !== 'banned' && (
        <Text style={styles.rowEngagement}>{ENGAGEMENT_LABEL[level]}</Text>
      )}
      <Text style={styles.rowMeta}>
        📞 {customer.profile.phone ?? '—'} · 💼 {customer.profile.profession ?? '—'}
      </Text>
      <Text style={styles.rowMeta}>
        📍 {customer.profile.region ?? '—'}, {customer.profile.country ?? '—'}
      </Text>
      <Text style={styles.rowMeta}>Créé le {formatDate(customer.profile.created_at)}</Text>
      <View style={styles.rowFooter}>
        <Text style={styles.rowFooterText}>⏱️ {formatDuration(customer.totalDurationSeconds)}</Text>
        <Text style={styles.rowFooterText}>🛒 {customer.orderCount} commande(s)</Text>
        <Text style={styles.rowFooterText}>{formatXAF(customer.totalSpent)}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  denied: { color: colors.creamFaint, fontFamily: fonts.body, textAlign: 'center', marginTop: 40 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.lg },
  statCard: {
    width: '31%',
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    padding: spacing.sm,
    alignItems: 'center',
  },
  statIcon: { fontSize: 16, marginBottom: 4 },
  statValue: { color: colors.goldLight, fontFamily: fonts.displayBold, fontSize: 16 },
  statLabel: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 9, textAlign: 'center', marginTop: 2 },
  topSection: { marginBottom: spacing.lg },
  sectionTitle: { color: colors.cream, fontFamily: fonts.display, fontSize: 16, marginBottom: spacing.sm },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.panel,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    marginBottom: 6,
    gap: 8,
  },
  topRank: { color: colors.gold, fontFamily: fonts.bodyBold, fontSize: 12, width: 24 },
  topName: { flex: 1, color: colors.cream, fontFamily: fonts.bodyMedium, fontSize: 13 },
  topDuration: { color: colors.goldLight, fontFamily: fonts.bodySemiBold, fontSize: 12 },
  search: {
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: colors.cream,
    fontFamily: fonts.body,
    fontSize: 13,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  filtersRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.md },
  filterChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.panel,
  },
  filterChipActive: { borderColor: colors.gold, backgroundColor: colors.panelAlt },
  filterText: { color: colors.creamMuted, fontFamily: fonts.bodyMedium, fontSize: 11 },
  filterTextActive: { color: colors.goldLight },
  tableTitle: { color: colors.creamFaint, fontFamily: fonts.bodyMedium, fontSize: 12, marginBottom: spacing.sm },
  row: {
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  rowName: { flex: 1, color: colors.cream, fontFamily: fonts.bodySemiBold, fontSize: 14 },
  rowBadge: { color: colors.creamMuted, fontFamily: fonts.bodyMedium, fontSize: 11, marginLeft: 8 },
  rowEngagement: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 10, marginBottom: 2 },
  rowLoyalty: { color: colors.goldLight, fontFamily: fonts.bodySemiBold, fontSize: 11, marginBottom: 2 },
  rowMeta: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 11, marginTop: 2 },
  rowFooter: { flexDirection: 'row', gap: 14, marginTop: 8 },
  rowFooterText: { color: colors.goldLight, fontFamily: fonts.bodySemiBold, fontSize: 11 },
  loadMoreBtn: { alignItems: 'center', paddingVertical: spacing.md },
  loadMoreText: { color: colors.gold, fontFamily: fonts.bodyMedium, fontSize: 13 },
});
