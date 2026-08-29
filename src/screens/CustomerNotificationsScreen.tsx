import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useCustomerNotifications } from '../hooks/useCustomerNotifications';
import { formatRelativeTime } from '../lib/formatDuration';
import { colors, fonts, radius, spacing } from '../theme';
import { ScreenHeader } from '../components/ScreenHeader';

export function CustomerNotificationsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { items, isLoading, markAllSeen } = useCustomerNotifications();

  useEffect(() => {
    markAllSeen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Notifications" showBack />
      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 60 }}>
        {isLoading ? (
          <Text style={styles.loading}>Chargement…</Text>
        ) : items.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyIcon}>🔔</Text>
            <Text style={styles.emptyText}>Aucune notification pour le moment.</Text>
          </View>
        ) : (
          items.map((n) => (
            <Pressable
              key={n.id}
              style={styles.card}
              onPress={() => n.productSlug && navigation.navigate('Product', { slug: n.productSlug })}
            >
              <Text style={styles.icon}>🛍️</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{n.title}</Text>
                <Text style={styles.message}>{n.message}</Text>
                <Text style={styles.time}>{formatRelativeTime(n.created_at)}</Text>
              </View>
            </Pressable>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  loading: { color: colors.creamFaint, fontFamily: fonts.body, textAlign: 'center', marginTop: 40 },
  emptyWrap: { alignItems: 'center', marginTop: 60 },
  emptyIcon: { fontSize: 36, marginBottom: 10 },
  emptyText: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 13 },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.panel,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: 10,
  },
  icon: { fontSize: 20 },
  title: { color: colors.cream, fontFamily: fonts.bodySemiBold, fontSize: 13 },
  message: { color: colors.creamMuted, fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
  time: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 10, marginTop: 4 },
});
