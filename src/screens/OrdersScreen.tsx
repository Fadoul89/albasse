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
import { GIFT_IMAGE } from '../components/GiftWrapOption';
import { GIFT_WRAP_FEE } from '../constants/shopRules';
import { LOYALTY_DISCOUNT_RATE } from '../lib/loyaltyDiscount';
import { useToastStore } from '../store/toastStore';
import { CountdownTimer } from '../components/CountdownTimer';
import { formatOrderDate, getOrderDay } from '../lib/formatDuration';
import type { Order, OrderStatus } from '../types';
import { sizedImage } from '../lib/imageSize';

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
  const [pendingGift, setPendingGift] = useState<{ order: Order; action: 'add' | 'remove' } | null>(null);
  const [giftBusy, setGiftBusy] = useState(false);
  const showToast = useToastStore((st) => st.show);

  if (!profile) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Mes commandes" />
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
    const itemsTotal = newItems.reduce((sum, oi) => sum + oi.unit_price * oi.quantity, 0);
    // la remise fidélité suit les articles qui restent
    const newDiscount = order.loyalty_discount ? Math.round(itemsTotal * LOYALTY_DISCOUNT_RATE) : 0;
    const newTotal = itemsTotal - newDiscount + (order.gift_wrap ? GIFT_WRAP_FEE : 0);
    setRemoving(true);
    const { error } = await supabase
      .from('orders')
      .update({ items: newItems, total: newTotal, ...(order.loyalty_discount ? { loyalty_discount: newDiscount } : {}) })
      .eq('id', order.id);
    setRemoving(false);
    if (error) {
      console.error('Erreur retrait article:', error);
      return;
    }
    setPendingRemove(null);
    refresh();
  };

  // Emballage cadeau : 2 000 FCFA ajoutes (ou retires) au total, tant que la commande est en attente.
  const confirmGift = async () => {
    if (!pendingGift) return;
    const { order, action } = pendingGift;
    const adding = action === 'add';
    const total = Number(order.total);
    setGiftBusy(true);
    const { error } = await supabase
      .from('orders')
      .update({ gift_wrap: adding, total: adding ? total + GIFT_WRAP_FEE : Math.max(0, total - GIFT_WRAP_FEE) })
      .eq('id', order.id);
    setGiftBusy(false);
    if (error) {
      console.error('Erreur emballage cadeau:', error);
      showToast("Impossible de modifier l'emballage cadeau. Réessayez dans un instant.", { title: 'Emballage cadeau', type: 'error' });
      return;
    }
    setPendingGift(null);
    refresh();
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Mes commandes" />
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
            onGift={(action) => setPendingGift({ order: item, action })}
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
        visible={!!pendingGift}
        title={pendingGift?.action === 'remove' ? "Retirer l'emballage cadeau ?" : "Ajouter l'emballage cadeau ?"}
        message={
          pendingGift
            ? pendingGift.action === 'remove'
              ? `Le total de votre commande passera à ${formatXAF(Math.max(0, Number(pendingGift.order.total) - GIFT_WRAP_FEE))}.`
              : `Votre commande sera emballée pour ${formatXAF(GIFT_WRAP_FEE)}. Le total passera à ${formatXAF(Number(pendingGift.order.total) + GIFT_WRAP_FEE)}.`
            : ''
        }
        confirmLabel={pendingGift?.action === 'remove' ? 'Retirer' : 'Ajouter'}
        destructive={pendingGift?.action === 'remove'}
        loading={giftBusy}
        onConfirm={confirmGift}
        onCancel={() => setPendingGift(null)}
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
  onGift,
}: {
  order: Order;
  onConfirmDelivery: () => void;
  confirming: boolean;
  onRemoveItem: (index: number) => void;
  onGift: (action: 'add' | 'remove') => void;
}) {
  const canEditItems = order.status === 'pending' && order.items.length > 1;
  const canEditGift = order.status === 'pending';

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.orderId}>Commande #{order.id.slice(0, 8)}</Text>
        <Text style={styles.status}>{STATUS_LABELS[order.status]}</Text>
      </View>
      <View style={styles.dateRow}>
        <Text style={styles.date}>{formatOrderDate(order.created_at)}</Text>
        {getOrderDay(order.created_at) === 'today' && (
          <View style={styles.todayBadge}>
            <Text style={styles.todayBadgeText}>Aujourd'hui</Text>
          </View>
        )}
        {getOrderDay(order.created_at) === 'yesterday' && (
          <View style={styles.yesterdayBadge}>
            <Text style={styles.yesterdayBadgeText}>Hier</Text>
          </View>
        )}
      </View>

      <OrderStatusStepper status={order.status} />

      <View style={styles.itemsList}>
        {order.items.map((oi, idx) => (
          <View key={`${oi.product_id}-${idx}`} style={styles.itemRow}>
            {oi.product_image ? (
              <Image source={{ uri: sizedImage(oi.product_image, 200) }} style={styles.itemImage} contentFit="cover" />
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

      {order.loyalty_discount ? (
        <Text style={styles.loyaltyLine} testID="order-loyalty-discount">{`⭐ Remise fidélité −10 % : −${formatXAF(order.loyalty_discount)} (déjà déduite du total)`}</Text>
      ) : null}

      {order.gift_wrap ? (
        <View style={[styles.giftRow, styles.giftRowOn]} testID="order-gift-on">
          <Image source={GIFT_IMAGE} style={styles.giftImage} contentFit="contain" />
          <View style={{ flex: 1 }}>
            <Text style={styles.giftTitle}>🎁 Emballage cadeau ajouté</Text>
            <Text style={styles.giftSub}>{`${formatXAF(GIFT_WRAP_FEE)} inclus dans le total`}</Text>
          </View>
          {canEditGift ? (
            <Pressable onPress={() => onGift('remove')} hitSlop={8} accessibilityRole="button" accessibilityLabel="Retirer l'emballage cadeau">
              <Text style={styles.giftLink}>Retirer</Text>
            </Pressable>
          ) : null}
        </View>
      ) : canEditGift ? (
        <Pressable
          style={styles.giftRow}
          onPress={() => onGift('add')}
          accessibilityRole="button"
          accessibilityLabel={`Ajouter l'emballage cadeau, ${formatXAF(GIFT_WRAP_FEE)}`}
          testID="order-gift-add"
        >
          <Image source={GIFT_IMAGE} style={styles.giftImage} contentFit="contain" />
          <View style={{ flex: 1 }}>
            <Text style={styles.giftTitle}>Ajouter l'emballage cadeau</Text>
            <Text style={styles.giftSub}>{`Touchez l'image cadeau · + ${formatXAF(GIFT_WRAP_FEE)}`}</Text>
          </View>
          <Text style={styles.giftPlus}>+</Text>
        </Pressable>
      ) : null}

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
  loyaltyLine: { color: colors.success, fontFamily: fonts.bodySemiBold, fontSize: 12, marginTop: 8 },
  giftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.panelAlt,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    padding: 8,
    marginBottom: spacing.sm,
  },
  giftRowOn: { borderStyle: 'solid', borderColor: colors.gold },
  giftImage: { width: 46, height: 46 },
  giftTitle: { color: colors.cream, fontFamily: fonts.bodySemiBold, fontSize: 13 },
  giftSub: { color: colors.creamMuted, fontFamily: fonts.body, fontSize: 11, marginTop: 2 },
  giftPlus: { color: colors.gold, fontFamily: fonts.bodyBold, fontSize: 24, paddingHorizontal: 6 },
  giftLink: { color: colors.goldLight, fontFamily: fonts.bodySemiBold, fontSize: 12, textDecorationLine: 'underline' },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  paymentMethod: { color: colors.creamMuted, fontFamily: fonts.bodyMedium, fontSize: 12 },
  total: { color: colors.goldLight, fontFamily: fonts.displayBold, fontSize: 17 },
});
