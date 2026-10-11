import React, { useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius, spacing } from '../theme';
import { formatXAF } from '../lib/format';
import { getMyOrders } from '../lib/orders';
import { useAuthStore } from '../store/authStore';
import { ScreenHeader } from '../components/ScreenHeader';
import { STATUS_COLORS, STATUS_LABELS } from '../constants/orderStatus';
import type { Order } from '../types/order';

export default function OrdersScreen() {
  const profile = useAuthStore((s) => s.profile);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = () => {
    if (!profile) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    getMyOrders(profile.id).then((data) => {
      setOrders(data);
      setIsLoading(false);
    });
  };

  useEffect(load, [profile?.id]);

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Mes commandes" showBack />
      {isLoading && orders.length === 0 ? (
        <Text style={styles.loading}>Chargement…</Text>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={load} tintColor={colors.gold} />}
          ListEmptyComponent={<Text style={styles.empty}>Vous n'avez pas encore de commande.</Text>}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.date}>
                  {new Date(item.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
                </Text>
                <View style={[styles.badge, { backgroundColor: STATUS_COLORS[item.status] + '26', borderColor: STATUS_COLORS[item.status] }]}>
                  <Text style={[styles.badgeText, { color: STATUS_COLORS[item.status] }]}>{STATUS_LABELS[item.status]}</Text>
                </View>
              </View>
              {item.items.map((line, i) => (
                <Text key={i} style={styles.line} numberOfLines={1}>
                  {line.quantity}× {line.product_name}
                </Text>
              ))}
              <Text style={styles.total}>{formatXAF(item.total)}</Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  loading: { color: colors.creamFaint, fontFamily: fonts.body, textAlign: 'center', marginTop: 40 },
  list: { padding: spacing.md, gap: spacing.sm },
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
  line: { color: colors.cream, fontFamily: fonts.body, fontSize: 13, marginBottom: 2 },
  total: { color: colors.goldLight, fontFamily: fonts.bodyBold, fontSize: 15, marginTop: spacing.sm },
});
