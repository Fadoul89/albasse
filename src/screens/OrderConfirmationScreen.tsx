import React from 'react';
import { View, Text, StyleSheet, ScrollView, Linking } from 'react-native';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts, radius, spacing } from '../theme';
import { GoldButton } from '../components/GoldButton';
import { InvoiceDownloadButton } from '../components/InvoiceDownloadButton';
import { InstallAfterOrderCard } from '../components/InstallAfterOrderCard';
import { useAuthStore } from '../store/authStore';
import { DELIVERY_HOURS, GIFT_WRAP_FEE, ORDER_VALIDITY_HOURS } from '../constants/shopRules';
import { formatSlot } from '../lib/scheduledDelivery';
import { prettyChadPhone } from '../lib/guestAccount';
import { telegramLinkUrl } from '../lib/telegramLink';

const formatXAF = (n: number) => `${n.toLocaleString('fr-FR')} FCFA`;

interface Props {
  route: RouteProp<RootStackParamList, 'OrderConfirmation'>;
}

export function OrderConfirmationScreen({ route }: Props) {
  const { orderId, total, instructions, giftWrap, scheduledFor, newAccount } = route.params;
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const signedIn = useAuthStore((s) => !!s.profile?.id); // la facture PDF n'est donnée qu'au compte qui a passé la commande
  const telegramUserId = useAuthStore((s) => (s.profile && !s.profile.telegram_chat_id ? s.profile.id : null)); // Telegram pas encore lié : on l'invite

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.icon}>🎉</Text>
        <Text style={styles.title}>Merci d'avoir acheté avec ALBASSE SHOPPING !</Text>
        <Text style={styles.subtitle}>
          Votre commande #{orderId.slice(0, 8)} a bien été enregistrée.
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Total à régler</Text>
          <Text style={styles.cardValue}>{formatXAF(total)}</Text>
        </View>

        {giftWrap ? <Text style={styles.gift}>{`🎁 Emballage cadeau inclus (${formatXAF(GIFT_WRAP_FEE)})`}</Text> : null}
        {scheduledFor ? (
          <Text style={styles.gift} testID="confirm-scheduled">{`📅 Livraison programmée : ${formatSlot(scheduledFor)}`}</Text>
        ) : null}

        {instructions ? (
          <View style={styles.instructionsBox}>
            <Text style={styles.instructionsText}>{instructions}</Text>
          </View>
        ) : null}

        {newAccount ? (
          <View style={styles.accountBox} testID="confirm-new-account">
            <Text style={styles.accountTitle}>✅ Votre compte est créé</Text>
            <Text style={styles.accountText}>Pour retrouver vos commandes et votre facture, connectez-vous avec :</Text>
            <Text style={styles.accountLine}>
              {'Numéro : '}
              <Text style={styles.accountValue}>{prettyChadPhone(newAccount.phone)}</Text>
            </Text>
            <Text style={styles.accountLine}>
              {'Mot de passe : '}
              <Text style={styles.accountValue} testID="confirm-new-password" selectable>
                {newAccount.password}
              </Text>
            </Text>
            <Text style={styles.accountHint}>📸 Faites une capture d’écran pour le garder. Vous pourrez le changer dans « Compte » › « Changer mon mot de passe ». Perdu ? Écrivez-nous sur WhatsApp, nous vous en donnons un nouveau.</Text>
          </View>
        ) : null}

        {/* l'application d'abord : suivre sa commande en un toucher (téléphone sans l'application seulement) */}
        <InstallAfterOrderCard />

        {telegramUserId ? (
          <View style={styles.telegramBox} testID="confirm-telegram">
            <Text style={styles.telegramTitle}>✈️ Recevez nos nouveautés et nos offres sur Telegram</Text>
            <Text style={styles.telegramText}>
              Liez votre Telegram en un toucher : vous serez prévenu des nouveaux articles et des ventes flash. C’est gratuit, et vous arrêtez quand vous voulez en écrivant STOP.
            </Text>
            <GoldButton label="Lier mon Telegram" variant="outline" onPress={() => Linking.openURL(telegramLinkUrl(telegramUserId))} style={{ marginTop: spacing.sm, width: '100%' }} />
          </View>
        ) : null}

        <Text style={styles.note}>
          {`⏳ Pour éviter les fausses commandes, chaque commande est valable ${ORDER_VALIDITY_HOURS} h.\n🕗 Nos services de livraison sont ouverts de ${DELIVERY_HOURS}.`}
        </Text>

        {signedIn ? <InvoiceDownloadButton orderId={orderId} style={{ marginTop: spacing.xl, width: '100%' }} /> : null}
        <GoldButton
          label="Voir mes commandes"
          variant={signedIn ? 'outline' : 'gold'}
          onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Tabs', params: { screen: 'Orders' } as never }] })}
          style={{ marginTop: signedIn ? spacing.sm : spacing.xl, width: '100%' }}
        />
        <GoldButton
          label="Continuer mes achats"
          variant="outline"
          onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Tabs' }] })}
          style={{ marginTop: spacing.sm, width: '100%' }}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, paddingTop: spacing.xxl },
  icon: { fontSize: 56, marginBottom: spacing.md },
  title: {
    color: colors.goldLight,
    fontFamily: fonts.display,
    fontSize: 21,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtitle: {
    color: colors.creamFaint,
    fontFamily: fonts.body,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  card: {
    backgroundColor: colors.panel,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.gold,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
  },
  cardLabel: { color: colors.creamMuted, fontFamily: fonts.bodyMedium, fontSize: 12 },
  cardValue: { color: colors.goldLight, fontFamily: fonts.displayBold, fontSize: 26, marginTop: 4 },
  instructionsBox: {
    backgroundColor: colors.panelAlt,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.lg,
    width: '100%',
  },
  instructionsText: { color: colors.cream, fontFamily: fonts.body, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  accountBox: { backgroundColor: colors.panel, borderRadius: radius.md, borderWidth: 1, borderColor: colors.gold, padding: spacing.md, marginTop: spacing.lg, width: '100%', alignItems: 'center' },
  accountTitle: { color: colors.goldLight, fontFamily: fonts.bodyBold, fontSize: 15, marginBottom: 6 },
  accountText: { color: colors.cream, fontFamily: fonts.body, fontSize: 13, lineHeight: 19, textAlign: 'center', marginBottom: 8 },
  accountLine: { color: colors.cream, fontFamily: fonts.body, fontSize: 15, marginTop: 2 },
  accountValue: { color: colors.goldLight, fontFamily: fonts.displayBold, fontSize: 19, letterSpacing: 1 },
  accountHint: { color: colors.creamMuted, fontFamily: fonts.body, fontSize: 12.5, lineHeight: 18, textAlign: 'center', marginTop: 10 },
  telegramBox: { backgroundColor: colors.panel, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginTop: spacing.lg, width: '100%', alignItems: 'center' },
  telegramTitle: { color: colors.goldLight, fontFamily: fonts.bodyBold, fontSize: 14.5, textAlign: 'center', marginBottom: 6 },
  telegramText: { color: colors.cream, fontFamily: fonts.body, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  gift: { color: colors.goldLight, fontFamily: fonts.bodySemiBold, fontSize: 14, textAlign: 'center', marginBottom: spacing.md },
  note: { color: colors.creamMuted, fontFamily: fonts.body, fontSize: 12.5, lineHeight: 19, textAlign: 'center', marginTop: spacing.md },
});
