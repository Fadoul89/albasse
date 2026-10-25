import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, TextInput, ScrollView, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { Image } from 'expo-image';
import { colors, fonts, radius, spacing } from '../../theme';
import { useAuthStore } from '../../store/authStore';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { ScreenHeader } from '../../components/ScreenHeader';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { CountdownTimer } from '../../components/CountdownTimer';
import { formatOrderDate, getOrderDay } from '../../lib/formatDuration';
import { useToastStore } from '../../store/toastStore';
import { filterOrders, orderNumberLabel, ordersToCsv, type PeriodFilter } from '../../lib/invoice';
import { countsAsSale, salesTotal } from '../../lib/salesRules';
import type { Order, OrderStatus } from '../../types';

const formatXAF = (n: number) => `${n.toLocaleString('fr-FR')} FCFA`;
const FLAG_DEADLINE_MS = 48 * 60 * 60 * 1000;
const getFlagDeadline = (createdAt: string) =>
  new Date(new Date(createdAt).getTime() + FLAG_DEADLINE_MS).toISOString();

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'En attente',
  paid: 'Payée',
  processing: 'En préparation',
  shipped: 'Expédiée',
  delivered: 'Livrée',
  cancelled: 'Annulée',
};

const PERIODS: { key: PeriodFilter; label: string }[] = [
  { key: 'all', label: 'Toutes les dates' },
  { key: 'today', label: "Aujourd'hui" },
  { key: '7d', label: '7 jours' },
  { key: '30d', label: '30 jours' },
];

const STATUS_FLOW: OrderStatus[] = ['pending', 'paid', 'processing', 'shipped', 'delivered'];
// Paiement a la livraison : "Payee" n'a pas de sens comme etape avant la
// livraison, on saute directement a la preparation.
const STATUS_FLOW_COD: OrderStatus[] = ['pending', 'processing', 'shipped', 'delivered'];

function getStatusFlow(order: Order): OrderStatus[] {
  return order.payment_method === 'cash_on_delivery' ? STATUS_FLOW_COD : STATUS_FLOW;
}

interface OrderCommissionInfo {
  affiliateName: string;
  amount: number;
  status: 'pending' | 'validated' | 'cancelled';
}

