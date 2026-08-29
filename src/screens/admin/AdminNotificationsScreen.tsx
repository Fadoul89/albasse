import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { useAuthStore } from '../../store/authStore';
import { useAdminNotifications } from '../../hooks/useAdminNotifications';
import { formatRelativeTime } from '../../lib/formatDuration';
import { colors, fonts, radius, spacing } from '../../theme';
import { ScreenHeader } from '../../components/ScreenHeader';
import type { AdminNotification, AdminNotificationType } from '../../types';

const TYPE_ICON: Record<AdminNotificationType, string> = {
  new_order: '🛒',
  payment_received: '💳',
  order_delivered: '📦',
  new_customer: '👤',
  low_stock: '⚠️',
};

const TYPE_ROUTE: Record<AdminNotificationType, 'AdminOrders' | 'AdminCustomers' | 'AdminProducts'> = {
  new_order: 'AdminOrders',
  payment_received: 'AdminOrders',
  order_delivered: 'AdminOrders',
  new_customer: 'AdminCustomers',
  low_stock: 'AdminProducts',
};

export function AdminNotificationsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const profile = useAuthStore((s) => s.profile);
  const isAdmin = !!profile?.is_admin;
  const { notifications, unreadCount, isLoading, markAsRead, markAllAsRead } = useAdminNotifications(isAdmin);

  if (!isAdmin) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Admin" showBack />
        <Text style={styles.denied}>Accès réservé aux administrateurs.</Text>
      </View>
    );
  }

  const handlePress = (n: AdminNotification) => {
    if (!n.is_read) markAsRead(n.id);
    navigation.navigate(TYPE_ROUTE[n.type]);
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title="Notifications"
        showBack
        right={
          unreadCount > 0 ? (
            <Pressable onPress={markAllAsRead}>
              <Text style={styles.markAllText}>Tout lire</Text>
            </Pressable>
          ) : undefined
        }
      />
      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 60 }}>
        {isLoading ? (
          <Text style={styles.loading}>Chargement…</Text>
        ) : notifications.length === 0 ? (
          <Text style={styles.emptyText}>Aucune notification pour le moment.</Text>
        ) : (
          notifications.map((n) => (
            <Pressable
              key={n.id}
              style={[styles.card, !n.is_read && styles.cardUnread]}
              onPress={() => handlePress(n)}
            >
              <Text style={styles.icon}>{TYPE_ICON[n.type]}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{n.title}</Text>
                <Text style={styles.message} numberOfLines={2}>
                  {n.message}
                </Text>
                <Text style={styles.time}>{formatRelativeTime(n.created_at)}</Text>
              </View>
              {!n.is_read && <View style={styles.unreadDot} />}
            </Pressable>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  denied: { color: colors.creamFaint, fontFamily: fonts.body, textAlign: 'center', marginTop: 40 },
  loading: { color: colors.creamFaint, fontFamily: fonts.body, textAlign: 'center', marginTop: 40 },
  emptyText: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 13, textAlign: 'center', marginTop: 30 },
  markAllText: { color: colors.gold, fontFamily: fonts.bodyMedium, fontSize: 12 },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.panel,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: 10,
  },
  cardUnread: { borderWidth: 1, borderColor: colors.gold },
  icon: { fontSize: 20 },
  title: { color: colors.cream, fontFamily: fonts.bodySemiBold, fontSize: 13 },
  message: { color: colors.creamMuted, fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
  time: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 10, marginTop: 4 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.gold, marginTop: 4 },
});
