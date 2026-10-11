import React, { useEffect, useState } from 'react';
import { FlatList, Linking, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius, spacing } from '../theme';
import { formatXAF } from '../lib/format';
import { getAllOrders, updateOrderStatus } from '../lib/orders';
import { useAuthStore } from '../store/authStore';
import { ScreenHeader } from '../components/ScreenHeader';
import { ORDER_STATUSES, STATUS_COLORS, STATUS_LABELS } from '../constants/orderStatus';
import type { Order } from '../types/order';

export default function AdminOrdersScreen() {
  const profile = useAuthStore((s) => s.profile);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const load = () => {
    setIsLoading(true);
    getAllOrders().then((data) => {
      setOrders(data);
      setIsLoading(false);
    });
  };

  useEffect(() => {
    if (profile?.is_admin) load();
    else setIsLoading(false);
  }, [profile?.id]);

  const handleChangeStatus = async (order: Order, status: Order['status']) => {
    if (status === order.status) return;
    setUpdatingId(order.id);
    const { error } = await updateOrderStatus(order.id, status);
    setUpdatingId(null);
    if (!error) {
      setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status } : o)));
    }
  };

  if (!profile?.is_admin) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Commandes (admin)" showBack />
        <Text style={styles.denied}>Accès réservé aux administrateurs.</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Commandes (admin)" showBack />
      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={load} tintColor={colors.gold} />}
        ListEmptyComponent={!isLoading ? <Text style={styles.empty}>Aucune commande pour le moment.</Text> : null}
        renderItem={({ item }) => {
          const expanded = expandedId === item.id;
          return (
            <Pressable style={styles.card} onPress={() => setExpandedId(expanded ? null : item.id)}>
              <View style={styles.cardHeader}>
                <Text style={styles.date}>
                  {new Date(item.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </Text>
                <View style={[styles.badge, { backgroundColor: STATUS_COLORS[item.status] + '26', borderColor: STATUS_COLORS[item.status] }]}>
                  <Text style={[styles.badgeText, { color: STATUS_COLORS[item.status] }]}>{STATUS_LABELS[item.status]}</Text>
                </View>
              </View>

              <Text style={styles.customer}>{item.shipping_name}</Text>
              <Pressable onPress={() => Linking.openURL(`tel:${item.shipping_phone}`)}>
                <Text style={styles.phone}>📞 {item.shipping_phone}</Text>
              </Pressable>
              <Text style={styles.address} numberOfLines={1}>📍 {item.shipping_address}</Text>

              {item.items.map((line, i) => (
                <Text key={i} style={styles.line} numberOfLines={1}>
                  {line.quantity}× {line.product_name}
                </Text>
              ))}
              <Text style={styles.total}>{formatXAF(item.total)}</Text>

              {expanded && (
                <View style={styles.statusRow}>
                  {ORDER_STATUSES.map((s) => (
                    <Pressable
                      key={s}
                      style={[styles.statusChip, item.status === s && { backgroundColor: STATUS_COLORS[s], borderColor: STATUS_COLORS[s] }]}
                      disabled={updatingId === item.id}
                      onPress={() => handleChangeStatus(item, s)}
                    >
                      <Text style={[styles.statusChipText, item.status === s && styles.statusChipTextActive]}>{STATUS_LABELS[s]}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  denied: { color: colors.creamFaint, fontFamily: fonts.body, textAlign: 'center', marginTop: 40 },
  list: { padding: spacing.md, gap: spacing.sm, paddingBottom: 60 },
  empty: { color: colors.creamFaint, fontFamily: fonts.body, textAlign: 'center', marginTop: 40 },
  card: {
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  date: { color: colors.creamMuted, fontFamily: fonts.bodyMedium, fontSize: 12 },
  badge: { borderRadius: radius.pill, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontFamily: fonts.bodySemiBold, fontSize: 11 },
  customer: { color: colors.cream, fontFamily: fonts.bodySemiBold, fontSize: 14, marginBottom: 2 },
  phone: { color: colors.gold, fontFamily: fonts.bodyMedium, fontSize: 12.5, marginBottom: 2 },
  address: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 12, marginBottom: 6 },
  line: { color: colors.creamMuted, fontFamily: fonts.body, fontSize: 12.5, marginBottom: 2 },
  total: { color: colors.goldLight, fontFamily: fonts.bodyBold, fontSize: 15, marginTop: spacing.sm },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  statusChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.panelAlt,
  },
  statusChipText: { color: colors.creamMuted, fontFamily: fonts.bodyMedium, fontSize: 11 },
  statusChipTextActive: { color: colors.background, fontFamily: fonts.bodyBold },
});
