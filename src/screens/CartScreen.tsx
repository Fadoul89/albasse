import React from 'react';
import { View, Text, StyleSheet, FlatList, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts, radius, spacing } from '../theme';
import { useCartStore } from '../store/cartStore';
import { GoldButton } from '../components/GoldButton';
import type { CartItem } from '../types';

const formatXAF = (n: number) => `${n.toLocaleString('fr-FR')} FCFA`;

export function CartScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const items = useCartStore((s) => s.items);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);
  const total = useCartStore((s) => s.total());

  if (items.length === 0) {
    return (
      <View style={styles.screen}>
        <Text style={styles.headerTitle}>Mon Panier</Text>
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyIcon}>🛍️</Text>
          <Text style={styles.emptyText}>Votre panier est vide</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.headerTitle}>Mon Panier</Text>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: spacing.md, paddingBottom: 20 }}
        renderItem={({ item }) => (
          <CartRow item={item} onUpdateQuantity={updateQuantity} onRemove={removeItem} />
        )}
      />
      <View style={styles.footer}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>{formatXAF(total)}</Text>
        </View>
        <GoldButton label="Passer la commande" onPress={() => navigation.navigate('Checkout')} />
      </View>
    </View>
  );
}

function CartRow({
  item,
  onUpdateQuantity,
  onRemove,
}: {
  item: CartItem;
  onUpdateQuantity: (id: string, qty: number) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <View style={styles.row}>
      <Image source={{ uri: item.product.images[0] }} style={styles.thumb} contentFit="cover" />
      <View style={{ flex: 1 }}>
        <Text style={styles.name} numberOfLines={1}>
          {item.product.name}
        </Text>
        <Text style={styles.variant}>
          {[item.color, item.size].filter(Boolean).join(' · ') || 'Standard'}
        </Text>
        <Text style={styles.price}>{formatXAF(item.product.price)}</Text>
        <View style={styles.qtyRow}>
          <Pressable style={styles.qtyBtn} onPress={() => onUpdateQuantity(item.id, item.quantity - 1)}>
            <Text style={styles.qtyBtnText}>−</Text>
          </Pressable>
          <Text style={styles.qtyValue}>{item.quantity}</Text>
          <Pressable style={styles.qtyBtn} onPress={() => onUpdateQuantity(item.id, item.quantity + 1)}>
            <Text style={styles.qtyBtnText}>+</Text>
          </Pressable>
          <Pressable onPress={() => onRemove(item.id)} style={{ marginLeft: 'auto' }}>
            <Text style={styles.remove}>Retirer</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, paddingTop: 50 },
  headerTitle: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.cream,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 15 },
  row: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  thumb: { width: 76, height: 90, borderRadius: radius.sm },
  name: { color: colors.cream, fontFamily: fonts.bodySemiBold, fontSize: 14 },
  variant: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
  price: { color: colors.goldLight, fontFamily: fonts.bodyBold, fontSize: 14, marginTop: 4 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  qtyBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.panelAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBtnText: { color: colors.gold, fontFamily: fonts.bodyBold },
  qtyValue: { color: colors.cream, fontFamily: fonts.bodyMedium, fontSize: 13 },
  remove: { color: colors.red, fontFamily: fonts.bodyMedium, fontSize: 12 },
  footer: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.panelAlt,
  },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.md },
  totalLabel: { color: colors.creamMuted, fontFamily: fonts.bodyMedium, fontSize: 15 },
  totalValue: { color: colors.goldLight, fontFamily: fonts.displayBold, fontSize: 20 },
});
