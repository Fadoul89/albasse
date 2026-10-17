import React from 'react';
import { View, Text, Pressable, StyleSheet, type TextStyle } from 'react-native';
import { Image } from 'expo-image';
import { colors, fonts, radius } from '../theme';
import { useCartStore } from '../store/cartStore';
import type { Lang } from '../lib/assistantLang';
import { fcfa, texts } from '../lib/assistantText';

// Le panier dans la conversation : c'est le même panier que celui du site (même magasin de données),
// donc toujours à jour, ici comme sur la page « Panier ». Les prix sont ceux relus dans la base par Zara.

const rtlStyle = (rtl: boolean): TextStyle | null => (rtl ? { writingDirection: 'rtl', textAlign: 'right' } : null);

export function ChatCart({
  lang,
  city,
  onCheckout,
  onOpenFull,
}: {
  lang: Lang;
  city: { name: string; fee: number | null } | null;
  onCheckout: () => void;
  onOpenFull: () => void;
}) {
  const t = texts(lang).cart.ui;
  const rtl = rtlStyle(lang === 'ar');
  const items = useCartStore((s) => s.items);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);

  if (items.length === 0) return null;
  const count = items.reduce((n, i) => n + i.quantity, 0);
  const subtotal = items.reduce((sum, i) => sum + i.product.price * i.quantity, 0);
  // seulement les remises réelles (ancien prix barré dans la base)
  const saved = items.reduce((sum, i) => (i.product.compare_at_price && i.product.compare_at_price > i.product.price ? sum + (i.product.compare_at_price - i.product.price) * i.quantity : sum), 0);
  const fee = city && city.fee !== null ? city.fee : null;

  return (
    <View style={styles.card} testID="chat-cart">
      <Text style={[styles.count, rtl]}>{t.items(count)}</Text>
      {items.map((i) => {
        const name = i.product.name;
        const variant = [i.size ? texts(lang).cart.sizeLabel(i.size) : null, i.color].filter(Boolean).join(' · ');
        const overStock = i.product.stock <= 0 || i.quantity > i.product.stock;
        return (
          <View key={i.id} style={styles.row} testID="chat-cart-item">
            {i.product.images?.[0] ? <Image source={{ uri: i.product.images[0] }} style={styles.thumb} contentFit="cover" /> : <View style={[styles.thumb, styles.thumbEmpty]} />}
            <View style={styles.info}>
              <Text style={[styles.name, rtl]} numberOfLines={2}>
                {name}
              </Text>
              {variant ? <Text style={[styles.variant, rtl]}>{variant}</Text> : null}
              <Text style={[styles.unit, rtl]}>
                {fcfa(i.product.price)} {t.unitPrice}
              </Text>
              {overStock ? <Text style={[styles.warn, rtl]}>⚠️ {i.product.stock > 0 ? i.product.stock : 0}</Text> : null}
              <View style={styles.lineBottom}>
                <View style={styles.stepper}>
                  <Pressable
                    testID="chat-cart-minus"
                    onPress={() => updateQuantity(i.id, i.quantity - 1)}
                    style={styles.stepBtn}
                    accessibilityRole="button"
                    accessibilityLabel={t.less(name)}
                    hitSlop={6}
                  >
                    <Text style={styles.stepText}>−</Text>
                  </Pressable>
                  <Text style={styles.qty} testID="chat-cart-qty">
                    {i.quantity}
                  </Text>
                  <Pressable
                    testID="chat-cart-plus"
                    onPress={() => updateQuantity(i.id, i.quantity + 1)}
                    disabled={i.product.stock > 0 && i.quantity >= i.product.stock}
                    style={[styles.stepBtn, i.product.stock > 0 && i.quantity >= i.product.stock && styles.stepBtnOff]}
                    accessibilityRole="button"
                    accessibilityLabel={t.more(name)}
                    hitSlop={6}
                  >
                    <Text style={styles.stepText}>+</Text>
                  </Pressable>
                </View>
                <Text style={styles.sub} testID="chat-cart-subtotal">
                  {fcfa(i.product.price * i.quantity)}
                </Text>
              </View>
            </View>
            <Pressable testID="chat-cart-remove" onPress={() => removeItem(i.id)} style={styles.remove} accessibilityRole="button" accessibilityLabel={t.remove(name)} hitSlop={8}>
              <Text style={styles.removeText}>✕</Text>
            </Pressable>
          </View>
        );
      })}

      <View style={styles.totals}>
        <View style={styles.totalRow}>
          <Text style={[styles.label, rtl]}>{t.subtotal}</Text>
          <Text style={styles.value}>{fcfa(subtotal)}</Text>
        </View>
        {saved > 0 ? (
          <View style={styles.totalRow}>
            <Text style={[styles.label, styles.saved, rtl]}>{t.saved}</Text>
            <Text style={[styles.value, styles.saved]}>{fcfa(saved)}</Text>
          </View>
        ) : null}
        {city ? (
          <View style={styles.totalRow}>
            <Text style={[styles.label, rtl]}>{t.deliveryTo(city.name)}</Text>
            <Text style={styles.value}>{fee === null ? t.toConfirm : fee === 0 ? t.free : fcfa(fee)}</Text>
          </View>
        ) : (
          <Text style={[styles.note, rtl]}>
            {t.delivery} : {t.deliveryLater}
          </Text>
        )}
        <View style={[styles.totalRow, styles.grand]}>
          <Text style={[styles.grandLabel, rtl]}>{city && fee !== null && fee > 0 ? t.totalWithDelivery : t.total}</Text>
          <Text style={styles.grandValue} testID="chat-cart-total">
            {fcfa(subtotal + (fee ?? 0))}
          </Text>
        </View>
      </View>

      <Pressable testID="chat-cart-checkout" onPress={onCheckout} style={styles.checkout} accessibilityRole="button" accessibilityLabel={t.checkout}>
        <Text style={styles.checkoutText}>{t.checkout}</Text>
      </Pressable>
      <Pressable onPress={onOpenFull} accessibilityRole="link" accessibilityLabel={t.openFull} hitSlop={6}>
        <Text style={[styles.full, rtl]}>{t.openFull}</Text>
      </Pressable>
    </View>
  );
}

