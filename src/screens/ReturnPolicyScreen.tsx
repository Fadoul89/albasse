import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useStoreSettings } from '../hooks/useStoreSettings';
import { colors, fonts, radius, spacing } from '../theme';
import { ScreenHeader } from '../components/ScreenHeader';

export function ReturnPolicyScreen() {
  const { settings } = useStoreSettings();

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Conditions de retour" showBack />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.shopName}>🏪 {settings.shop_name}</Text>
        <Text style={styles.tagline}>Votre satisfaction, article après article.</Text>

        <Section title="1. Article incorrect ou défectueux">
          <Text style={styles.p}>
            Si vous recevez un article incorrect ou défectueux, contactez notre service client dans les 72 heures
            suivant la réception, en joignant une photo ou une vidéo de l'article reçu.
          </Text>
          <Text style={styles.p}>
            Après vérification et confirmation de l'erreur, nous vous communiquerons la procédure de retour.{' '}
            <Text style={styles.chargeNous}>Les frais de retour sont à notre charge.</Text>
          </Text>
          <Text style={styles.p}>
            Une fois le retour validé, vous serez remboursé conformément à nos conditions de retour.
          </Text>
        </Section>

        <Section title="2. Erreur de taille">
          <Text style={styles.p}>
            Si l'article correspond bien à votre commande mais que la taille choisie ne convient pas, nous procédons
            à un échange : vous nous retournez l'article et nous vous envoyons la bonne taille.{' '}
            <Text style={styles.chargeClient}>Les frais de retour sont à la charge du client.</Text>
          </Text>
          <Text style={styles.p}>
            L'article doit être non porté, non lavé, avec les étiquettes d'origine encore attachées. Tout article
            porté ou abîmé ne pourra pas être échangé.
          </Text>
        </Section>

        <View style={styles.avis}>
          <Text style={styles.avisIcon}>⚠️</Text>
          <Text style={styles.avisText}>
            Dans tous les cas, merci de <Text style={styles.avisStrong}>conserver l'article et son emballage
            d'origine</Text> jusqu'à la confirmation du retour.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: 60 },
  shopName: { color: colors.goldLight, fontFamily: fonts.display, fontSize: 20, textAlign: 'center', marginBottom: 4 },
  tagline: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 12, textAlign: 'center', marginBottom: spacing.lg },
  section: {
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  sectionTitle: { color: colors.gold, fontFamily: fonts.bodySemiBold, fontSize: 14, marginBottom: 8 },
  p: { color: colors.creamMuted, fontFamily: fonts.body, fontSize: 13, lineHeight: 19, marginBottom: 6 },
  chargeNous: { color: colors.gold, fontFamily: fonts.bodyBold },
  chargeClient: { color: colors.red, fontFamily: fonts.bodyBold },
  avis: {
    backgroundColor: colors.panelAlt,
    borderRadius: radius.md,
    borderLeftWidth: 4,
    borderLeftColor: colors.red,
    padding: spacing.md,
    marginTop: spacing.sm,
    flexDirection: 'row',
    gap: 10,
  },
  avisIcon: { fontSize: 16 },
  avisText: { flex: 1, color: colors.creamMuted, fontFamily: fonts.body, fontSize: 13, lineHeight: 19 },
  avisStrong: { color: colors.goldLight, fontFamily: fonts.bodySemiBold },
});
