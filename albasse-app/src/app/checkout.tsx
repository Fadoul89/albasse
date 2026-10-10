import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { colors, fonts, radius, spacing } from '../theme';
import { formatXAF } from '../lib/format';
import { useCartStore, useCartTotalPrice } from '../store/cartStore';
import { ScreenHeader } from '../components/ScreenHeader';
import { GoldButton } from '../components/GoldButton';

const CHAD_PHONE_REGEX = /^[69]\d{7}$/;

type PaymentMethod = 'airtel_money' | 'moov_money' | 'cash_on_delivery';

const PAYMENT_OPTIONS: { value: PaymentMethod; label: string; icon: string; soon?: boolean }[] = [
  { value: 'airtel_money', label: 'Airtel Money', icon: '📱', soon: true },
  { value: 'moov_money', label: 'Moov Money', icon: '📲', soon: true },
  { value: 'cash_on_delivery', label: 'Paiement à la livraison', icon: '💵' },
];

export default function CheckoutScreen() {
  const items = useCartStore((s) => s.items);
  const clear = useCartStore((s) => s.clear);
  const total = useCartTotalPrice();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('cash_on_delivery');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = () => {
    if (!name.trim() || !phone.trim() || !address.trim()) {
      Alert.alert('Champs manquants', 'Merci de remplir toutes les informations de livraison.');
      return;
    }
    if (!CHAD_PHONE_REGEX.test(phone.trim())) {
      Alert.alert('Numéro invalide', 'Le numéro doit contenir 8 chiffres et commencer par 6 ou 9 (ex. 66123456).');
      return;
    }
    if (method !== 'cash_on_delivery') {
      Alert.alert(
        'Paiement bientôt disponible',
        'Airtel Money et Moov Money seront activés prochainement. Choisissez le paiement à la livraison pour continuer.'
      );
      return;
    }

    setSubmitting(true);
    // TODO : quand Supabase sera branché ici, remplacer ce bloc par un insert
    // dans la table `orders` (même format que sur le site).
    setTimeout(() => {
      setSubmitting(false);
      clear();
      Alert.alert(
        'Commande enregistrée ✓',
        'Notre équipe vous contactera très vite par téléphone pour confirmer la livraison.',
        [{ text: 'OK', onPress: () => router.replace('/') }]
      );
    }, 600);
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
          placeholder="Quartier / Ville (ex. Sabangali, N'Djamena)"
          placeholderTextColor={colors.creamFaint}
          style={styles.input}
        />

        <Text style={styles.sectionTitle}>Paiement</Text>
        {PAYMENT_OPTIONS.map((opt) => (
          <Pressable
            key={opt.value}
            style={[styles.paymentOption, method === opt.value && styles.paymentOptionActive]}
            onPress={() => setMethod(opt.value)}
          >
            <Text style={styles.paymentIcon}>{opt.icon}</Text>
            <Text style={styles.paymentLabel}>
              {opt.label}
              {opt.soon && <Text style={styles.paymentSoon}>  ·  bientôt disponible</Text>}
            </Text>
            <View style={[styles.radio, method === opt.value && styles.radioActive]} />
          </Pressable>
        ))}

        <View style={styles.summary}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Sous-total</Text>
            <Text style={styles.summaryValue}>{formatXAF(total)}</Text>
          </View>
          <View style={[styles.summaryRow, { marginTop: 8 }]}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{formatXAF(total)}</Text>
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
  paymentSoon: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 11.5 },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: colors.creamFaint },
  radioActive: { borderColor: colors.gold, backgroundColor: colors.gold },
  summary: { backgroundColor: colors.panel, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.lg },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  summaryLabel: { color: colors.creamMuted, fontFamily: fonts.body, fontSize: 13 },
  summaryValue: { color: colors.cream, fontFamily: fonts.bodyMedium, fontSize: 13 },
  totalLabel: { color: colors.cream, fontFamily: fonts.bodySemiBold, fontSize: 15 },
  totalValue: { color: colors.goldLight, fontFamily: fonts.displayBold, fontSize: 18 },
});
