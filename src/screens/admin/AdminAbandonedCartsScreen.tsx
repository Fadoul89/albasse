import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Linking } from 'react-native';
import { useAuthStore } from '../../store/authStore';
import { useAbandonedCarts, type AbandonedCart } from '../../hooks/useAbandonedCarts';
import { formatRelativeTime } from '../../lib/formatDuration';
import { colors, fonts, radius, spacing } from '../../theme';
import { ScreenHeader } from '../../components/ScreenHeader';

function whatsappMessage(cart: AbandonedCart): string {
  const firstProduct = cart.products[0]?.name ?? 'un article';
  return `Bonjour ${cart.name} 👋, vous avez laissé "${firstProduct}" dans votre panier chez Albasse Shopping. Il est toujours disponible ! Souhaitez-vous de l'aide pour finaliser votre commande ?`;
}

export function AdminAbandonedCartsScreen() {
  const profile = useAuthStore((s) => s.profile);
  const { carts, isLoading } = useAbandonedCarts();

  if (!profile?.is_admin) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Admin" showBack />
        <Text style={styles.denied}>Accès réservé aux administrateurs.</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Paniers abandonnés" showBack />
      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 60 }}>
        <Text style={styles.note}>
          Clients connectés ayant ajouté des articles au panier sans commander depuis. La relance se fait
          manuellement, en un clic, et respecte le consentement du client (aucun message automatique n'est envoyé).
        </Text>

        {isLoading ? (
          <Text style={styles.loading}>Chargement…</Text>
        ) : carts.length === 0 ? (
          <Text style={styles.emptyText}>Aucun panier abandonné pour le moment. ✓</Text>
        ) : (
          carts.map((cart) => (
            <View key={cart.userId} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.name}>{cart.name}</Text>
                <Text style={styles.time}>{formatRelativeTime(cart.lastActivityAt)}</Text>
              </View>

              <View style={styles.productsWrap}>
                {cart.products.map((p) => (
                  <View key={p.productId} style={styles.productChip}>
                    <Text style={styles.productChipText} numberOfLines={1}>
                      {p.name}
                      {p.quantity > 1 ? ` ×${p.quantity}` : ''}
                    </Text>
                  </View>
                ))}
              </View>

              <View style={styles.actionsRow}>
                {cart.phone ? (
                  <>
                    <Pressable
                      style={styles.whatsappBtn}
                      onPress={() =>
                        Linking.openURL(
                          `https://wa.me/${cart.phone!.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                            whatsappMessage(cart)
                          )}`
                        )
                      }
                    >
                      <Text style={styles.whatsappBtnText}>💬 Relancer sur WhatsApp</Text>
                    </Pressable>
                    <Pressable
                      style={styles.callBtn}
                      onPress={() => Linking.openURL(`tel:${cart.phone!.replace(/\s/g, '')}`)}
                    >
                      <Text style={styles.callBtnText}>📞</Text>
                    </Pressable>
                  </>
                ) : (
                  <Text style={styles.noPhone}>Pas de numéro enregistré</Text>
                )}
              </View>
            </View>
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
  note: {
    color: colors.creamMuted,
    fontFamily: fonts.body,
    fontSize: 11,
    lineHeight: 16,
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  card: {
    backgroundColor: colors.panel,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  name: { color: colors.cream, fontFamily: fonts.bodySemiBold, fontSize: 14 },
  time: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 11 },
  productsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: spacing.md },
  productChip: {
    backgroundColor: colors.panelAlt,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
    maxWidth: 220,
  },
  productChipText: { color: colors.creamMuted, fontFamily: fonts.body, fontSize: 11 },
  actionsRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  whatsappBtn: {
    flex: 1,
    backgroundColor: '#25d366',
    borderRadius: radius.pill,
    paddingVertical: 10,
    alignItems: 'center',
  },
  whatsappBtnText: { color: '#0c0c0f', fontFamily: fonts.bodyBold, fontSize: 12 },
  callBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  callBtnText: { fontSize: 16 },
  noPhone: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 11, fontStyle: 'italic' },
});
