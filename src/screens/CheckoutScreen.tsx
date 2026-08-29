import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts, radius, spacing } from '../theme';
import { useCartStore } from '../store/cartStore';
import { useAuthStore } from '../store/authStore';
import { useToastStore } from '../store/toastStore';
import { usePaymentSettings } from '../hooks/usePaymentSettings';
import { ScreenHeader } from '../components/ScreenHeader';
import { GoldButton } from '../components/GoldButton';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { createOrder } from '../lib/orders';
import { initiatePayment } from '../lib/payments';
import { CityPicker } from '../components/CityPicker';
import { trackTikTokEvent } from '../lib/tiktokPixel';
import type { PaymentMethod, City } from '../types';

const formatXAF = (n: number) => `${n.toLocaleString('fr-FR')} FCFA`;

const PAYMENT_OPTIONS: { value: PaymentMethod; label: string; icon: string }[] = [
  { value: 'airtel_money', label: 'Airtel Money', icon: '📱' },
  { value: 'moov_money', label: 'Moov Money', icon: '📲' },
  { value: 'cash_on_delivery', label: 'Paiement à la livraison', icon: '💵' },
];

export function CheckoutScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const items = useCartStore((s) => s.items);
  const total = useCartStore((s) => s.total());
  const clearCart = useCartStore((s) => s.clear);
  const profile = useAuthStore((s) => s.profile);

  useEffect(() => {
    trackTikTokEvent('InitiateCheckout', {
      value: total,
      currency: 'XAF',
      content_id: items.map((i) => i.product.id),
      contents: items.map((i) => ({ content_id: i.product.id, quantity: i.quantity })),
    });
  }, []);

  const [name, setName] = useState(profile?.full_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [selectedCity, setSelectedCity] = useState<City | null>(null);
  const [method, setMethod] = useState<PaymentMethod>('airtel_money');
  const [submitting, setSubmitting] = useState(false);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const showToast = useToastStore((s) => s.show);
  const { settings: paymentSettings } = usePaymentSettings();

  const deliveryFee = selectedCity?.delivery_fee ?? null;
  const grandTotal = total + (deliveryFee ?? 0);

  const paymentInfo =
    method === 'airtel_money'
      ? { number: paymentSettings?.airtel_number, url: paymentSettings?.airtel_payment_url }
      : method === 'moov_money'
      ? { number: paymentSettings?.moov_number, url: paymentSettings?.moov_payment_url }
      : null;

  const handleSubmit = async () => {
    if (!profile) {
      setShowLoginPrompt(true);
      return;
    }
    if (!name || !phone || !address || !city) {
      showToast('Merci de remplir toutes les informations de livraison.', { title: 'Champs manquants', type: 'error' });
      return;
    }

    setSubmitting(true);
    try {
      const { order, error } = await createOrder({
        userId: profile.id,
        items,
        total: grandTotal,
        paymentMethod: method,
        shippingName: name,
        shippingPhone: phone,
        shippingAddress: address,
        shippingCity: city,
      });

      if (error || !order) {
        console.error('Erreur création commande:', error);
        showToast(error ?? 'Impossible de créer la commande.', { title: 'Erreur', type: 'error' });
        return;
      }

      const payment = await initiatePayment({
        method,
        amount: grandTotal,
        phone,
        orderId: order.id,
      });

      const methodLabel = PAYMENT_OPTIONS.find((o) => o.value === method)?.label ?? method;

      let instructions: string | null = null;
      if (!payment.success) {
        console.log('Paiement non initié (normal si Mobile Money pas encore configuré):', payment.message);
        instructions = paymentInfo?.url
          ? `Payez ici : ${paymentInfo.url}`
          : paymentInfo?.number
          ? `Envoyez ${formatXAF(grandTotal)} au ${paymentInfo.number} (${methodLabel}).`
          : `Notre équipe vous contactera au ${phone} pour finaliser le paiement ${methodLabel}.`;
      } else {
        instructions = `Paiement ${methodLabel} initié. ${payment.message}`;
      }

      clearCart();
      navigation.navigate('OrderConfirmation', { orderId: order.id, total: grandTotal, instructions });
    } catch (e) {
      console.error('Exception création commande:', e);
      showToast(e instanceof Error ? e.message : String(e), { title: 'Erreur inattendue', type: 'error' });
    } finally {
      setSubmitting(false);
    }
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
          onChangeText={setPhone}
          placeholder="Numéro de téléphone"
          placeholderTextColor={colors.creamFaint}
          keyboardType="phone-pad"
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
            {paymentInfo.number && (
              <Text style={styles.paymentInfoText}>Numéro : {paymentInfo.number}</Text>
            )}
            {paymentInfo.url && (
              <Text style={styles.paymentInfoText}>Lien de paiement : {paymentInfo.url}</Text>
            )}
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
              {!selectedCity
                ? 'Sélectionnez une ville'
                : deliveryFee === null
                ? 'À définir'
                : deliveryFee === 0
                ? 'Gratuite'
                : formatXAF(deliveryFee)}
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
          style={{ marginTop: spacing.lg }}
        />
      </ScrollView>
      <ConfirmDialog
        visible={showLoginPrompt}
        title="Connexion requise"
        message="Veuillez vous connecter pour passer commande."
        confirmLabel="Se connecter"
        onConfirm={() => {
          setShowLoginPrompt(false);
          navigation.navigate('Login');
        }}
        onCancel={() => setShowLoginPrompt(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.md, paddingBottom: 60 },
  sectionTitle: {
    fontFamily: fonts.display,
    fontSize: 17,
    color: colors.cream,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
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
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.creamFaint,
  },
  radioActive: { borderColor: colors.gold, backgroundColor: colors.gold },
  paymentInfoBox: {
    backgroundColor: colors.panelAlt,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginTop: -4,
    marginBottom: spacing.sm,
    gap: 4,
  },
  paymentInfoText: { color: colors.goldLight, fontFamily: fonts.bodyMedium, fontSize: 13 },
  summary: {
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  summaryLabel: { color: colors.creamMuted, fontFamily: fonts.body, fontSize: 13 },
  summaryValue: { color: colors.cream, fontFamily: fonts.bodyMedium, fontSize: 13 },
  totalLabel: { color: colors.cream, fontFamily: fonts.bodySemiBold, fontSize: 15 },
  totalValue: { color: colors.goldLight, fontFamily: fonts.displayBold, fontSize: 18 },
});
