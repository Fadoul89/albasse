import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useCartStore } from '../store/cartStore';
import { colors, fonts, radius, spacing } from '../theme';

const IDLE_THRESHOLD_MS = 5 * 60 * 1000;
const CHECK_INTERVAL_MS = 30 * 1000;

export function CartReminderBanner() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const items = useCartStore((s) => s.items);
  const updatedAt = useCartStore((s) => s.updatedAt);
  const [dismissed, setDismissed] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setDismissed(false);
  }, [updatedAt]);

  const isIdle = items.length > 0 && updatedAt !== null && now - updatedAt >= IDLE_THRESHOLD_MS;

  if (!isIdle || dismissed) return null;

  const firstProduct = items[0]?.product.name;
  const extraCount = items.length - 1;

  return (
    <Pressable style={styles.banner} onPress={() => navigation.navigate('Tabs', { screen: 'Cart' } as never)}>
      <Text style={styles.icon}>🛒</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>Vous avez oublié quelque chose dans votre panier</Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {firstProduct}
          {extraCount > 0 ? ` et ${extraCount} autre(s) article(s)` : ''}
        </Text>
      </View>
      <Pressable
        hitSlop={10}
        onPress={(e) => {
          e.stopPropagation();
          setDismissed(true);
        }}
      >
        <Text style={styles.close}>✕</Text>
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    gap: 10,
  },
  icon: { fontSize: 24 },
  title: { color: colors.goldLight, fontFamily: fonts.bodySemiBold, fontSize: 13 },
  subtitle: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 11, marginTop: 2 },
  close: { color: colors.creamFaint, fontSize: 16, paddingHorizontal: 4 },
});
