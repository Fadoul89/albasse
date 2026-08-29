import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { useAuthStore } from '../store/authStore';
import { useMyOrders } from '../hooks/useMyOrders';
import { supabase } from '../lib/supabase';
import { colors, fonts, radius, spacing } from '../theme';
import { ScreenHeader } from '../components/ScreenHeader';
import { GoldButton } from '../components/GoldButton';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { OrderStatusStepper } from '../components/OrderStatusStepper';
import { CountdownTimer } from '../components/CountdownTimer';
import type { Order, OrderStatus } from '../types';

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

const PAYMENT_LABELS: Record<string, string> = {
  airtel_money: 'Airtel Money',
  moov_money: 'Moov Money',
  cash_on_delivery: 'À la livraison',
  stripe: 'Carte bancaire',
};

export function OrdersScreen() {
  const profile = useAuthStore((s) => s.profile);
  const { orders, isLoading, refresh } = useMyOrders(profile?.id);
  const [pendingConfirm, setPendingConfirm] = useState<Order | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [pendingRemove, setPendingRemove] = useState<{ order: Order; index: number } | null>(null);
  const [removing, setRemoving] = useState(false);

  if (!profile) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Mes commandes" showBack />
        <Text style={styles.empty}>Connectez-vous pour voir vos commandes.</Text>
      </View>
    );
  }

  const confirmDelivery = async () => {
    if (!pendingConfirm) return;
    setConfirming(true);
    const { error } = await supabase.from('orders').update({ status: 'delivered' }).eq('id', pendingConfirm.id);
    setConfirming(false);
    if (error) {
      console.error('Erreur confirmation réception:', error);
      return;
    }
    setPendingConfirm(null);
    refresh();
  };

  const confirmRemoveItem = async () => {
    if (!pendingRemove) return;
    const { order, index } = pendingRemove;
    const newItems = order.items.filter((_, i) => i !== index);
    const newTotal = newItems.reduce((sum, oi) => sum + oi.unit_price * oi.quantity, 0);
    setRemoving(true);
    const { error } = await supabase
      .from('orders')
      .update({ items: newItems, total: newTotal })
      .eq('id', order.id);
    setRemoving(false);
    if (error) {
      console.error('Erreur retrait article:', error);
      return;
    }
    setPendingRemove(null);
    refresh();
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Mes commandes" showBack />
      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        refreshing={isLoading}
        onRefresh={refresh}
        contentContainerStyle={{ padding: spacing.md }}
        renderItem={({ item }) => (
          <OrderCard
            order={item}
            onConfirmDelivery={() => setPendingConfirm(item)}
            confirming={false}
            onRemoveItem={(index) => setPendingRemove({ order: item, index })}
          />
        )}
        ListEmptyComponent={
          !isLoading ? <Text style={styles.empty}>Vous n'avez pas encore passé de commande.</Text> : null
        }
      />
      <ConfirmDialog
        visible={!!pendingConfirm}
        title="Confirmer la réception"
        message="Confirmez-vous avoir bien reçu votre commande ?"
        confirmLabel="Confirmer"
        loading={confirming}
        onConfirm={confirmDelivery}
        onCancel={() => setPendingConfirm(null)}
      />
      <ConfirmDialog
        visible={!!pendingRemove}
        title="Retirer cet article ?"
        message="Cet article sera retiré de votre commande et le total sera mis à jour."
        confirmLabel="Retirer"
        destructive
        loading={removing}
        onConfirm={confirmRemoveItem}
        onCancel={() => setPendingRemove(null)}
      />
    </View>
  );
}

function OrderCard({
  order,
  onConfirmDelivery,
  confirming,
  onRemoveItem,
}: {
  order: Order;
  onConfirmDelivery: () => void;
  confirming: boolean;
  onRemoveItem: (index: number) => void;
}) {
  const canEditItems = order.status === 'pending' && order.items.length > 1;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.orderId}>Commande #{order.id.slice(0, 8)}</Text>
        <Text style={styles.status}>{STATUS_LABELS[order.status]}</Text>
      </View>
      <Text style={styles.date}>
        {new Date(order.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
      </Text>

      <OrderStatusStepper status={order.status} />

      <View style={styles.itemsList}>
        {order.items.map((oi, idx) => (
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
            {canEditItems && (
              <Pressable onPress={() => onRemoveItem(idx)} hitSlop={8} style={styles.removeItemBtn}>
                <Text style={styles.removeItemText}>✕</Text>
              </Pressable>
            )}
          </View>
        ))}
      </View>
      {canEditItems && (
        <Text style={styles.editHint}>Touchez ✕ pour retirer un article tant que la commande est en attente.</Text>
      )}

      <View style={styles.footer}>
        <Text style={styles.paymentMethod}>{PAYMENT_LABELS[order.payment_method] ?? order.payment_method}</Text>
        <Text style={styles.total}>{formatXAF(order.total)}</Text>
      </View>

      {order.status === 'shipped' && (
        <GoldButton
          label="Confirmer la réception"
          onPress={onConfirmDelivery}
          loading={confirming}
          style={{ marginTop: spacing.md }}
        />
      )}

      {order.status === 'pending' && !order.is_flagged_fake && (
        <View style={styles.deadlineBox}>
          <Text style={styles.deadlineLabel}>Merci de confirmer sous 48h, sinon la commande sera signalée :</Text>
          <CountdownTimer endsAt={getFlagDeadline(order.created_at)} />
        </View>
      )}

      <View style={styles.cardWarning}>
        <View style={styles.warningDot} />
        <Text style={styles.cardWarningText}>
          Si vous faites 3 fausses commandes (non honorées), votre compte sera banni.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  empty: { color: colors.creamFaint, fontFamily: fonts.body, textAlign: 'center', marginTop: 40, paddingHorizontal: 20 },
  warningDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.red,
    marginTop: 3,
  },
  cardWarning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: '#f5c542',
    borderRadius: radius.sm,
    padding: 8,
    marginTop: spacing.sm,
  },
  cardWarningText: { flex: 1, color: '#3a2c00', fontFamily: fonts.bodyMedium, fontSize: 10.5, lineHeight: 14 },
  deadlineBox: {
    backgroundColor: colors.panelAlt,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginTop: spacing.sm,
    alignItems: 'center',
    gap: 6,
  },
  deadlineLabel: { color: colors.creamFaint, fontFamily: fonts.bodyMedium, fontSize: 10.5, textAlign: 'center' },
  card: {
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  orderId: { color: colors.cream, fontFamily: fonts.bodyBold, fontSize: 14 },
  status: { color: colors.goldLight, fontFamily: fonts.bodySemiBold, fontSize: 12 },
  date: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 12, marginBottom: 10 },
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
  removeItemBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.red,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  removeItemText: { color: colors.cream, fontFamily: fonts.bodyBold, fontSize: 12 },
  editHint: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 10, marginTop: -4, marginBottom: spacing.sm },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  paymentMethod: { color: colors.creamMuted, fontFamily: fonts.bodyMedium, fontSize: 12 },
  total: { color: colors.goldLight, fontFamily: fonts.displayBold, fontSize: 17 },
});
