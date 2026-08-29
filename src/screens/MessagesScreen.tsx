import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useCustomerMessages } from '../hooks/useCustomerMessages';
import { ScreenHeader } from '../components/ScreenHeader';
import { colors, fonts, radius, spacing } from '../theme';

export function MessagesScreen() {
  const { messages, isLoading, markAllRead } = useCustomerMessages();

  useEffect(() => {
    markAllRead();
  }, [messages.length]);

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Messages" showBack />
      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 60 }}>
        {isLoading ? (
          <Text style={styles.emptyText}>Chargement…</Text>
        ) : messages.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyIcon}>✉️</Text>
            <Text style={styles.emptyText}>Vous n'avez reçu aucun message pour le moment.</Text>
          </View>
        ) : (
          messages.map((m) => (
            <View key={m.id} style={[styles.card, !m.is_read && styles.cardUnread]}>
              <Text style={styles.title}>{m.title}</Text>
              <Text style={styles.body}>{m.message}</Text>
              <Text style={styles.date}>
                {new Date(m.created_at).toLocaleDateString('fr-FR', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  emptyWrap: { alignItems: 'center', marginTop: 60, paddingHorizontal: spacing.lg },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyText: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 13, textAlign: 'center', lineHeight: 19 },
  card: {
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardUnread: { borderColor: colors.gold },
  title: { color: colors.goldLight, fontFamily: fonts.bodySemiBold, fontSize: 14, marginBottom: 4 },
  body: { color: colors.cream, fontFamily: fonts.body, fontSize: 13, lineHeight: 19 },
  date: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 10, marginTop: 8 },
});
