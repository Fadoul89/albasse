import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, Linking } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { useAuthStore } from '../../store/authStore';
import { useCustomers } from '../../hooks/useCustomers';
import { formatDuration } from '../../lib/formatDuration';
import { colors, fonts, radius, spacing } from '../../theme';
import { ScreenHeader } from '../../components/ScreenHeader';
import type { CustomerSummary } from '../../types';

const formatXAF = (n: number) => `${n.toLocaleString('fr-FR')} FCFA`;

type Tab = 'hot' | 'vip';

export function AdminBestLeadsScreen() {
  const profile = useAuthStore((s) => s.profile);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { customers, isLoading } = useCustomers();
  const [tab, setTab] = useState<Tab>('hot');

  if (!profile?.is_admin) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Admin" showBack />
        <Text style={styles.denied}>Accès réservé aux administrateurs.</Text>
      </View>
    );
  }

  const hotLeads = useMemo(() => {
    return customers
      .filter((c) => c.orderCount === 0 && (c.cartAddCount > 0 || c.productViewCount > 0 || c.sessionCount > 0))
      .map((c) => ({
        ...c,
        score: c.cartAddCount * 3 + c.productViewCount * 1.5 + c.sessionCount * 2 + c.totalDurationSeconds / 60,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 50);
  }, [customers]);

  const vipCustomers = useMemo(() => {
    return customers
      .filter((c) => c.orderCount > 0)
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 50);
  }, [customers]);

  const list = tab === 'hot' ? hotLeads : vipCustomers;

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Meilleurs clients potentiels" showBack />
      <Text style={styles.intro}>
        🎯 Classement automatique basé sur le comportement réel des visiteurs (visites, produits consultés,
        paniers) pour repérer qui contacter en priorité.
      </Text>
      <View style={styles.tabRow}>
        <Pressable style={[styles.tab, tab === 'hot' && styles.tabActive]} onPress={() => setTab('hot')}>
          <Text style={[styles.tabText, tab === 'hot' && styles.tabTextActive]}>🔥 Prêts à acheter</Text>
        </Pressable>
        <Pressable style={[styles.tab, tab === 'vip' && styles.tabActive]} onPress={() => setTab('vip')}>
          <Text style={[styles.tabText, tab === 'vip' && styles.tabTextActive]}>⭐ Meilleurs clients</Text>
        </Pressable>
      </View>

      <FlatList
        data={list}
        keyExtractor={(item) => item.profile.id}
        refreshing={isLoading}
        contentContainerStyle={{ padding: spacing.md }}
        renderItem={({ item, index }) => (
          <LeadRow
            item={item}
            rank={index + 1}
            mode={tab}
            onPress={() => navigation.navigate('AdminCustomerDetail', { userId: item.profile.id })}
          />
        )}
        ListEmptyComponent={
          !isLoading ? (
            <Text style={styles.empty}>
              {tab === 'hot'
                ? "Aucun visiteur avec un fort potentiel pour l'instant."
                : 'Aucun client avec commande pour le moment.'}
            </Text>
          ) : null
        }
      />
    </View>
  );
}

function LeadRow({
  item,
  rank,
  mode,
  onPress,
}: {
  item: CustomerSummary;
  rank: number;
  mode: Tab;
  onPress: () => void;
}) {
  const { profile } = item;

  const openWhatsApp = () => {
    if (!profile.phone) return;
    const digits = profile.phone.replace(/[^0-9]/g, '');
    Linking.openURL(`https://wa.me/${digits}`);
  };

  return (
    <Pressable style={styles.row} onPress={onPress}>
      <Text style={styles.rank}>#{rank}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.name}>{profile.full_name ?? profile.email}</Text>
        <Text style={styles.meta}>{profile.phone ?? '—'} · {profile.region ?? '—'}</Text>
        {mode === 'hot' ? (
          <Text style={styles.stats}>
            👀 {item.sessionCount} visite(s) · 🛍️ {item.productViewCount} produit(s) vu(s) · 🛒 {item.cartAddCount} au panier ·
            ⏱️ {formatDuration(item.totalDurationSeconds)}
          </Text>
        ) : (
          <Text style={styles.stats}>
            💰 {formatXAF(item.totalSpent)} · 📦 {item.orderCount} commande(s) · ✅ {item.completedOrders} livrée(s)
          </Text>
        )}
      </View>
      {profile.phone && (
        <Pressable style={styles.waBtn} onPress={openWhatsApp}>
          <Text style={styles.waBtnText}>💬</Text>
        </Pressable>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  denied: { color: colors.creamFaint, fontFamily: fonts.body, textAlign: 'center', marginTop: 40 },
  intro: {
    color: colors.creamFaint,
    fontFamily: fonts.body,
    fontSize: 11.5,
    lineHeight: 16,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  tabRow: { flexDirection: 'row', gap: 8, paddingHorizontal: spacing.md, paddingTop: spacing.md },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  tabActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  tabText: { color: colors.creamMuted, fontFamily: fonts.bodyMedium, fontSize: 12 },
  tabTextActive: { color: colors.background, fontFamily: fonts.bodyBold },
  empty: { color: colors.creamFaint, fontFamily: fonts.body, textAlign: 'center', marginTop: 40 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  rank: { color: colors.gold, fontFamily: fonts.displayBold, fontSize: 15, width: 30 },
  name: { color: colors.cream, fontFamily: fonts.bodySemiBold, fontSize: 14 },
  meta: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 11, marginTop: 2 },
  stats: { color: colors.creamMuted, fontFamily: fonts.body, fontSize: 10.5, marginTop: 4 },
  waBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#25d366',
    alignItems: 'center',
    justifyContent: 'center',
  },
  waBtnText: { fontSize: 16 },
});
