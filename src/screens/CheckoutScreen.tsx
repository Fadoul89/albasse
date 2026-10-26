import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, Pressable } from 'react-native';
import { Image } from 'expo-image';
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
import { createOrder } from '../lib/orders';
import { initiatePayment } from '../lib/payments';
import { paymentInitiatedText } from '../lib/payments/initiatedText';
import { CityPicker } from '../components/CityPicker';
import { GiftWrapOption } from '../components/GiftWrapOption';
import { ScheduledDeliveryPicker } from '../components/ScheduledDeliveryPicker';
import { formatSlot, slotProblem, slotToIso } from '../lib/scheduledDelivery';
import { trackTikTokEvent } from '../lib/tiktokPixel';
import type { PaymentMethod, City } from '../types';
import { isHomeCity } from '../lib/deliveryRules';
import { useStoreSettings } from '../hooks/useStoreSettings';
import { guestOrderAllowed } from '../lib/accountWall';
import { CHAD_PHONE_REGEX, generateTempPassword, guestFullName, guestInfoProblem, type NewAccountNotice } from '../lib/guestAccount';
import { fetchLoyaltyStatus, loyaltyDiscount, ordersBeforeDiscount, type LoyaltyStatus } from '../lib/loyaltyDiscount';
import { DELIVERY_HOURS, GIFT_WRAP_FEE, HOME_CITY, ORDER_VALIDITY_HOURS } from '../constants/shopRules';

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
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  // une commande = un article (choisi avec « Commander » sur la fiche ou dans Zara)
  const item = items[0] ?? null;
  const profile = useAuthStore((s) => s.profile);
  const signUp = useAuthStore((s) => s.signUp);
  // commander sans compte : seulement si « Compte obligatoire » est désactivé (sinon, comme avant : connexion ou création de compte d'abord)
  const { settings: storeSettings, isLoading: settingsLoading } = useStoreSettings();
  const guestAllowed = guestOrderAllowed(storeSettings.account_required);
  useEffect(() => {
    if (!profile && !settingsLoading && !guestAllowed) navigation.replace('Login');
  }, [profile, settingsLoading, guestAllowed]);

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
  // visiteur sans compte : prénom, nom et e-mail demandés ici ; son compte est créé quand il confirme
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const isGuest = !profile;
  // le compte créé à la confirmation (numéro + code) : gardé même si la commande doit être renvoyée, pour l'afficher sur la page de confirmation
  const newAccountRef = useRef<NewAccountNotice | null>(null);
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [selectedCity, setSelectedCity] = useState<City | null>(null);
  const [method, setMethod] = useState<PaymentMethod>('airtel_money');
  const [submitting, setSubmitting] = useState(false);
  const showToast = useToastStore((s) => s.show);
  const { settings: paymentSettings } = usePaymentSettings();

  const [giftWrap, setGiftWrap] = useState(false);
  // remise fidélité : −10 % des articles à la 7ᵉ commande, une seule fois
  const [loyalty, setLoyalty] = useState<LoyaltyStatus | null>(null);
  useEffect(() => {
    if (profile?.id) fetchLoyaltyStatus(profile.id).then(setLoyalty);
  }, [profile?.id]);
  const discount = loyaltyDiscount(total, loyalty);
  const deliveryFee = selectedCity?.delivery_fee ?? null;
  const grandTotal = total - discount + (deliveryFee ?? 0) + (giftWrap ? GIFT_WRAP_FEE : 0);

  // Paiement a la livraison : seulement pour les clients de N'Djamena. Ailleurs : a l'avance (Airtel Money, Moov Money).
  const cashOnDeliveryAllowed = isHomeCity(city);
  useEffect(() => {
    if (!cashOnDeliveryAllowed && method === 'cash_on_delivery') setMethod('airtel_money');
  }, [cashOnDeliveryAllowed, method]);

  // Livraison programmée : à N'Djamena le client peut choisir un jour et une heure de rendez-vous. La livraison normale n'est pas affichée dans la liste :
  // sans jour ni heure choisis, la commande est prise comme une livraison normale. Dans les autres villes : rien ne change.
  const [slotDay, setSlotDay] = useState<string | null>(null);
  const [slotTime, setSlotTime] = useState<string | null>(null);
  const scheduledAllowed = isHomeCity(city);
  useEffect(() => {
    if (!scheduledAllowed) {
      setSlotDay(null);
      setSlotTime(null);
    }
  }, [scheduledAllowed]);

  const paymentInfo =
    method === 'airtel_money'
      ? { number: paymentSettings?.airtel_number, url: paymentSettings?.airtel_payment_url }
      : method === 'moov_money'
      ? { number: paymentSettings?.moov_number, url: paymentSettings?.moov_payment_url }
      : null;

  const handleSubmit = async () => {
    if (isGuest && !guestAllowed) {
      navigation.replace('Login');
      return;
    }
    const shippingName = isGuest ? guestFullName({ firstName, lastName }) : name;
    if (isGuest) {
      const problem = guestInfoProblem({ firstName, lastName, phone, email });
      if (problem) {
        showToast(problem, { title: 'Vos informations', type: 'error' });
        return;
      }
    }
    if (!shippingName || !phone || !address || !city) {
      showToast('Merci de remplir toutes les informations de livraison.', { title: 'Champs manquants', type: 'error' });
      return;
    }
    if (method === 'cash_on_delivery' && !cashOnDeliveryAllowed) {
      showToast(`Le paiement à la livraison est possible seulement à ${HOME_CITY}. Choisissez Airtel Money ou Moov Money.`, {
        title: 'Paiement',
        type: 'error',
      });
      return;
    }
    if (!CHAD_PHONE_REGEX.test(phone)) {
      showToast(
        'Le numéro doit contenir 8 chiffres et commencer par 6 ou 9 (ex. 66123456).',
        { title: 'Numéro invalide', type: 'error' }
      );
      return;
    }

    // rendez-vous de la livraison programmée : revérifié au moment de confirmer (l'heure a pu passer)
    // un jour sans heure (ou l'inverse) est refusé ; ni jour ni heure : livraison normale
    const wantsSlot = scheduledAllowed && (!!slotDay || !!slotTime);
    if (wantsSlot) {
      const problem = slotProblem(slotDay, slotTime, Date.now());
      if (problem) {
        showToast(problem, { title: 'Livraison programmée', type: 'error' });
        return;
      }
    }
    const scheduledFor = wantsSlot && slotDay && slotTime ? slotToIso(slotDay, slotTime) : null;

    setSubmitting(true);
    try {
      // visiteur sans compte : on crée son compte avec son numéro, puis la commande est enregistrée à son nom
      let buyer = profile;
      if (!buyer) {
        const password = generateTempPassword();
        const res = await signUp(password, { fullName: shippingName, phone, email: email.trim(), address, region: city, country: 'Tchad', acceptsNotifications: false });
        if (res.error || res.needsEmailConfirmation) {
          const exists = !!res.error && res.error.startsWith('Un compte existe déjà');
          showToast(
            exists
              ? 'Vous avez déjà un compte avec ce numéro. Connectez-vous avec votre numéro et votre mot de passe pour commander.'
              : res.error ?? 'Votre compte n’a pas pu être créé. Écrivez-nous sur WhatsApp, nous prenons votre commande.',
            { title: exists ? 'Compte existant' : 'Compte non créé', type: 'error' }
          );
          if (exists) navigation.navigate('Login');
          return;
        }
        buyer = useAuthStore.getState().profile;
        if (!buyer) {
          showToast('Votre compte n’a pas pu être ouvert. Merci de réessayer.', { title: 'Compte non créé', type: 'error' });
          return;
        }
        newAccountRef.current = { phone, password };
        setName(shippingName); // si la commande doit être renvoyée, le nom est déjà là (le compte est ouvert)
      }

      const { order, error } = await createOrder({
        userId: buyer.id,
        items,
        total: grandTotal,
        paymentMethod: method,
        shippingName,
        shippingPhone: phone,
        shippingAddress: address,
        shippingCity: city,
        giftWrap,
        loyaltyDiscount: discount,
        ...(scheduledFor ? { deliveryType: 'scheduled' as const, scheduledFor } : {}),
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
        instructions = paymentInitiatedText(methodLabel, payment.message);
      }

      clearCart();
      navigation.navigate('OrderConfirmation', {
        orderId: order.id,
        total: grandTotal,
        instructions,
        giftWrap,
        ...(scheduledFor ? { scheduledFor } : {}),
        ...(newAccountRef.current ? { newAccount: newAccountRef.current } : {}),
      });
    } catch (e) {
      console.error('Exception création commande:', e);
      showToast(e instanceof Error ? e.message : String(e), { title: 'Erreur inattendue', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  if (isGuest && (settingsLoading || !guestAllowed)) return null; // on attend de savoir si le compte est obligatoire (sinon : retour à la connexion)

  if (!item) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Commande" showBack />
        <View style={styles.emptyBox} testID="checkout-empty">
          <Text style={styles.emptyText}>Choisissez d’abord un article, puis touchez « Commander » sur sa fiche.</Text>
          <GoldButton label="Voir les articles" onPress={() => navigation.navigate('Tabs', { screen: 'Home' } as never)} style={{ marginTop: spacing.md }} />
        </View>
      </View>
    );
  }

  const variant = [item.size ? `Taille ${item.size}` : null, item.color].filter(Boolean).join(' · ');
  const maxQty = Math.max(1, item.product.stock);

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Commande" showBack />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>Votre article</Text>
        <View style={styles.itemCard} testID="checkout-item">
          {item.product.images[0] ? (
            <Image source={{ uri: item.product.images[0] }} style={styles.itemImage} contentFit="cover" />
          ) : (
            <View style={styles.itemImage} />
          )}
          <View style={styles.itemBody}>
            <Text style={styles.itemName} numberOfLines={2}>
              {item.product.name}
            </Text>
            {variant ? <Text style={styles.itemVariant}>{variant}</Text> : null}
            <Text style={styles.itemPrice}>{formatXAF(item.product.price)}</Text>
          </View>
          <View style={styles.qtyCol}>
            <Pressable
              testID="checkout-qty-plus"
              style={[styles.qtyBtn, item.quantity >= maxQty && styles.qtyBtnOff]}
              onPress={() => updateQuantity(item.id, Math.min(maxQty, item.quantity + 1))}
              disabled={item.quantity >= maxQty}
              accessibilityLabel="Ajouter un exemplaire"
            >
              <Text style={styles.qtyBtnText}>+</Text>
            </Pressable>
            <Text style={styles.qtyValue} testID="checkout-qty">
              {item.quantity}
            </Text>
            <Pressable
              testID="checkout-qty-minus"
              style={[styles.qtyBtn, item.quantity <= 1 && styles.qtyBtnOff]}
              onPress={() => updateQuantity(item.id, Math.max(1, item.quantity - 1))}
              disabled={item.quantity <= 1}
              accessibilityLabel="Retirer un exemplaire"
            >
              <Text style={styles.qtyBtnText}>−</Text>
            </Pressable>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Livraison</Text>
        {isGuest ? (
          <>
            <Text style={styles.guestNote} testID="checkout-guest-note">
              {'👋 Pas besoin de créer un compte avant : nous le créons pour vous quand vous confirmez la commande.'}
            </Text>
            <TextInput
              value={firstName}
              onChangeText={setFirstName}
              placeholder="Prénom *"
              placeholderTextColor={colors.creamFaint}
              autoComplete="given-name"
              style={styles.input}
              testID="checkout-first-name"
            />
            <TextInput
              value={lastName}
              onChangeText={setLastName}
              placeholder="Nom *"
              placeholderTextColor={colors.creamFaint}
              autoComplete="family-name"
              style={styles.input}
              testID="checkout-last-name"
            />
          </>
        ) : (
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Nom complet"
            placeholderTextColor={colors.creamFaint}
            style={styles.input}
          />
        )}
        <TextInput
          value={phone}
          onChangeText={(text) => setPhone(text.replace(/\D/g, '').slice(0, 8))}
          placeholder="Numéro de téléphone (ex. 66123456)"
          placeholderTextColor={colors.creamFaint}
          keyboardType="phone-pad"
          maxLength={8}
          style={styles.input}
          testID="checkout-phone"
        />
        {isGuest ? (
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="Adresse e-mail *"
            placeholderTextColor={colors.creamFaint}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            style={styles.input}
            testID="checkout-email"
          />
        ) : null}
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

        {scheduledAllowed ? (
          <>
            <Text style={styles.sectionTitle}>Livraison programmée</Text>
            <ScheduledDeliveryPicker
              day={slotDay}
              time={slotTime}
              onDay={(d) => {
                // toucher une 2e fois le jour choisi annule le rendez-vous
                setSlotDay(d === slotDay ? null : d);
                setSlotTime(null);
              }}
              onTime={setSlotTime}
            />
          </>
        ) : null}

        <Text style={styles.sectionTitle}>Paiement</Text>
        {PAYMENT_OPTIONS.map((opt) => {
          const disabled = opt.value === 'cash_on_delivery' && !cashOnDeliveryAllowed;
          return (
            <Pressable
              key={opt.value}
              style={[styles.paymentOption, method === opt.value && styles.paymentOptionActive, disabled && styles.paymentOptionDisabled]}
              onPress={() => {
                if (!disabled) setMethod(opt.value);
              }}
              disabled={disabled}
              accessibilityRole="radio"
              accessibilityState={{ selected: method === opt.value, disabled }}
              aria-checked={method === opt.value}
              aria-disabled={disabled}
            >
              <Text style={styles.paymentIcon}>{opt.icon}</Text>
              <View style={styles.paymentLabelWrap}>
                <Text style={styles.paymentLabel}>{opt.label}</Text>
                {disabled ? <Text style={styles.paymentHint}>{`Seulement à ${HOME_CITY}`}</Text> : null}
              </View>
              <View style={[styles.radio, method === opt.value && styles.radioActive]} />
            </Pressable>
          );
        })}
        <Text style={styles.paymentRule}>
          {`💵 Paiement à la livraison : seulement à ${HOME_CITY}. Dans les autres villes, le paiement se fait à l'avance (Airtel Money ou Moov Money).`}
        </Text>

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

        <Text style={styles.sectionTitle}>Option</Text>
        <GiftWrapOption checked={giftWrap} onToggle={() => setGiftWrap((v) => !v)} />

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
          {discount > 0 ? (
            <View style={styles.summaryRow} testID="checkout-loyalty-discount">
              <Text style={styles.discountLabel}>⭐ Remise fidélité (−10 %)</Text>
              <Text style={styles.discountValue}>−{formatXAF(discount)}</Text>
            </View>
          ) : null}
          {giftWrap ? (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>🎁 Emballage cadeau</Text>
              <Text style={styles.summaryValue}>{formatXAF(GIFT_WRAP_FEE)}</Text>
            </View>
          ) : null}
          <View style={[styles.summaryRow, { marginTop: 8 }]}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{formatXAF(grandTotal)}</Text>
          </View>
          {loyalty && !loyalty.used && discount === 0 ? (
            <Text style={styles.discountHint} testID="checkout-loyalty-hint">
              {`⭐ Encore ${ordersBeforeDiscount(loyalty.delivered)} commande(s) livrée(s) et vous aurez −10 % sur vos articles (une fois) !`}
            </Text>
          ) : null}
        </View>

        <Text style={styles.serviceNote}>
          {`🕗 Nos services de livraison sont ouverts de ${DELIVERY_HOURS}.\n⏳ Pour éviter les fausses commandes, chaque commande est valable ${ORDER_VALIDITY_HOURS} h.`}
        </Text>

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
  emptyBox: { padding: spacing.lg, alignItems: 'stretch' },
  guestNote: { color: colors.goldLight, fontFamily: fonts.bodyMedium, fontSize: 13, lineHeight: 19, marginBottom: spacing.sm },
  emptyText: { color: colors.creamMuted, fontFamily: fonts.body, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
  },
  itemImage: { width: 72, height: 72, borderRadius: radius.sm, backgroundColor: colors.panelAlt },
  itemBody: { flex: 1 },
  itemName: { color: colors.cream, fontFamily: fonts.bodySemiBold, fontSize: 14 },
  itemVariant: { color: colors.creamMuted, fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
  itemPrice: { color: colors.goldLight, fontFamily: fonts.bodyBold, fontSize: 14, marginTop: 4 },
  qtyCol: { alignItems: 'center', gap: 4 },
  qtyBtn: {
    width: 30,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBtnOff: { opacity: 0.3 },
  qtyBtnText: { color: colors.gold, fontFamily: fonts.bodyBold, fontSize: 16 },
  qtyValue: { color: colors.cream, fontFamily: fonts.bodyBold, fontSize: 15 },
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
  paymentOptionDisabled: { opacity: 0.5 },
  paymentLabelWrap: { flex: 1 },
  paymentHint: { color: colors.creamMuted, fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
  paymentRule: { color: colors.creamMuted, fontFamily: fonts.body, fontSize: 12.5, lineHeight: 18, marginBottom: spacing.sm },
  serviceNote: { color: colors.creamMuted, fontFamily: fonts.body, fontSize: 12.5, lineHeight: 19, marginTop: spacing.md },
  paymentIcon: { fontSize: 20, marginRight: 10 },
  paymentLabel: { color: colors.cream, fontFamily: fonts.bodyMedium, fontSize: 14 },
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
  discountLabel: { color: colors.success, fontFamily: fonts.bodySemiBold, fontSize: 13 },
  discountValue: { color: colors.success, fontFamily: fonts.bodyBold, fontSize: 13 },
  discountHint: { color: colors.goldLight, fontFamily: fonts.bodyMedium, fontSize: 12, marginTop: 8 },
  totalValue: { color: colors.goldLight, fontFamily: fonts.displayBold, fontSize: 18 },
});
