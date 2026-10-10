import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { colors, fonts, radius, spacing } from '../../theme';
import { formatXAF } from '../../lib/format';
import { useCartStore, useCartTotalPrice } from '../../store/cartStore';
import { GoldButton } from '../../components/GoldButton';

export default function CartScreen() {
  const items = useCartStore((s) => s.items);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);
  const total = useCartTotalPrice();

  if (items.length === 0) {
    return (
      <View style={styles.screen}>
        <Text style={styles.header}>Panier</Text>
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyIcon}>🛍️</Text>
          <Text style={styles.emptyText}>Votre panier est vide.</Text>
          <GoldButton
            label="Découvrir les produits"
            onPress={() => router.push('/(tabs)/categories')}
            style={{ marginTop: spacing.lg, width: 220 }}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.header}>Panier</Text>
      <FlatList
        data={items}
        keyExtractor={(item) => `${item.productId}-${item.color}-${item.size}`}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Image source={{ uri: item.image }} style={styles.image} contentFit="cover" />
            <View style={{ flex: 1 }}>
              <Text style={styles.name} numberOfLines={2}>
                {item.name}
              </Text>
              {(item.color || item.size) && (
                <Text style={styles.variant}>
                  {[item.color, item.size].filter(Boolean).join(' · ')}
                </Text>
              )}
              <Text style={styles.price}>{formatXAF(item.price)}</Text>
              <View style={styles.stepperRow}>
                <Pressable
                  style={styles.stepperBtn}
                  onPress={() => updateQuantity(item.productId, item.color, item.size, item.quantity - 1)}
                >
                  <Text style={styles.stepperBtnText}>−</Text>
                </Pressable>
                <Text style={styles.quantity}>{item.quantity}</Text>
                <Pressable
                  style={styles.stepperBtn}
                  onPress={() => updateQuantity(item.productId, item.color, item.size, item.quantity + 1)}
                >
                  <Text style={styles.stepperBtnText}>+</Text>
                </Pressable>
                <Pressable onPress={() => removeItem(item.productId, item.color, item.size)} style={{ marginLeft: 'auto' }}>
                  <Text style={styles.remove}>Retirer</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}
      />
      <View style={styles.footer}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>{formatXAF(total)}</Text>
        </View>
        <GoldButton label="Commander" onPress={() => router.push('/checkout')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    color: colors.cream,
    fontFamily: fonts.display,
    fontSize: 20,
    textAlign: 'center',
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 80 },
  emptyIcon: { fontSize: 44, marginBottom: 12 },
  emptyText: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 14 },
  list: { paddingHorizontal: spacing.md, paddingBottom: 12, gap: spacing.sm },
  row: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
  },
  image: { width: 72, height: 90, borderRadius: radius.sm, backgroundColor: colors.panelAlt },
  name: { color: colors.cream, fontFamily: fonts.bodyMedium, fontSize: 13 },
  variant: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 11, marginTop: 2 },
  price: { color: colors.goldLight, fontFamily: fonts.bodyBold, fontSize: 13, marginTop: 4 },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  stepperBtn: {
    width: 26,
    height: 26,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnText: { color: colors.gold, fontFamily: fonts.bodyBold, fontSize: 15 },
  quantity: { color: colors.cream, fontFamily: fonts.bodySemiBold, fontSize: 13, minWidth: 18, textAlign: 'center' },
  remove: { color: colors.red, fontFamily: fonts.bodySemiBold, fontSize: 11.5 },
  footer: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.panel,
    gap: spacing.sm,
  },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  totalLabel: { color: colors.creamMuted, fontFamily: fonts.body, fontSize: 13 },
  totalValue: { color: colors.goldLight, fontFamily: fonts.displayBold, fontSize: 20 },
});
