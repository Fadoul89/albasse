import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { colors, fonts, radius, spacing } from '../../theme';
import { useAuthStore } from '../../store/authStore';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { ScreenHeader } from '../../components/ScreenHeader';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { useToastStore } from '../../store/toastStore';
import type { Order, OrderStatus } from '../../types';

const formatXAF = (n: number) => `${n.toLocaleString('fr-FR')} FCFA`;

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'En attente',
  paid: 'Payée',
  processing: 'En préparation',
  shipped: 'Expédiée',
  delivered: 'Livrée',
  cancelled: 'Annulée',
};

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

  useEffect(() => {
    if (!isSupabaseConfigured || !profile?.is_admin) {
      setLoading(false);
      return;
    }
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

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Gestion des commandes" showBack />
      {!isSupabaseConfigured && (
        <Text style={styles.denied}>Connectez Supabase pour voir les commandes réelles.</Text>
      )}
      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.md }}
        refreshing={loading}
        renderItem={({ item }) => {
          const commission = commissionByOrder[item.id];
          return (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.orderId}>#{item.id.slice(0, 8)}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {item.is_flagged_fake && <Text style={styles.flaggedBadge}>🚩 Signalée</Text>}
                <Text style={styles.status}>{STATUS_LABELS[item.status]}</Text>
              </View>
            </View>
            <Text style={styles.customer}>{item.shipping_name} · {item.shipping_phone}</Text>
            <Text style={styles.address}>{item.shipping_address}, {item.shipping_city}</Text>

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
          </View>
          );
        }}
        ListEmptyComponent={!loading ? <Text style={styles.denied}>Aucune commande pour le moment.</Text> : null}
      />
      <ConfirmDialog
        visible={!!pendingDelete}
        title="Supprimer cette commande ?"
        message={`La commande #${pendingDelete?.id.slice(0, 8)} sera supprimée définitivement.`}
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
  address: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 12, marginBottom: 10 },
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
  flagText: { color: '#f5c542', fontFamily: fonts.bodyMedium, fontSize: 12 },
  affiliateBanner: {
    backgroundColor: 'rgba(199,154,62,0.15)',
    borderRadius: radius.sm,
    padding: 8,
    marginTop: spacing.sm,
  },
  affiliateBannerText: { color: colors.goldLight, fontFamily: fonts.bodyMedium, fontSize: 11, lineHeight: 15 },
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