export function AdminOrdersScreen() {
  const profile = useAuthStore((s) => s.profile);
  const [orders, setOrders] = useState<Order[]>([]);
  const [commissionByOrder, setCommissionByOrder] = useState<Record<string, OrderCommissionInfo>>({});
  const [loading, setLoading] = useState(true);
  const [pendingDelete, setPendingDelete] = useState<Order | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [pendingFlag, setPendingFlag] = useState<Order | null>(null);
  const [flagging, setFlagging] = useState(false);
  const showToast = useToastStore((s) => s.show);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');
  const [period, setPeriod] = useState<PeriodFilter>('all');
  const filtered = useMemo(() => filterOrders(orders, { query, status: statusFilter, period }), [orders, query, statusFilter, period]);
  // seules les commandes livrées (et non signalées fausses) comptent dans le total
  const soldCount = useMemo(() => filtered.filter(countsAsSale).length, [filtered]);
  const soldTotal = useMemo(() => salesTotal(filtered), [filtered]);

  useEffect(() => {
    if (!isSupabaseConfigured || !profile?.is_admin) {
      setLoading(false);
      return;
    }
    supabase.rpc('auto_flag_stale_orders').then(() => {
      Promise.all([
        supabase.from('orders').select('*').order('created_at', { ascending: false }),
        supabase.from('affiliate_commissions').select('order_id, amount, status, profiles(full_name, email)'),
      ]).then(([ordersRes, commissionsRes]) => {
        setOrders((ordersRes.data as Order[]) ?? []);
        const map: Record<string, OrderCommissionInfo> = {};
        ((commissionsRes.data as any[]) ?? []).forEach((c) => {
          map[c.order_id] = {
            affiliateName: c.profiles?.full_name ?? c.profiles?.email ?? '—',
            amount: Number(c.amount),
            status: c.status,
          };
        });
        setCommissionByOrder(map);
        setLoading(false);
      });
    });
  }, [profile]);

  if (!profile?.is_admin) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Admin" showBack />
        <Text style={styles.denied}>Accès réservé aux administrateurs.</Text>
      </View>
    );
  }

  const advanceStatus = async (order: Order) => {
    const flow = getStatusFlow(order);
    const currentIndex = flow.indexOf(order.status);
    if (currentIndex === -1 || currentIndex === flow.length - 1) return;
    const nextStatus = flow[currentIndex + 1];
    await supabase.from('orders').update({ status: nextStatus }).eq('id', order.id);
    setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status: nextStatus } : o)));
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    const { error } = await supabase.from('orders').delete().eq('id', pendingDelete.id);
    setDeleting(false);
    if (error) {
      console.error('Erreur suppression commande:', error);
      return;
    }
    setOrders((prev) => prev.filter((o) => o.id !== pendingDelete.id));
    setPendingDelete(null);
  };

  const confirmFlag = async () => {
    if (!pendingFlag) return;
    setFlagging(true);
    const { error } = await supabase.rpc('flag_fake_order', { target_order_id: pendingFlag.id });
    setFlagging(false);
    if (error) {
      console.error('Erreur signalement commande:', error);
      showToast(error.message, { title: 'Erreur', type: 'error' });
      return;
    }
    setOrders((prev) => prev.map((o) => (o.id === pendingFlag.id ? { ...o, is_flagged_fake: true } : o)));
    showToast(
      `Commande signalée pour ${pendingFlag.shipping_name}. Le compte est banni automatiquement à la 3e.`,
      { title: 'Signalée 🚩', type: 'success' }
    );
    setPendingFlag(null);
  };

  // Export pour le comptable : un fichier CSV (ouvert directement par Excel) avec les commandes affichées
  const exportCsv = () => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const blob = new Blob([ordersToCsv(filtered)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `commandes-albasse-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    showToast(`${filtered.length} commande${filtered.length > 1 ? 's' : ''} exportée${filtered.length > 1 ? 's' : ''}.`, { title: 'Export prêt', type: 'success' });
  };

  const header = (
    <View style={styles.filters} testID="orders-filters">
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="🔎 Numéro, nom, téléphone, ville…"
        placeholderTextColor={colors.creamFaint}
        style={styles.search}
        testID="orders-search"
        autoCapitalize="none"
        autoCorrect={false}
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
        {(['all', 'pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled'] as const).map((st) => (
          <Pressable key={st} onPress={() => setStatusFilter(st)} style={[styles.chip, statusFilter === st && styles.chipOn]} testID={`orders-status-${st}`} accessibilityRole="button">
            <Text style={[styles.chipText, statusFilter === st && styles.chipTextOn]}>{st === 'all' ? 'Tous les statuts' : STATUS_LABELS[st]}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
        {PERIODS.map((pr) => (
          <Pressable key={pr.key} onPress={() => setPeriod(pr.key)} style={[styles.chip, period === pr.key && styles.chipOn]} testID={`orders-period-${pr.key}`} accessibilityRole="button">
            <Text style={[styles.chipText, period === pr.key && styles.chipTextOn]}>{pr.label}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <Text style={styles.rule} testID="orders-rule">Seules les commandes livrées comptent dans les ventes. Les commandes signalées comme fausses ne comptent jamais.</Text>
      <View style={styles.summaryRow}>
        <Text style={styles.summary} testID="orders-summary">
          {`${filtered.length} commande${filtered.length > 1 ? 's' : ''} · ${soldCount} livrée${soldCount > 1 ? 's' : ''} comptée${soldCount > 1 ? 's' : ''} : ${formatXAF(soldTotal)}`}
        </Text>
        {Platform.OS === 'web' ? (
          <Pressable onPress={exportCsv} accessibilityRole="button" style={styles.exportBtn} testID="orders-export">
            <Text style={styles.exportText}>⬇️ Exporter (CSV)</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Gestion des commandes" showBack />
      {!isSupabaseConfigured && (
        <Text style={styles.denied}>Connectez Supabase pour voir les commandes réelles.</Text>
      )}
      <FlatList
        data={filtered}
        ListHeaderComponent={header}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.md }}
        refreshing={loading}
        renderItem={({ item }) => {
          const commission = commissionByOrder[item.id];
          return (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.orderId} testID="admin-order-number">{orderNumberLabel(item)}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {item.is_flagged_fake && <Text style={styles.flaggedBadge}>🚩 Signalée</Text>}
                <Text style={styles.status}>{STATUS_LABELS[item.status]}</Text>
              </View>
            </View>
            <Text style={styles.customer}>{item.shipping_name} · {item.shipping_phone}</Text>
            <Text style={styles.address}>{item.shipping_address}, {item.shipping_city}</Text>
            {item.gift_wrap && <Text style={styles.giftBadge}>🎁 À emballer : emballage cadeau (2 000 FCFA inclus dans le total)</Text>}
            {!!item.loyalty_discount && (
              <Text style={styles.giftBadge}>{`⭐ Remise fidélité −10 % : −${item.loyalty_discount.toLocaleString('fr-FR')} FCFA (déjà déduite du total)`}</Text>
            )}
            <View style={styles.dateRow}>
              <Text style={styles.date}>{formatOrderDate(item.created_at)}</Text>
              {getOrderDay(item.created_at) === 'today' && (
                <View style={styles.todayBadge}>
                  <Text style={styles.todayBadgeText}>Aujourd'hui</Text>
                </View>
              )}
              {getOrderDay(item.created_at) === 'yesterday' && (
                <View style={styles.yesterdayBadge}>
                  <Text style={styles.yesterdayBadgeText}>Hier</Text>
                </View>
              )}
            </View>

            <View style={styles.itemsList}>
              {item.items.map((oi, idx) => (
                <View key={`${oi.product_id}-${idx}`} style={styles.itemRow}>
                  {oi.product_image ? (
                    <Image source={{ uri: oi.product_image }} style={styles.itemImage} contentFit="cover" />
                  ) : (
                    <View style={styles.itemImagePlaceholder} />
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemName} numberOfLines={1}>
                      {oi.product_name}
                    </Text>
                    <Text style={styles.itemMeta}>
                      {[oi.color, oi.size].filter(Boolean).join(' · ') || 'Standard'} · x{oi.quantity}
                    </Text>
                  </View>
                  <Text style={styles.itemPrice}>{formatXAF(oi.unit_price * oi.quantity)}</Text>
                </View>
              ))}
            </View>

            <Text style={styles.paymentMethod}>
              Paiement : {
                item.payment_method === 'airtel_money' ? 'Airtel Money'
                : item.payment_method === 'moov_money' ? 'Moov Money'
                : item.payment_method === 'cash_on_delivery' ? 'À la livraison'
                : item.payment_method
              }
            </Text>
            <Text style={styles.total}>Total : {formatXAF(item.total)}</Text>
            {item.status !== 'delivered' && item.status !== 'cancelled' && (
              <Pressable style={styles.advanceBtn} onPress={() => advanceStatus(item)}>
                <Text style={styles.advanceText}>Étape suivante →</Text>
              </Pressable>
            )}
            <View style={styles.actionsRow}>
              {!item.is_flagged_fake && (
                <Pressable style={styles.flagBtn} onPress={() => setPendingFlag(item)}>
                  <Text style={styles.flagText}>🚩 Signaler fausse commande</Text>
                </Pressable>
              )}
              <Pressable style={styles.invoiceBtn} onPress={() => navigation.navigate('Invoice', { orderId: item.id })} accessibilityRole="button" testID="admin-order-invoice">
                <Text style={styles.invoiceText}>🧾 Facture</Text>
              </Pressable>
              <Pressable style={styles.deleteBtn} onPress={() => setPendingDelete(item)}>
                <Text style={styles.deleteText}>Supprimer</Text>
              </Pressable>
            </View>

            {commission && (
              <View style={styles.affiliateBanner}>
                <Text style={styles.affiliateBannerText}>
                  🤝 Vente via affilié : {commission.affiliateName} · Commission {formatXAF(commission.amount)} (
                  {commission.status === 'pending' ? 'en attente' : commission.status === 'validated' ? 'validée' : 'annulée'})
                </Text>
              </View>
            )}

            {item.status === 'pending' && !item.is_flagged_fake && (
              <View style={styles.deadlineBox}>
                <Text style={styles.deadlineLabel}>
                  Signalement automatique comme fausse commande dans :
                </Text>
                <CountdownTimer endsAt={getFlagDeadline(item.created_at)} />
              </View>
            )}
          </View>
          );
        }}
        ListEmptyComponent={!loading ? <Text style={styles.denied}>{orders.length > 0 ? 'Aucune commande ne correspond à votre recherche.' : 'Aucune commande pour le moment.'}</Text> : null}
      />
      <ConfirmDialog
        visible={!!pendingDelete}
        title="Supprimer cette commande ?"
        message={`La commande ${pendingDelete ? orderNumberLabel(pendingDelete) : ''} sera supprimée définitivement.`}
        confirmLabel="Supprimer"
        destructive
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
      <ConfirmDialog
        visible={!!pendingFlag}
        title="Signaler cette commande comme fausse ?"
        message={`La commande de ${pendingFlag?.shipping_name} sera marquée comme non honorée. À la 3e commande signalée, le compte du client sera automatiquement banni.`}
        confirmLabel="Signaler"
        destructive
        loading={flagging}
        onConfirm={confirmFlag}
        onCancel={() => setPendingFlag(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  denied: { color: colors.creamFaint, fontFamily: fonts.body, textAlign: 'center', marginTop: 20, paddingHorizontal: 20 },
  card: {
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  orderId: { color: colors.cream, fontFamily: fonts.bodyBold, fontSize: 13 },
  status: { color: colors.goldLight, fontFamily: fonts.bodySemiBold, fontSize: 12 },
  customer: { color: colors.creamMuted, fontFamily: fonts.bodyMedium, fontSize: 13, marginBottom: 2 },
  address: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 12, marginBottom: 4 },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  date: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 12 },
  todayBadge: { backgroundColor: colors.gold, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  todayBadgeText: { color: colors.background, fontFamily: fonts.bodyBold, fontSize: 10 },
  yesterdayBadge: {
    backgroundColor: colors.panelAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  yesterdayBadgeText: { color: colors.creamMuted, fontFamily: fonts.bodyMedium, fontSize: 10 },
  itemsList: {
    backgroundColor: colors.panelAlt,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    gap: 8,
  },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  itemImage: { width: 44, height: 52, borderRadius: 6 },
  itemImagePlaceholder: { width: 44, height: 52, borderRadius: 6, backgroundColor: colors.panel },
  itemName: { color: colors.cream, fontFamily: fonts.bodyMedium, fontSize: 13 },
  itemMeta: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 11, marginTop: 2 },
  itemPrice: { color: colors.goldLight, fontFamily: fonts.bodySemiBold, fontSize: 12 },
  paymentMethod: { color: colors.creamMuted, fontFamily: fonts.bodyMedium, fontSize: 12, marginBottom: 4 },
  total: { color: colors.goldLight, fontFamily: fonts.bodyBold, fontSize: 15 },
  actionsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 },
  advanceBtn: { marginTop: 10 },
  advanceText: { color: colors.gold, fontFamily: fonts.bodyMedium, fontSize: 12 },
  deleteBtn: { marginLeft: 'auto' },
  deleteText: { color: colors.red, fontFamily: fonts.bodyMedium, fontSize: 12 },
  flagBtn: {},
  invoiceBtn: { marginLeft: 12, marginRight: 4 },
  invoiceText: { color: colors.goldLight, fontFamily: fonts.bodySemiBold, fontSize: 12 },
  filters: { gap: spacing.sm, marginBottom: spacing.md },
  search: { backgroundColor: colors.panel, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, color: colors.cream, fontFamily: fonts.body, fontSize: 14, paddingHorizontal: 14, paddingVertical: 11 },
  chipsRow: { gap: 8, paddingRight: 8 },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: colors.panel },
  chipOn: { backgroundColor: colors.gold, borderColor: colors.gold },
  chipText: { color: colors.creamMuted, fontFamily: fonts.bodyMedium, fontSize: 12 },
  chipTextOn: { color: colors.background, fontFamily: fonts.bodyBold },
  rule: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 11.5, lineHeight: 16 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  summary: { color: colors.goldLight, fontFamily: fonts.bodySemiBold, fontSize: 13, flexShrink: 1 },
  exportBtn: { borderWidth: 1, borderColor: colors.gold, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 7 },
  exportText: { color: colors.goldLight, fontFamily: fonts.bodySemiBold, fontSize: 12 },
  flagText: { color: '#f5c542', fontFamily: fonts.bodyMedium, fontSize: 12 },
  affiliateBanner: {
    backgroundColor: 'rgba(199,154,62,0.15)',
    borderRadius: radius.sm,
    padding: 8,
    marginTop: spacing.sm,
  },
  affiliateBannerText: { color: colors.goldLight, fontFamily: fonts.bodyMedium, fontSize: 11, lineHeight: 15 },
  deadlineBox: {
    backgroundColor: colors.panelAlt,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginTop: spacing.sm,
    alignItems: 'center',
    gap: 6,
  },
  deadlineLabel: { color: colors.creamFaint, fontFamily: fonts.bodyMedium, fontSize: 10.5, textAlign: 'center' },
  giftBadge: {
    alignSelf: 'flex-start',
    color: colors.goldLight,
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 6,
  },
  flaggedBadge: {
    color: colors.red,
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    backgroundColor: 'rgba(216,35,42,0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
});
