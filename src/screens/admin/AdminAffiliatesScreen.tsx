import React from 'react';
import { View, Text, StyleSheet, FlatList, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { useAuthStore } from '../../store/authStore';
import { useAffiliates, type AffiliateSummary } from '../../hooks/useAffiliates';
import { useToastStore } from '../../store/toastStore';
import { supabase } from '../../lib/supabase';
import { colors, fonts, radius, spacing } from '../../theme';
import { ScreenHeader } from '../../components/ScreenHeader';

const formatXAF = (n: number) => `${n.toLocaleString('fr-FR')} FCFA`;

const TYPE_LABELS: Record<string, string> = {
  pending: 'En attente',
  approved: 'Approuvé',
  blocked: 'Bloqué',
};

export function AdminAffiliatesScreen() {
  const profile = useAuthStore((s) => s.profile);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { affiliates, isLoading, refresh } = useAffiliates();
  const showToast = useToastStore((s) => s.show);

  if (!profile?.is_admin) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Admin" showBack />
        <Text style={styles.denied}>Accès réservé aux administrateurs.</Text>
      </View>
    );
  }

  const setStatus = async (targetUserId: string, newStatus: 'approved' | 'blocked') => {
    const { error } = await supabase.rpc('admin_set_affiliate_status', {
      target_user_id: targetUserId,
      new_status: newStatus,
    });
    if (error) {
      showToast(error.message, { title: 'Erreur', type: 'error' });
      return;
    }
    showToast(newStatus === 'approved' ? 'Affilié approuvé ✓' : 'Affilié bloqué', {
      title: newStatus === 'approved' ? 'Approuvé' : 'Bloqué',
      type: 'success',
    });
    refresh();
  };

  const pending = affiliates.filter((a) => a.profile.affiliate_status === 'pending');
  const others = affiliates
    .filter((a) => a.profile.affiliate_status !== 'pending')
    .sort((a, b) => b.revenue - a.revenue);

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title="Affiliés"
        showBack
        right={
          <Pressable onPress={() => navigation.navigate('AdminAffiliateSettings' as never)}>
            <Text style={styles.settingsLink}>⚙️</Text>
          </Pressable>
        }
      />
      <FlatList
        data={others}
        keyExtractor={(item) => item.profile.id}
        refreshing={isLoading}
        onRefresh={refresh}
        contentContainerStyle={{ padding: spacing.md }}
        ListHeaderComponent={
          <View>
            {pending.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>📥 Demandes en attente ({pending.length})</Text>
                {pending.map((a) => (
                  <AffiliateRow key={a.profile.id} item={a} onApprove={() => setStatus(a.profile.id, 'approved')} onBlock={() => setStatus(a.profile.id, 'blocked')} />
                ))}
              </>
            )}
            <Text style={styles.sectionTitle}>🏆 Top affiliés</Text>
          </View>
        }
        renderItem={({ item }) => (
          <AffiliateRow
            item={item}
            onApprove={item.profile.affiliate_status === 'blocked' ? () => setStatus(item.profile.id, 'approved') : undefined}
            onBlock={item.profile.affiliate_status === 'approved' ? () => setStatus(item.profile.id, 'blocked') : undefined}
          />
        )}
        ListEmptyComponent={!isLoading ? <Text style={styles.denied}>Aucun affilié pour le moment.</Text> : null}
      />
    </View>
  );
}

function AffiliateRow({
  item,
  onApprove,
  onBlock,
}: {
  item: AffiliateSummary;
  onApprove?: () => void;
  onBlock?: () => void;
}) {
  const { profile } = item;
  const isPending = profile.affiliate_status === 'pending';
  return (
    <View style={styles.row}>
      <View style={styles.rowHeader}>
        <Text style={styles.rowName}>{profile.full_name ?? profile.email}</Text>
        <Text
          style={[
            styles.statusBadge,
            profile.affiliate_status === 'approved' && styles.statusApproved,
            profile.affiliate_status === 'blocked' && styles.statusBlocked,
          ]}
        >
          {TYPE_LABELS[profile.affiliate_status ?? 'pending']}
        </Text>
      </View>
      <Text style={styles.rowMeta}>
        {profile.affiliate_type ?? '—'} · {profile.phone ?? '—'} · Code : {profile.referral_code ?? '—'}
      </Text>
      <Text style={styles.rowMeta}>💳 Mobile Money : {profile.affiliate_mobile_money ?? '—'}</Text>
      {profile.social_link ? <Text style={styles.rowMeta} numberOfLines={1}>🔗 {profile.social_link}</Text> : null}

      <View style={styles.metricsRow}>
        <Metric label="Visiteurs" value={String(item.visitorsSent)} />
        <Metric label="Ventes" value={String(item.ordersCount)} />
        <Metric label="CA" value={formatXAF(item.revenue)} />
        <Metric label="En attente" value={formatXAF(item.pendingCommission)} />
        <Metric label="À payer" value={formatXAF(item.validatedCommission)} highlight />
      </View>

      {(onApprove || onBlock) && (
        <View style={styles.actionsRow}>
          {onApprove && (
            <Pressable style={styles.approveBtn} onPress={onApprove}>
              <Text style={styles.approveBtnText}>✓ Approuver</Text>
            </Pressable>
          )}
          {onBlock && (
            <Pressable style={styles.blockBtn} onPress={onBlock}>
              <Text style={styles.blockBtnText}>{isPending ? '✕ Refuser' : 'Bloquer'}</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

function Metric({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={styles.metric}>
      <Text style={[styles.metricValue, highlight && { color: colors.goldLight }]}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  denied: { color: colors.creamFaint, fontFamily: fonts.body, textAlign: 'center', marginTop: 40 },
  settingsLink: { fontSize: 18 },
  sectionTitle: { color: colors.cream, fontFamily: fonts.display, fontSize: 16, marginTop: spacing.md, marginBottom: spacing.sm },
  row: {
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowName: { color: colors.cream, fontFamily: fonts.bodySemiBold, fontSize: 14 },
  statusBadge: {
    color: colors.creamFaint,
    fontFamily: fonts.bodyMedium,
    fontSize: 10,
    backgroundColor: colors.panelAlt,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  statusApproved: { color: '#3ddc6f', backgroundColor: 'rgba(61,220,111,0.12)' },
  statusBlocked: { color: colors.red, backgroundColor: 'rgba(216,35,42,0.12)' },
  rowMeta: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 11, marginTop: 3 },
  metricsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  metric: { backgroundColor: colors.panelAlt, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 6, minWidth: 66, alignItems: 'center' },
  metricValue: { color: colors.cream, fontFamily: fonts.bodyBold, fontSize: 11 },
  metricLabel: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 8, marginTop: 1 },
  actionsRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  approveBtn: { backgroundColor: colors.gold, borderRadius: radius.sm, paddingHorizontal: 14, paddingVertical: 8 },
  approveBtnText: { color: colors.background, fontFamily: fonts.bodyBold, fontSize: 12 },
  blockBtn: { borderWidth: 1, borderColor: colors.red, borderRadius: radius.sm, paddingHorizontal: 14, paddingVertical: 8 },
  blockBtnText: { color: colors.red, fontFamily: fonts.bodyMedium, fontSize: 12 },
});
