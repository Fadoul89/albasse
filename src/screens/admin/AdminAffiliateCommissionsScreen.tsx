import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable } from 'react-native';
import { useAuthStore } from '../../store/authStore';
import { useAffiliateCommissions, type AdminCommissionRow } from '../../hooks/useAffiliateCommissions';
import { colors, fonts, radius, spacing } from '../../theme';
import { ScreenHeader } from '../../components/ScreenHeader';
import { ConfirmDialog } from '../../components/ConfirmDialog';

const formatXAF = (n: number) => `${n.toLocaleString('fr-FR')} FCFA`;

const STATUS_LABELS: Record<string, string> = {
  pending: 'En attente',
  validated: 'Validée',
  cancelled: 'Annulée',
};

type Filter = 'all' | 'to_pay' | 'pending' | 'paid';

export function AdminAffiliateCommissionsScreen() {
  const profile = useAuthStore((s) => s.profile);
  const { commissions, isLoading, refresh, markPaid } = useAffiliateCommissions();
  const [filter, setFilter] = useState<Filter>('to_pay');
  const [pendingPay, setPendingPay] = useState<AdminCommissionRow | null>(null);

  if (!profile?.is_admin) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Admin" showBack />
        <Text style={styles.denied}>Accès réservé aux administrateurs.</Text>
      </View>
    );
  }

  const filtered = commissions.filter((c) => {
    if (filter === 'to_pay') return c.status === 'validated' && !c.paid;
    if (filter === 'pending') return c.status === 'pending';
    if (filter === 'paid') return c.paid;
    return true;
  });

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Commissions affiliés" showBack />
      <View style={styles.filterRow}>
        {(
          [
            ['to_pay', 'À payer'],
            ['pending', 'En attente'],
            ['paid', 'Payées'],
            ['all', 'Toutes'],
          ] as [Filter, string][]
        ).map(([key, label]) => (
          <Pressable key={key} style={[styles.filterChip, filter === key && styles.filterChipActive]} onPress={() => setFilter(key)}>
            <Text style={[styles.filterChipText, filter === key && styles.filterChipTextActive]}>{label}</Text>
          </Pressable>
        ))}
      </View>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        refreshing={isLoading}
        onRefresh={refresh}
        contentContainerStyle={{ padding: spacing.md }}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.affiliateName}>{item.affiliate_name}</Text>
              <Text style={styles.orderRef}>Commande #{item.order_id.slice(0, 8)}</Text>
              <Text style={styles.date}>
                {new Date(item.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.amount}>{formatXAF(item.amount)}</Text>
              <Text style={styles.status}>{item.paid ? 'Payée' : STATUS_LABELS[item.status]}</Text>
              {item.status === 'validated' && !item.paid && (
                <Pressable style={styles.payBtn} onPress={() => setPendingPay(item)}>
                  <Text style={styles.payBtnText}>Marquer payée</Text>
                </Pressable>
              )}
            </View>
          </View>
        )}
        ListEmptyComponent={!isLoading ? <Text style={styles.denied}>Aucune commission ici.</Text> : null}
      />
      <ConfirmDialog
        visible={!!pendingPay}
        title="Marquer cette commission comme payée ?"
        message={`${pendingPay ? formatXAF(pendingPay.amount) : ''} pour ${pendingPay?.affiliate_name ?? ''}.`}
        confirmLabel="Confirmer"
        onConfirm={async () => {
          if (pendingPay) await markPaid(pendingPay.id);
          setPendingPay(null);
        }}
        onCancel={() => setPendingPay(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  denied: { color: colors.creamFaint, fontFamily: fonts.body, textAlign: 'center', marginTop: 40 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  filterChipText: { color: colors.creamMuted, fontFamily: fonts.bodyMedium, fontSize: 12 },
  filterChipTextActive: { color: colors.background, fontFamily: fonts.bodyBold },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  affiliateName: { color: colors.cream, fontFamily: fonts.bodySemiBold, fontSize: 13 },
  orderRef: { color: colors.creamMuted, fontFamily: fonts.body, fontSize: 11, marginTop: 2 },
  date: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 10, marginTop: 2 },
  amount: { color: colors.goldLight, fontFamily: fonts.bodyBold, fontSize: 14 },
  status: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 10, marginTop: 2 },
  payBtn: { backgroundColor: colors.gold, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 5, marginTop: 6 },
  payBtnText: { color: colors.background, fontFamily: fonts.bodyBold, fontSize: 10 },
});
