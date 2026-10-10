import React from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius, spacing } from '../../theme';
import { GoldButton } from '../../components/GoldButton';
import { STORE_SETTINGS } from '../../data/storeSettings';

const SITE_URL = 'https://www.albasseshopping.com';

export default function ProfileScreen() {
  const comingSoon = () =>
    Alert.alert('Bientôt disponible', 'La connexion au compte sera activée dans une prochaine mise à jour.');

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={styles.headerTitle}>Mon Compte</Text>

      <View style={styles.guestWrap}>
        <Text style={styles.guestIcon}>👤</Text>
        <Text style={styles.guestText}>Connectez-vous pour accéder à votre compte</Text>
        <GoldButton label="Se connecter" onPress={comingSoon} style={{ marginTop: spacing.lg, width: 220 }} />
      </View>

      <Pressable style={styles.menuItem} onPress={comingSoon}>
        <Text style={styles.menuIcon}>📦</Text>
        <Text style={styles.menuLabel}>Mes commandes</Text>
      </Pressable>
      <Pressable style={styles.menuItem} onPress={comingSoon}>
        <Text style={styles.menuIcon}>❤️</Text>
        <Text style={styles.menuLabel}>Mes favoris</Text>
      </Pressable>
      <Pressable style={styles.menuItem} onPress={() => Linking.openURL(`${SITE_URL}/conditions-de-retour`)}>
        <Text style={styles.menuIcon}>↩️</Text>
        <Text style={styles.menuLabel}>Conditions de retour</Text>
      </Pressable>
      <Pressable style={styles.menuItem} onPress={() => Linking.openURL(`${SITE_URL}/confidentialite`)}>
        <Text style={styles.menuIcon}>🔒</Text>
        <Text style={styles.menuLabel}>Politique de confidentialité</Text>
      </Pressable>
      <Pressable style={styles.menuItem} onPress={() => Linking.openURL(`https://wa.me/${STORE_SETTINGS.whatsapp.replace(/[^0-9]/g, '')}`)}>
        <Text style={styles.menuIcon}>💬</Text>
        <Text style={styles.menuLabel}>Contacter la boutique</Text>
      </Pressable>
      <Pressable style={styles.menuItem} onPress={() => Linking.openURL(SITE_URL)}>
        <Text style={styles.menuIcon}>🌐</Text>
        <Text style={styles.menuLabel}>Voir le site albasseshopping.com</Text>
      </Pressable>

      <Text style={styles.version}>Albasse Shopping · v1.0.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, paddingTop: 50, paddingHorizontal: spacing.md },
  headerTitle: { fontFamily: fonts.display, fontSize: 22, color: colors.cream, textAlign: 'center', marginBottom: spacing.lg },
  guestWrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 32, marginBottom: spacing.lg },
  guestIcon: { fontSize: 48, marginBottom: 12 },
  guestText: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 14, textAlign: 'center', paddingHorizontal: 40 },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  menuIcon: { fontSize: 18, marginRight: 12 },
  menuLabel: { flex: 1, color: colors.cream, fontFamily: fonts.bodyMedium, fontSize: 14 },
  version: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 11, textAlign: 'center', marginTop: spacing.md },
});
