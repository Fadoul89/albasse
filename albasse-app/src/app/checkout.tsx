import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { colors, fonts, radius, spacing } from '../theme';
import { formatXAF } from '../lib/format';
import { useCartStore, useCartTotalPrice } from '../store/cartStore';
import { useAuthStore } from '../store/authStore';
import { usePaymentSettings } from '../hooks/useCities';
import { createOrder } from '../lib/orders';
import type { City } from '../types/city';
import type { PaymentMethod } from '../types/order';
import { ScreenHeader } from '../components/ScreenHeader';
import { GoldButton } from '../components/GoldButton';
import { CityPicker } from '../components/CityPicker';

const CHAD_PHONE_REGEX = /^[69]\d{7}$/;

const PAYMENT_OPTIONS: { value: PaymentMethod; label: string; icon: string }[] = [
  { value: 'airtel_money', label: 'Airtel Money', icon: '📱' },
  { value: 'moov_money', label: 'Moov Money', icon: '📲' },
  { value: 'cash_on_delivery', label: 'Paiement à la livraison', icon: '💵' },
];

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  airtel_money: 'Airtel Money',
  moov_money: 'Moov Money',
  cash_on_delivery: 'Paiement à la livraison',
  stripe: 'Carte bancaire',
};

export default function CheckoutScreen() {
  const items = useCartStore((s) => s.items);
  const clear = useCartStore((s) => s.clear);
  const total = useCartTotalPrice();
  const profile = useAuthStore((s) => s.profile);
  const { settings: paymentSettings } = usePaymentSettings();

  const [name, setName] = useState(profile?.full_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [selectedCity, setSelectedCity] = useState<City | null>(null);
  const [method, setMethod] = useState<PaymentMethod>('cash_on_delivery');
  const [submitting, setSubmitting] = useState(false);

  const deliveryFee = selectedCity?.delivery_fee ?? null;
  const grandTotal = total + (deliveryFee ?? 0);

  const paymentInfo =
    method === 'airtel_money'
      ? { number: paymentSettings?.airtel_number, url: paymentSettings?.airtel_payment_url }
      : method === 'moov_money'
      ? { number: paymentSettings?.moov_number, url: paymentSettings?.moov_payment_url }
      : null;

  const handleSubmit = async () => {
    if (!name.trim() || !phone.trim() || !address.trim() || !city) {
      Alert.alert('Champs manquants', 'Merci de remplir toutes les informations de livraison, y compris la ville.');
      return;
    }
    if (!CHAD_PHONE_REGEX.test(phone.trim())) {
      Alert.alert('Numéro invalide', 'Le numéro doit contenir 8 chiffres et commencer par 6 ou 9 (ex. 66123456).');
      return;
    }

    setSubmitting(true);
    const { order, error } = await createOrder({
      userId: profile?.id ?? null,
      items,
      total: grandTotal,
      paymentMethod: method,
      shippingName: name.trim(),
      shippingPhone: phone.trim(),
      shippingAddress: address.trim(),
      shippingCity: city,
    });

    if (error || !order) {
      setSubmitting(false);
      Alert.alert('Erreur', error ?? 'Impossible de créer la commande. Merci de réessayer.');
      return;
    }

    const methodLabel = PAYMENT_LABELS[method];
    let instructions: string | null = null;
    if (method === 'cash_on_delivery') {
      instructions = paymentSettings?.instructions ?? null;
    } else if (paymentInfo?.url) {
      instructions = `Payez ici : ${paymentInfo.url}`;
    } else if (paymentInfo?.number) {
      instructions = `Envoyez ${formatXAF(grandTotal)} au ${paymentInfo.number} (${methodLabel}).`;
    } else {
      instructions = `Notre équipe vous contactera au ${phone.trim()} pour finaliser le paiement ${methodLabel}.`;
    }

    setSubmitting(false);
    clear();
    router.replace({
      pathname: '/order-confirmation',
      params: { orderId: order.id, total: String(grandTotal), instructions: instructions ?? '' },
    });
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Commande" showBack />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>Livraison</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Nom complet"
          placeholderTextColor={colors.creamFaint}
          style={styles.input}
        />
        <TextInput
          value={phone}
          onChangeText={(text) => setPhone(text.replace(/\D/g, '').slice(0, 8))}
          placeholder="Numéro de téléphone (ex. 66123456)"
          placeholderTextColor={colors.creamFaint}
          keyboardType="phone-pad"
          maxLength={8}
          style={styles.input}
        />
        <TextInput
          value={address}
          onChangeText={setAddress}
          placeholder="Adresse (quartier, rue)"
          placeholderTextColor={colors.creamFaint}
          style={styles.input}
        />
        <CityPicker
          value={city}
          onChange={(v, c) => {
            setCity(v);
            setSelectedCity(c);
          }}
          showDeliveryInfo
        />

        <Text style={styles.sectionTitle}>Paiement</Text>
        {PAYMENT_OPTIONS.map((opt) => (
          <Pressable
            key={opt.value}
            style={[styles.paymentOption, method === opt.value && styles.paymentOptionActive]}
            onPress={() => setMethod(opt.value)}
          >
            <Text style={styles.paymentIcon}>{opt.icon}</Text>
            <Text style={styles.paymentLabel}>{opt.label}</Text>
            <View style={[styles.radio, method === opt.value && styles.radioActive]} />
          </Pressable>
        ))}

        {paymentInfo && (paymentInfo.number || paymentInfo.url) && (
          <View style={styles.paymentInfoBox}>
            {paymentInfo.number && <Text style={styles.paymentInfoText}>Numéro : {paymentInfo.number}</Text>}
            {paymentInfo.url && <Text style={styles.paymentInfoText}>Lien de paiement : {paymentInfo.url}</Text>}
          </View>
        )}

        <View style={styles.summary}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Sous-total</Text>
            <Text style={styles.summaryValue}>{formatXAF(total)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Livraison</Text>
            <Text style={styles.summaryValue}>
              {!selectedCity ? 'Sélectionnez une ville' : deliveryFee === null ? 'À définir' : deliveryFee === 0 ? 'Gratuite' : formatXAF(deliveryFee)}
            </Text>
          </View>
          <View style={[styles.summaryRow, { marginTop: 8 }]}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{formatXAF(grandTotal)}</Text>
          </View>
        </View>

        <GoldButton
          label="Confirmer la commande"
          onPress={handleSubmit}
          loading={submitting}
          disabled={items.length === 0}
          style={{ marginTop: spacing.md }}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.md, paddingBottom: 60 },
  sectionTitle: { fontFamily: fonts.display, fontSize: 17, color: colors.cream, marginTop: spacing.lg, marginBottom: spacing.md },
  input: {
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.cream,
    fontFamily: fonts.body,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  paymentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  paymentOptionActive: { borderColor: colors.gold },
  paymentIcon: { fontSize: 20, marginRight: 10 },
  paymentLabel: { flex: 1, color: colors.cream, fontFamily: fonts.bodyMedium, fontSize: 14 },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: colors.creamFaint },
  radioActive: { borderColor: colors.gold, backgroundColor: colors.gold },
  paymentInfoBox: { backgroundColor: colors.panelAlt, borderRadius: radius.md, padding: spacing.sm, marginTop: -4, marginBottom: spacing.sm, gap: 4 },
  paymentInfoText: { color: colors.goldLight, fontFamily: fonts.bodyMedium, fontSize: 13 },
  summary: { backgroundColor: colors.panel, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.lg },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  summaryLabel: { color: colors.creamMuted, fontFamily: fonts.body, fontSize: 13 },
  summaryValue: { color: colors.cream, fontFamily: fonts.bodyMedium, fontSize: 13 },
  totalLabel: { color: colors.cream, fontFamily: fonts.bodySemiBold, fontSize: 15 },
  totalValue: { color: colors.goldLight, fontFamily: fonts.displayBold, fontSize: 18 },
});