// Petite barre sous la conversation : nombre d'articles et total, mis à jour tout de suite à chaque ajout.
export function CartBar({ lang, onOpen }: { lang: Lang; onOpen: () => void }) {
  const t = texts(lang).cart.ui;
  const count = useCartStore((s) => s.count());
  const total = useCartStore((s) => s.total());
  if (count === 0) return null;
  return (
    <Pressable testID="chat-cart-bar" onPress={onOpen} style={styles.bar} accessibilityRole="button" accessibilityLabel={`${t.items(count)} · ${fcfa(total)}`}>
      <Text style={styles.barText}>
        🛒 {t.items(count)} · {fcfa(total)}
      </Text>
      <Text style={styles.barLink}>{t.view} ›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.panel, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: 10, gap: 10, minWidth: 240 },
  count: { color: colors.creamMuted, fontFamily: fonts.bodySemiBold, fontSize: 12 },
  row: { flexDirection: 'row', gap: 9, alignItems: 'flex-start' },
  thumb: { width: 50, height: 50, borderRadius: 8, backgroundColor: '#fff' },
  thumbEmpty: { backgroundColor: colors.panelAlt },
  info: { flex: 1, minWidth: 0, gap: 2 },
  name: { color: colors.cream, fontFamily: fonts.bodySemiBold, fontSize: 13, lineHeight: 17 },
  variant: { color: colors.creamMuted, fontFamily: fonts.body, fontSize: 11.5 },
  unit: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 11.5 },
  warn: { color: '#ffb347', fontFamily: fonts.bodySemiBold, fontSize: 11.5 },
  lineBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, gap: 8 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  stepBtn: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: colors.gold, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(199,154,62,0.10)' },
  stepBtnOff: { opacity: 0.35 },
  stepText: { color: colors.goldLight, fontFamily: fonts.bodyBold, fontSize: 16, lineHeight: 18 },
  qty: { color: colors.cream, fontFamily: fonts.bodyBold, fontSize: 14, minWidth: 18, textAlign: 'center' },
  sub: { color: colors.goldLight, fontFamily: fonts.bodyBold, fontSize: 13 },
  remove: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  removeText: { color: colors.creamFaint, fontSize: 14 },
  totals: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8, gap: 4 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  label: { color: colors.creamMuted, fontFamily: fonts.body, fontSize: 12.5, flexShrink: 1 },
  value: { color: colors.cream, fontFamily: fonts.bodySemiBold, fontSize: 12.5 },
  saved: { color: '#3ddc84' },
  note: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 11.5 },
  grand: { marginTop: 2 },
  grandLabel: { color: colors.cream, fontFamily: fonts.bodySemiBold, fontSize: 14, flexShrink: 1 },
  grandValue: { color: colors.goldLight, fontFamily: fonts.displayBold, fontSize: 17 },
  checkout: { backgroundColor: colors.gold, borderRadius: radius.pill, paddingVertical: 11, alignItems: 'center' },
  checkoutText: { color: '#1b1405', fontFamily: fonts.bodyBold, fontSize: 14 },
  full: { color: colors.gold, fontFamily: fonts.bodySemiBold, fontSize: 12, textAlign: 'center' },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.panelAlt,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  barText: { color: colors.cream, fontFamily: fonts.bodySemiBold, fontSize: 13, flexShrink: 1 },
  barLink: { color: colors.gold, fontFamily: fonts.bodyBold, fontSize: 13 },
});
