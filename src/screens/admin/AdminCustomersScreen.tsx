import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, StyleSheet, FlatList, Pressable, Linking } from 'react-native';
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
import { phoneDigits, visibleEmail } from '../../lib/phoneAuth';
import { fetchBrowsingOverview } from '../../lib/assistantData';
import { fetchRelanceData, type RelanceData } from '../../lib/relanceData';
import { pickRelance, relanceMessage, whatsappLink, type RelancePick } from '../../lib/relanceMessage';
import { supabase } from '../../lib/supabase';
import { ScreenHeader } from '../../components/ScreenHeader';
import { StoreSettingToggle } from '../../components/StoreSettingToggle';
import { GenderStatsCard } from '../../components/GenderStatsCard';
import { GENDER_ICON, genderOf, hasGenderColumn } from '../../lib/clientGender';
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
  | 'statusBanned'
  | 'highInterest'
  | 'away'
  | 'men'
  | 'women'
  | 'genderUnknown';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'Tous' },
  { key: 'active', label: 'Les plus actifs' },
  { key: 'recent', label: 'Récemment inscrits' },
  { key: 'withOrders', label: 'Ayant commandé' },
  { key: 'withoutOrders', label: 'Sans commande' },
  { key: 'statusActive', label: '🟢 Actifs' },
  { key: 'statusInactive', label: '🟡 Inactifs' },
  { key: 'statusBanned', label: '🔴 Bannis' },
  { key: 'highInterest', label: '💙 Intérêt élevé' },
  { key: 'away', label: '⏰ Absents 7 j et +' },
  { key: 'men', label: '👨 Hommes' },
  { key: 'women', label: '👩 Femmes' },
  { key: 'genderUnknown', label: '❔ Genre non précisé' },
];
// ces trois filtres n'ont de sens que quand la base a la colonne « gender » (script add-client-gender.sql lancé)
const GENDER_FILTERS: FilterKey[] = ['men', 'women', 'genderUnknown'];

const AWAY_DAYS = 7;

// Jours depuis la dernière connexion (ou l'inscription si le client ne s'est jamais reconnecté).
function daysAway(c: CustomerSummary, now: number = Date.now()): number {
  const last = new Date(c.profile.last_login_at ?? c.profile.created_at).getTime();
  return Number.isFinite(last) ? Math.floor((now - last) / 86_400_000) : 0;
}

const firstName = (c: CustomerSummary) => (c.profile.full_name ?? '').trim().split(/\s+/)[0] ?? '';

// Message WhatsApp prêt à envoyer (l'administrateur peut le modifier avant) : si le client a regardé de près un article encore en vente,
// le message le cite avec son vrai prix et la livraison de sa ville ; sinon, simple bonjour (voir src/lib/relanceMessage.ts).
function whatsappUrl(c: CustomerSummary, pick: RelancePick | null): string | null {
  const digits = phoneDigits(c.profile.whatsapp_number ?? '') ?? phoneDigits(c.profile.phone ?? '');
  if (!digits) return null;
  return whatsappLink(digits, relanceMessage({ firstName: firstName(c), product: pick?.product ?? null, region: c.profile.region }));
}

function emailUrl(c: CustomerSummary): string | null {
  const email = visibleEmail(c.profile.email);
  if (!email) return null;
  const body = `Bonjour ${firstName(c)},\n\n`.replace('Bonjour ,', 'Bonjour,');
  return `mailto:${email}?subject=${encodeURIComponent('Albasse Shopping')}&body=${encodeURIComponent(body)}`;
}

function isTestEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const lower = email.toLowerCase();
  return (
    lower.includes('test') ||
    lower.includes('@mailinator.') ||
    lower.includes('@yopmail.') ||
    lower.includes('@guerrillamail.') ||
    lower.includes('@example.') ||
    lower.includes('@fake.')
  );
}

