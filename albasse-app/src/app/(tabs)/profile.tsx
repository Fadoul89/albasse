import React from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { colors, fonts, radius, spacing } from '../../theme';
import { GoldButton } from '../../components/GoldButton';
import { STORE_SETTINGS } from '../../data/storeSettings';
import { useAuthStore } from '../../store/authStore';

const SITE_URL = 'https://www.albasseshopping.com';

export default function ProfileScreen() {
  const profile = useAuthStore((s) => s.profile);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const signOut = useAuthStore((s) => s.signOut);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={styles.headerTitle}>Mon Compte</Text>

      {isAuthenticated && profile ? (
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(profile.full_name ?? profile.email)[0]?.toUpperCase()}</Text>
          </View>
          <Text style={styles.name}>{profile.full_name ?? 'Client Albasse'}</Text>
          <Text style={styles.email}>{profile.email}</Text>
          {profile.is_admin && (
            <View style={styles.adminBadge}>
              <Text style={styles.adminBadgeText}>⚙️ Administrateur</Text>
            </View>
          )}
        </View>
      ) : (
        <View style={styles.guestWrap}>
          <Text style={styles.guestIcon}>👤</Text>
          <Text style={styles.guestText}>Connectez-vous pour accéder à votre compte</Text>
          <GoldButton
            label="Se connecter"
            onPress={() => router.push('/login')}
            style={{ marginTop: spacing.lg, width: 220 }}
          />
          <Pressable onPress={() => router.push('/register')} style={{ marginTop: spacing.md }}>
            <Text style={styles.link}>Pas encore de compte ? Créer un compte</Text>
          </Pressable>
        </View>
      )}

      {isAuthenticated && (
        <Pressable style={styles.menuItem} onPress={() => router.push('/orders')}>
          <Text style={styles.menuIcon}>📦</Text>
          <Text style={styles.menuLabel}>Mes commandes</Text>
        </Pressable>
      )}
      {profile?.is_admin && (
        <Pressable style={styles.adminMenuItem} onPress={() => router.push('/admin-orders')}>
          <Text style={styles.menuIcon}>⚙️</Text>
          <Text style={styles.adminMenuLabel}>Espace Admin — Commandes</Text>
          <Text style={styles.adminMenuArrow}>→</Text>
        </Pressable>
      )}
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

      {isAuthenticated && (
        <Pressable
          style={styles.menuItem}
          onPress={() => Alert.alert('Se déconnecter', 'Confirmer la déconnexion ?', [
            { text: 'Annuler', style: 'cancel' },
            { text: 'Se déconnecter', style: 'destructive', onPress: signOut },
          ])}
        >
          <Text style={styles.menuIcon}>🚪</Text>
          <Text style={[styles.menuLabel, { color: colors.red }]}>Se déconnecter</Text>
        </Pressable>
      )}

      <Text style={styles.version}>Albasse Shopping · v1.0.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  headerTitle: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: colors.cream,
    textAlign: 'center',
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  content: { paddingHorizontal: spacing.md },
  profileCard: {
    alignItems: 'center',
    backgroundColor: colors.panel,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.gold,
    padding: spacing.lg,
    marginHorizontal: spacing.md,
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
  avatarText: { color: colors.goldLight, fontFamily: fonts.displayBold, fontSize: 24 },
  name: { color: colors.cream, fontFamily: fonts.bodySemiBold, fontSize: 16 },
  email: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
  adminBadge: {
    marginTop: spacing.sm,
    backgroundColor: colors.panelAlt,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.gold,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  adminBadgeText: { color: colors.goldLight, fontFamily: fonts.bodySemiBold, fontSize: 11 },
  guestWrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 32, marginBottom: spacing.lg, paddingHorizontal: spacing.md },
  guestIcon: { fontSize: 48, marginBottom: 12 },
  guestText: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 14, textAlign: 'center', paddingHorizontal: 40 },
  link: { color: colors.gold, fontFamily: fonts.bodyMedium, fontSize: 13, textAlign: 'center' },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    marginHorizontal: spacing.md,
  },
  menuIcon: { fontSize: 18, marginRight: 12 },
  menuLabel: { flex: 1, color: colors.cream, fontFamily: fonts.bodyMedium, fontSize: 14 },
  adminMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gold,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    marginHorizontal: spacing.md,
  },
  adminMenuLabel: { flex: 1, color: colors.background, fontFamily: fonts.bodyBold, fontSize: 14 },
  adminMenuArrow: { color: colors.background, fontFamily: fonts.bodyBold, fontSize: 16 },
  version: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 11, textAlign: 'center', marginTop: spacing.md },
});
