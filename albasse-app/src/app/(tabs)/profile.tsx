import React from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius, spacing } from '../../theme';

const SITE_URL = 'https://www.albasseshopping.com';

export default function ProfileScreen() {
  const comingSoon = () =>
    Alert.alert('Bientôt disponible', 'La connexion au compte sera activée dans une prochaine mise à jour.');

  return (
    <View style={styles.screen}>
      <Text style={styles.header}>Profil</Text>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.avatarCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarIcon}>👤</Text>
          </View>
          <Text style={styles.guestTitle}>Visiteur</Text>
          <Text style={styles.guestSubtitle}>Connectez-vous pour suivre vos commandes.</Text>
          <Pressable style={styles.loginButton} onPress={comingSoon}>
            <Text style={styles.loginButtonText}>Se connecter</Text>
          </Pressable>
        </View>

        <Row icon="📦" label="Mes commandes" onPress={comingSoon} />
        <Row icon="❤️" label="Mes favoris" onPress={comingSoon} />
        <Row icon="↩️" label="Conditions de retour" onPress={() => Linking.openURL(`${SITE_URL}/conditions-de-retour`)} />
        <Row
          icon="🔒"
          label="Politique de confidentialité"
          onPress={() => Linking.openURL(`${SITE_URL}/confidentialite`)}
        />
        <Row icon="💬" label="Contacter la boutique" onPress={() => Linking.openURL('https://wa.me/23560605151')} />
        <Row icon="🌐" label="Voir le site albasseshopping.com" onPress={() => Linking.openURL(SITE_URL)} />

        <Text style={styles.version}>Albasse Shopping · v1.0.0</Text>
      </ScrollView>
    </View>
  );
}

function Row({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <Text style={styles.rowIcon}>{icon}</Text>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowArrow}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    color: colors.cream,
    fontFamily: fonts.display,
    fontSize: 20,
    textAlign: 'center',
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  content: { paddingHorizontal: spacing.md, paddingBottom: 90 },
  avatarCard: {
    alignItems: 'center',
    backgroundColor: colors.panel,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.gold,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.panelAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  avatarIcon: { fontSize: 28 },
  guestTitle: { color: colors.goldLight, fontFamily: fonts.displayBold, fontSize: 17 },
  guestSubtitle: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 12, marginTop: 4, textAlign: 'center' },
  loginButton: {
    marginTop: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.gold,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
  },
  loginButtonText: { color: colors.gold, fontFamily: fonts.bodyBold, fontSize: 13 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    marginBottom: spacing.sm,
  },
  rowIcon: { fontSize: 17 },
  rowLabel: { flex: 1, color: colors.cream, fontFamily: fonts.bodyMedium, fontSize: 13.5 },
  rowArrow: { color: colors.creamFaint, fontSize: 18 },
  version: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 11, textAlign: 'center', marginTop: spacing.md },
});