export function AdminCustomersScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const profile = useAuthStore((s) => s.profile);
  const { customers, isLoading } = useCustomers();

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [hideTestAccounts, setHideTestAccounts] = useState(true);
  // comptes que Zara a notés « Intérêt élevé » (30 derniers jours) : le suivi donne « C- » + 8 premiers caractères du compte
  const [highInterest, setHighInterest] = useState<Set<string>>(new Set());
  // « j'aime » (cœurs) donnés par chaque client : un client qui aime des articles est aussi « Intérêt élevé »
  const [likesByUser, setLikesByUser] = useState<Map<string, number>>(new Map());
  // tous les articles regardés de près par des clients connectés, leurs commandes et les prix/stocks du jour (pour le message WhatsApp)
  const [relance, setRelance] = useState<RelanceData | null>(null);

  useEffect(() => {
    if (!profile?.is_admin) return;
    let alive = true;
    fetchBrowsingOverview('30d').then((res) => {
      if (!alive || !res.ok) return;
      const refs = res.overview.rows.filter((r) => r.interest === 'eleve' && r.accountRef).map((r) => r.accountRef!.slice(2));
      setHighInterest((prev) => new Set([...prev, ...refs]));
    });
    // le tableau de suivi ci-dessus ne garde que les 300 regards les plus récents (1 compte sur 30 « Intérêt élevé ») : on lit ici la liste complète
    fetchRelanceData().then((data) => {
      if (!alive || !data) return;
      setRelance(data);
      setHighInterest((prev) => new Set([...prev, ...data.rows.map((r) => r.userId.slice(0, 8))]));
    });
    Promise.resolve(supabase.from('favorites').select('user_id')).then(({ data }) => {
      if (!alive || !data) return;
      const m = new Map<string, number>();
      for (const r of data as { user_id: string }[]) m.set(r.user_id, (m.get(r.user_id) ?? 0) + 1);
      setLikesByUser(m);
    });
    return () => {
      alive = false;
    };
  }, [profile?.is_admin]);

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

  // Homme / Femme : seulement quand la base a la colonne (script add-client-gender.sql lancé) ; les comptes test masqués ne comptent pas
  const genderReady = useMemo(() => customers.some((c) => hasGenderColumn(c.profile)), [customers]);
  const genderCustomers = useMemo(() => (hideTestAccounts ? customers.filter((c) => !isTestEmail(c.profile.email)) : customers), [customers, hideTestAccounts]);

  const top10 = useMemo(
    () => [...customers].sort((a, b) => b.totalDurationSeconds - a.totalDurationSeconds).slice(0, 10),
    [customers]
  );

  const testAccountCount = useMemo(
    () => customers.filter((c) => isTestEmail(c.profile.email)).length,
    [customers]
  );

  const filtered = useMemo(() => {
    let list = hideTestAccounts ? customers.filter((c) => !isTestEmail(c.profile.email)) : customers;
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
      case 'highInterest':
        return list.filter((c) => highInterest.has(c.profile.id.slice(0, 8)) || (likesByUser.get(c.profile.id) ?? 0) > 0);
      case 'away':
        return list.filter((c) => daysAway(c) >= AWAY_DAYS);
      case 'men':
        return list.filter((c) => genderOf(c.profile.gender) === 'homme');
      case 'women':
        return list.filter((c) => genderOf(c.profile.gender) === 'femme');
      case 'genderUnknown':
        return list.filter((c) => !genderOf(c.profile.gender));
      default:
        return list;
    }
  }, [customers, query, filter, hideTestAccounts, highInterest, likesByUser]);

  const visible = filtered.slice(0, visibleCount);

  // pour chaque client : l'article regardé de près qu'on peut encore lui proposer (en vente, en stock, pas déjà commandé)
  const picks = useMemo(() => {
    const m = new Map<string, RelancePick>();
    if (!relance) return m;
    for (const c of customers) {
      const p = pickRelance(relance.rows, c.profile.id, relance.products, relance.ordered);
      if (p) m.set(c.profile.id, p);
    }
    return m;
  }, [customers, relance]);

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Gestion des clients" showBack />
      <FlatList
        data={visible}
        keyExtractor={(item) => item.profile.id}
        contentContainerStyle={{ padding: spacing.md }}
        refreshing={isLoading}
        renderItem={({ item }) => (
          <CustomerRow
            customer={item}
            highInterest={highInterest.has(item.profile.id.slice(0, 8)) || (likesByUser.get(item.profile.id) ?? 0) > 0}
            likes={likesByUser.get(item.profile.id) ?? 0}
            pick={picks.get(item.profile.id) ?? null}
            onPress={() => navigation.navigate('AdminCustomerDetail', { userId: item.profile.id })}
          />
        )}
        ListHeaderComponent={
          <View>
            <StoreSettingToggle setting="accountRequired" />
            <View style={styles.statsGrid}>
              <StatCard icon="👥" label="Total clients" value={String(stats.total)} />
              <StatCard icon="🆕" label="Nouveaux (7j)" value={String(stats.newCustomers)} />
              <StatCard icon="🟢" label="Clients actifs" value={String(stats.activeCustomers)} />
              <StatCard icon="🛒" label="Ont commandé" value={String(stats.withOrders)} />
              <StatCard icon="⏱️" label="Temps moyen" value={formatDuration(Math.round(stats.avgSeconds))} />
              <StatCard icon="🔥" label="Très actifs" value={String(stats.mostActive)} />
            </View>

            {genderReady && <GenderStatsCard customers={genderCustomers} />}

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

            {testAccountCount > 0 && (
              <Pressable
                style={[styles.testToggle, !hideTestAccounts && styles.testToggleActive]}
                onPress={() => setHideTestAccounts((v) => !v)}
              >
                <Text style={styles.testToggleText}>
                  {hideTestAccounts
                    ? `🧪 ${testAccountCount} compte(s) test masqué(s) — Afficher`
                    : `🧪 Comptes test visibles — Masquer`}
                </Text>
              </Pressable>
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
              {FILTERS.filter((f) => genderReady || !GENDER_FILTERS.includes(f.key)).map((f) => (
                <Pressable
                  key={f.key}
                  testID={`customers-filter-${f.key}`}
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

function CustomerRow({
  customer,
  highInterest,
  likes,
  pick,
  onPress,
}: {
  customer: CustomerSummary;
  highInterest: boolean;
  likes: number;
  pick: RelancePick | null;
  onPress: () => void;
}) {
  const level = engagementLevel(customer.totalDurationSeconds);
  const status = accountStatus(customer.profile.banned, customer.profile.last_login_at);
  const loyalty = getLoyaltyStatus(customer.profile.loyalty_points);
  const away = daysAway(customer);
  const isAway = away >= AWAY_DAYS;
  const wa = whatsappUrl(customer, pick);
  const mail = emailUrl(customer);
  return (
    <Pressable style={[styles.row, isAway && styles.rowAway]} onPress={onPress} testID="admin-customer-row">
      <View style={styles.rowHeader}>
        <Text style={[styles.rowName, isAway && styles.rowNameAway]} numberOfLines={1}>
          {customer.profile.full_name ?? visibleEmail(customer.profile.email) ?? customer.profile.phone ?? 'Client'}
        </Text>
        <Text style={styles.rowBadge}>{ACCOUNT_STATUS_LABEL[status]}</Text>
      </View>
      {(highInterest || isAway || likes > 0) && (
        <View style={styles.tagsRow}>
          {highInterest && (
            <View style={styles.tagInterest} testID="customer-high-interest">
              <Text style={styles.tagText}>💙 Intérêt élevé</Text>
            </View>
          )}
          {likes > 0 && (
            <View style={styles.tagLikes} testID="customer-likes">
              <Text style={styles.tagText}>{`❤️ ${likes} article${likes > 1 ? 's' : ''} aimé${likes > 1 ? 's' : ''}`}</Text>
            </View>
          )}
          {isAway && (
            <View style={styles.tagAway} testID="customer-away">
              <Text style={styles.tagText}>⏰ Pas connecté depuis {away} j</Text>
            </View>
          )}
        </View>
      )}
      {pick && (
        <Text style={styles.rowRelance} testID="customer-relance-article">
          {`💙 A regardé de près : ${pick.product.name.trim()} · ${formatXAF(pick.product.price)} (le message WhatsApp en parle)`}
        </Text>
      )}
      <Text style={styles.rowLoyalty}>
        {loyalty.current.icon} {loyalty.current.label} · {customer.profile.loyalty_points ?? 0} pts
      </Text>
      {status !== 'banned' && (
        <Text style={styles.rowEngagement}>{ENGAGEMENT_LABEL[level]}</Text>
      )}
      <Text style={styles.rowMeta}>
        📞 {customer.profile.phone ?? '—'} · 💼 {customer.profile.profession ?? '—'}
      </Text>
      {hasGenderColumn(customer.profile) && (
        <Text style={styles.rowMeta} testID="customer-gender">
          {genderOf(customer.profile.gender) ? `${GENDER_ICON[genderOf(customer.profile.gender)!]} ${genderOf(customer.profile.gender) === 'homme' ? 'Homme' : 'Femme'}` : '❔ Genre non précisé'}
        </Text>
      )}
      <Text style={styles.rowMeta}>
        📍 {customer.profile.region ?? '—'}, {customer.profile.country ?? '—'}
      </Text>
      <Text style={styles.rowMeta}>Créé le {formatDate(customer.profile.created_at)}</Text>
      <View style={styles.rowFooter}>
        <Text style={styles.rowFooterText}>⏱️ {formatDuration(customer.totalDurationSeconds)}</Text>
        <Text style={styles.rowFooterText}>🛒 {customer.orderCount} commande(s)</Text>
        <Text style={styles.rowFooterText}>{formatXAF(customer.totalSpent)}</Text>
      </View>
      {(wa || mail) && (
        <View style={styles.contactRow}>
          {wa && (
            <Pressable style={[styles.contactBtn, styles.contactWa]} onPress={() => Linking.openURL(wa)} testID="customer-contact-whatsapp">
              <Text style={styles.contactText}>💬 WhatsApp</Text>
            </Pressable>
          )}
          {mail && (
            <Pressable style={[styles.contactBtn, styles.contactMail]} onPress={() => Linking.openURL(mail)} testID="customer-contact-email">
              <Text style={styles.contactText}>✉️ E-mail</Text>
            </Pressable>
          )}
        </View>
      )}
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
  testToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  testToggleActive: { borderColor: colors.gold },
  testToggleText: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 12 },
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
  rowAway: { borderWidth: 1.5, borderColor: colors.red },
  rowName: { flex: 1, color: colors.cream, fontFamily: fonts.bodySemiBold, fontSize: 14 },
  rowNameAway: { color: '#ff6b6b' },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
  tagInterest: { backgroundColor: '#1e88e5', borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3 },
  tagLikes: { backgroundColor: '#c2185b', borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3 },
  tagAway: { backgroundColor: colors.red, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3 },
  tagText: { color: '#fff', fontFamily: fonts.bodySemiBold, fontSize: 10 },
  contactRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  contactBtn: { flex: 1, alignItems: 'center', borderRadius: radius.pill, paddingVertical: 8 },
  contactWa: { backgroundColor: '#25D366' },
  contactMail: { backgroundColor: '#1e88e5' },
  contactText: { color: '#fff', fontFamily: fonts.bodyBold, fontSize: 12 },
  rowBadge: { color: colors.creamMuted, fontFamily: fonts.bodyMedium, fontSize: 11, marginLeft: 8 },
  rowEngagement: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 10, marginBottom: 2 },
  rowRelance: { color: colors.cream, fontFamily: fonts.bodyMedium, fontSize: 11.5, lineHeight: 16, marginBottom: 4 },
  rowLoyalty: { color: colors.goldLight, fontFamily: fonts.bodySemiBold, fontSize: 11, marginBottom: 2 },
  rowMeta: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 11, marginTop: 2 },
  rowFooter: { flexDirection: 'row', gap: 14, marginTop: 8 },
  rowFooterText: { color: colors.goldLight, fontFamily: fonts.bodySemiBold, fontSize: 11 },
  loadMoreBtn: { alignItems: 'center', paddingVertical: spacing.md },
  loadMoreText: { color: colors.gold, fontFamily: fonts.bodyMedium, fontSize: 13 },
});
