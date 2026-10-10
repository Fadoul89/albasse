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
        <Text style={styles.sectionTitle}>Informations de livraison</Text>
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
          placeholder="Numéro de téléphone (ex. 66123456)"
          placeholderTextColor={colors.creamFaint}
          keyboardType="phone-pad"
          style={styles.input}
        />
        <TextInput
          value={address}
          onChangeText={setAddress}
          placeholder="Quartier / Ville (ex. Sabangali, N'Djamena)"
          placeholderTextColor={colors.creamFaint}
          style={styles.input}
        />

        <Text style={styles.sectionTitle}>Mode de paiement</Text>
        <PaymentOption
          label="Paiement à la livraison"
          icon="💵"
          active={method === 'cash_on_delivery'}
          onPress={() => setMethod('cash_on_delivery')}
        />
        <PaymentOption
          label="Airtel Money"
          icon="📱"
          active={method === 'airtel_money'}
          onPress={() => setMethod('airtel_money')}
          badge="Bientôt disponible"
        />
        <PaymentOption
          label="Moov Money"
          icon="📱"
          active={method === 'moov_money'}
          onPress={() => setMethod('moov_money')}
          badge="Bientôt disponible"
        />

        <View style={styles.summary}>
          <Text style={styles.summaryLabel}>{items.length} article(s)</Text>
          <Text style={styles.summaryTotal}>{formatXAF(total)}</Text>
        </View>
      </ScrollView>
      <View style={styles.footer}>
        <GoldButton label="Confirmer la commande" onPress={handleSubmit} loading={submitting} />
      </View>
    </View>
  );
}

function PaymentOption({
  label,
  icon,
  active,
  onPress,
  badge,
}: {
  label: string;
  icon: string;
  active: boolean;
  onPress: () => void;
  badge?: string;
}) {
  return (
    <Pressable style={[styles.paymentOption, active && styles.paymentOptionActive]} onPress={onPress}>
      <Text style={styles.paymentIcon}>{icon}</Text>
      <Text style={styles.paymentLabel}>{label}</Text>
      {badge && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      )}
      <View style={[styles.radio, active && styles.radioActive]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: 40 },
  sectionTitle: { color: colors.cream, fontFamily: fonts.display, fontSize: 15, marginTop: spacing.sm, marginBottom: spacing.sm },
  input: {
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.cream,
    fontFamily: fonts.body,
    marginBottom: spacing.sm,
  },
  paymentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  paymentOptionActive: { borderColor: colors.gold },
  paymentIcon: { fontSize: 18 },
  paymentLabel: { flex: 1, color: colors.cream, fontFamily: fonts.bodyMedium, fontSize: 13 },
  badge: { backgroundColor: colors.panelAlt, borderRadius: radius.sm, paddingHorizontal: 6, paddingVertical: 3 },
  badgeText: { color: colors.creamFaint, fontFamily: fonts.bodySemiBold, fontSize: 9.5 },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: colors.border },
  radioActive: { borderColor: colors.gold, backgroundColor: colors.gold },
  summary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: spacing.md,
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  summaryLabel: { color: colors.creamMuted, fontFamily: fonts.body, fontSize: 13 },
  summaryTotal: { color: colors.goldLight, fontFamily: fonts.displayBold, fontSize: 18 },
  footer: { padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.panel },
});
