import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Platform } from 'react-native';
import { useStoreSettings } from '../hooks/useStoreSettings';
import { colors, fonts, radius, spacing } from '../theme';
import { ScreenHeader } from '../components/ScreenHeader';
import { setTrackingChoice, trackingState } from '../lib/browsingTracker';

export function PrivacyPolicyScreen() {
  const { settings } = useStoreSettings();

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Politique de confidentialité" showBack />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.shopName}>🏪 {settings.shop_name}</Text>
        <Text style={styles.updated}>Dernière mise à jour : Octobre 2026</Text>

        <Section title="1. Données que nous collectons">
          <Text style={styles.p}>
            Lors de la création d'un compte et de l'utilisation de la boutique, nous collectons : votre nom, numéro
            de téléphone, profession, adresse e-mail, ville et adresse de livraison. Lors d'une commande, nous
            collectons également les détails de livraison et de paiement nécessaires à son traitement.
          </Text>
          <Text style={styles.p}>
            Nous mesurons aussi votre navigation sur le site (pages consultées, produits vus, temps passé) à des
            fins statistiques internes, afin d'améliorer l'expérience d'achat.
          </Text>
          <Text style={styles.p}>
            Pour que notre assistante Zara puisse vous conseiller, nous retenons aussi les articles que vous regardez :
            le nombre de fois où vous ouvrez une fiche, le temps pendant lequel vous la consultez réellement (un onglet
            laissé ouvert ou un téléphone en veille ne compte pas), les couleurs, tailles et photos que vous touchez,
            les articles ajoutés ou retirés du panier, les catégories ouvertes et vos recherches. Ces informations sont
            liées à un identifiant anonyme de votre appareil (ou à votre compte si vous êtes connecté), jamais à votre
            nom, et servent seulement à vous proposer des articles disponibles qui peuvent vous plaire et à améliorer la
            boutique. Elles sont conservées 90 jours, puis effacées.
          </Text>
          <Text style={styles.p}>
            Vous pouvez refuser ce suivi à tout moment avec le bouton ci-dessous, ou en écrivant à Zara « ne me suis
            plus ». Votre choix est respecté immédiatement et ce qui était retenu est effacé. Si votre navigateur envoie
            le signal « Ne pas me suivre », nous le respectons aussi.
          </Text>
          <TrackingSetting />
        </Section>

        <Section title="2. Utilisation des données">
          <Text style={styles.p}>
            Vos données servent uniquement à : traiter vos commandes et livraisons, vous contacter au sujet de votre
            compte ou de vos achats, et — si vous y avez consenti — vous informer des nouveaux produits et
            promotions. Elles ne sont jamais vendues à des tiers.
          </Text>
        </Section>

        <Section title="3. Partage des données">
          <Text style={styles.p}>
            Vos informations de livraison sont partagées uniquement avec nos agences de transport partenaires,
            strictement pour l'acheminement de votre commande.
          </Text>
        </Section>

        <Section title="4. Notifications">
          <Text style={styles.p}>
            Vous pouvez à tout moment activer ou désactiver les notifications commerciales (nouveaux produits,
            promotions, ventes flash) dans Mon compte → Réglages des notifications.
          </Text>
        </Section>

        <Section title="5. Sécurité">
          <Text style={styles.p}>
            Vos données sont hébergées de façon sécurisée (base de données chiffrée, accès protégé par mot de
            passe). Seule l'administration d'ALBASSE SHOPPING y a accès.
          </Text>
        </Section>

        <Section title="6. Vos droits">
          <Text style={styles.p}>
            Vous pouvez demander la consultation, la correction ou la suppression de vos données à tout moment en
            nous contactant à l'adresse ci-dessous.
          </Text>
        </Section>

        <Section title="7. Contact">
          <Text style={styles.p}>{settings.email ?? 'contact@albasseshopping.com'}</Text>
        </Section>
      </ScrollView>
    </View>
  );
}

// Le réglage du suivi des articles regardés, sur cet appareil : discret, ici seulement (aucun message qui dérange ailleurs sur le site).
function TrackingSetting() {
  const [state, setState] = useState(() => (Platform.OS === 'web' ? trackingState() : null));
  const [justRefused, setJustRefused] = useState(false);
  if (!state) return null;
  const toggle = () => {
    const refuse = state.allowed;
    setTrackingChoice(refuse ? 'denied' : 'granted'); // refuser efface aussi ce qui était retenu sur l'appareil et dans la base
    setJustRefused(refuse);
    setState(trackingState());
  };
  return (
    <View style={styles.setting} testID="privacy-tracking">
      <Text style={styles.settingText} testID="privacy-tracking-state">
        {state.allowed ? 'Le suivi des articles regardés est actif sur cet appareil.' : 'Le suivi des articles regardés est désactivé sur cet appareil.'}
      </Text>
      <Pressable style={styles.settingButton} onPress={toggle} accessibilityRole="button" testID="privacy-tracking-toggle">
        <Text style={styles.settingButtonText}>{state.allowed ? 'Refuser le suivi' : 'Autoriser le suivi'}</Text>
      </Pressable>
      {justRefused && !state.allowed ? <Text style={styles.settingText}>C'est fait : ce qui était retenu sur cet appareil est effacé.</Text> : null}
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
  setting: { backgroundColor: colors.panel, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.sm, gap: 8, marginTop: spacing.xs },
  settingText: { color: colors.creamMuted, fontFamily: fonts.body, fontSize: 13, lineHeight: 19 },
  settingButton: { alignSelf: 'flex-start', paddingHorizontal: 16, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.gold },
  settingButtonText: { color: colors.gold, fontFamily: fonts.bodySemiBold, fontSize: 13 },
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: 60 },
  shopName: { color: colors.goldLight, fontFamily: fonts.display, fontSize: 20, textAlign: 'center', marginBottom: 4 },
  updated: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 11, textAlign: 'center', marginBottom: spacing.lg },
  section: {
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  sectionTitle: { color: colors.gold, fontFamily: fonts.bodySemiBold, fontSize: 14, marginBottom: 8 },
  p: { color: colors.creamMuted, fontFamily: fonts.body, fontSize: 13, lineHeight: 19, marginBottom: 6 },
});
