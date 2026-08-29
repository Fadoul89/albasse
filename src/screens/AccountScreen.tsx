import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts, radius, spacing } from '../theme';
import { useAuthStore } from '../store/authStore';
import { GoldButton } from '../components/GoldButton';
import { useCustomerMessages } from '../hooks/useCustomerMessages';

export function AccountScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const profile = useAuthStore((s) => s.profile);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const signOut = useAuthStore((s) => s.signOut);
  const { unreadCount } = useCustomerMessages();

  if (!isAuthenticated || !profile) {
    return (
      <View style={styles.screen}>
        <Text style={styles.headerTitle}>Mon Compte</Text>
        <View style={styles.guestWrap}>
          <Text style={styles.guestIcon}>👤</Text>
          <Text style={styles.guestText}>Connectez-vous pour accéder à votre compte</Text>
          <GoldButton label="Se connecter" onPress={() => navigation.navigate('Login')} style={{ marginTop: spacing.lg, width: 220 }} />
          <Pressable style={{ marginTop: spacing.lg }} onPress={() => navigation.navigate('Contact')}>
            <Text style={styles.contactLink}>📍 Nous contacter</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={styles.headerTitle}>Mon Compte</Text>
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(profile.full_name ?? profile.email)[0]?.toUpperCase()}</Text>
        </View>
        <Text style={styles.name}>{profile.full_name ?? 'Client Albasse'}</Text>
        <Text style={styles.email}>{profile.email}</Text>
      </View>

      {profile.is_admin && (
        <Pressable style={styles.menuItem} onPress={() => navigation.navigate('AdminDashboard')}>
          <Text style={styles.menuIcon}>📊</Text>
          <Text style={styles.menuLabel}>Espace Admin — Tableau de bord</Text>
        </Pressable>
      )}
      {profile.is_admin && (
        <Pressable style={styles.menuItem} onPress={() => navigation.navigate('AdminNotifications')}>
          <Text style={styles.menuIcon}>🔔</Text>
          <Text style={styles.menuLabel}>Espace Admin — Notifications</Text>
        </Pressable>
      )}
      {profile.is_admin && (
        <Pressable style={styles.menuItem} onPress={() => navigation.navigate('AdminProducts')}>
          <Text style={styles.menuIcon}>🛠️</Text>
          <Text style={styles.menuLabel}>Espace Admin — Produits</Text>
        </Pressable>
      )}
      {profile.is_admin && (
        <Pressable style={styles.menuItem} onPress={() => navigation.navigate('AdminCategories')}>
          <Text style={styles.menuIcon}>🏷️</Text>
          <Text style={styles.menuLabel}>Espace Admin — Catégories</Text>
        </Pressable>
      )}
      {profile.is_admin && (
        <Pressable style={styles.menuItem} onPress={() => navigation.navigate('AdminOrders')}>
          <Text style={styles.menuIcon}>📦</Text>
          <Text style={styles.menuLabel}>Espace Admin — Commandes</Text>
        </Pressable>
      )}
      {profile.is_admin && (
        <Pressable style={styles.menuItem} onPress={() => navigation.navigate('AdminTravelRequests')}>
          <Text style={styles.menuIcon}>✈️</Text>
          <Text style={styles.menuLabel}>Espace Admin — Voyage</Text>
        </Pressable>
      )}
      {profile.is_admin && (
        <Pressable style={styles.menuItem} onPress={() => navigation.navigate('AdminPaymentSettings')}>
          <Text style={styles.menuIcon}>💳</Text>
          <Text style={styles.menuLabel}>Espace Admin — Paiement</Text>
        </Pressable>
      )}
      {profile.is_admin && (
        <Pressable style={styles.menuItem} onPress={() => navigation.navigate('AdminCustomers')}>
          <Text style={styles.menuIcon}>👥</Text>
          <Text style={styles.menuLabel}>Espace Admin — Clients</Text>
        </Pressable>
      )}
      {profile.is_admin && (
        <Pressable style={styles.menuItem} onPress={() => navigation.navigate('AdminPromotions')}>
          <Text style={styles.menuIcon}>🎁</Text>
          <Text style={styles.menuLabel}>Espace Admin — Promotions intelligentes</Text>
        </Pressable>
      )}
      {profile.is_admin && (
        <Pressable style={styles.menuItem} onPress={() => navigation.navigate('AdminSourcePerformance')}>
          <Text style={styles.menuIcon}>📡</Text>
          <Text style={styles.menuLabel}>Espace Admin — Performance par source</Text>
        </Pressable>
      )}
      {profile.is_admin && (
        <Pressable style={styles.menuItem} onPress={() => navigation.navigate('AdminAbandonedCarts')}>
          <Text style={styles.menuIcon}>🛒</Text>
          <Text style={styles.menuLabel}>Espace Admin — Paniers abandonnés</Text>
        </Pressable>
      )}
      {profile.is_admin && (
        <Pressable style={styles.menuItem} onPress={() => navigation.navigate('AdminStoreSettings')}>
          <Text style={styles.menuIcon}>📍</Text>
          <Text style={styles.menuLabel}>Espace Admin — Informations de contact</Text>
        </Pressable>
      )}
      {profile.is_admin && (
        <Pressable style={styles.menuItem} onPress={() => navigation.navigate('AdminMessages')}>
          <Text style={styles.menuIcon}>✉️</Text>
          <Text style={styles.menuLabel}>Espace Admin — Message à tous les clients</Text>
        </Pressable>
      )}
      {profile.is_admin && (
        <Pressable style={styles.menuItem} onPress={() => navigation.navigate('AdminCities')}>
          <Text style={styles.menuIcon}>🚚</Text>
          <Text style={styles.menuLabel}>Espace Admin — Livraison (Villes)</Text>
        </Pressable>
      )}
      {profile.is_admin && (
        <Pressable style={styles.menuItem} onPress={() => navigation.navigate('AdminAffiliates')}>
          <Text style={styles.menuIcon}>🤝</Text>
          <Text style={styles.menuLabel}>Espace Admin — Affiliés</Text>
        </Pressable>
      )}
      {profile.is_admin && (
        <Pressable style={styles.menuItem} onPress={() => navigation.navigate('AdminBestLeads')}>
          <Text style={styles.menuIcon}>🎯</Text>
          <Text style={styles.menuLabel}>Espace Admin — Meilleurs clients potentiels</Text>
        </Pressable>
      )}
      {profile.is_admin && (
        <Pressable style={styles.menuItem} onPress={() => navigation.navigate('AdminWheel')}>
          <Text style={styles.menuIcon}>🎡</Text>
          <Text style={styles.menuLabel}>Espace Admin — Roue de la chance</Text>
        </Pressable>
      )}
      <Pressable style={styles.menuItem} onPress={() => navigation.navigate('Wheel')}>
        <Text style={styles.menuIcon}>🎡</Text>
        <Text style={styles.menuLabel}>Roue de la chance</Text>
      </Pressable>
      {profile.is_affiliate && profile.affiliate_status === 'approved' && (
        <Pressable style={styles.menuItem} onPress={() => navigation.navigate('AffiliateDashboard')}>
          <Text style={styles.menuIcon}>🤝</Text>
          <Text style={styles.menuLabel}>Mon espace affilié</Text>
        </Pressable>
      )}
      {!profile.is_affiliate && (
        <Pressable style={styles.menuItem} onPress={() => navigation.navigate('AffiliateApply')}>
          <Text style={styles.menuIcon}>🤝</Text>
          <Text style={styles.menuLabel}>Devenir affilié</Text>
        </Pressable>
      )}
      {profile.is_affiliate && profile.affiliate_status !== 'approved' && (
        <Pressable style={styles.menuItem} onPress={() => navigation.navigate('AffiliateApply')}>
          <Text style={styles.menuIcon}>🤝</Text>
          <Text style={styles.menuLabel}>
            {profile.affiliate_status === 'blocked' ? 'Compte affilié bloqué' : 'Candidature affilié en attente'}
          </Text>
        </Pressable>
      )}
      <Pressable style={styles.menuItem} onPress={() => navigation.navigate('Messages')}>
        <Text style={styles.menuIcon}>✉️</Text>
        <Text style={styles.menuLabel}>Messages{unreadCount > 0 ? ` (${unreadCount})` : ''}</Text>
      </Pressable>
      <Pressable style={styles.menuItem} onPress={() => navigation.navigate('Favorites')}>
        <Text style={styles.menuIcon}>❤️</Text>
        <Text style={styles.menuLabel}>Mes favoris</Text>
      </Pressable>
      <Pressable style={styles.menuItem} onPress={() => navigation.navigate('CustomerNotifications')}>
        <Text style={styles.menuIcon}>🔔</Text>
        <Text style={styles.menuLabel}>Notifications</Text>
      </Pressable>
      <Pressable style={styles.menuItem} onPress={() => navigation.navigate('NotificationSettings')}>
        <Text style={styles.menuIcon}>⚙️</Text>
        <Text style={styles.menuLabel}>Réglages des notifications</Text>
      </Pressable>
      <Pressable style={styles.menuItem} onPress={() => navigation.navigate('Contact')}>
        <Text style={styles.menuIcon}>📍</Text>
        <Text style={styles.menuLabel}>Contact</Text>
      </Pressable>
      <Pressable style={styles.menuItem} onPress={() => navigation.navigate('Orders')}>
        <Text style={styles.menuIcon}>📦</Text>
        <Text style={styles.menuLabel}>Mes commandes</Text>
      </Pressable>
      <Pressable style={styles.menuItem} onPress={() => navigation.navigate('Travel')}>
        <Text style={styles.menuIcon}>🧳</Text>
        <Text style={styles.menuLabel}>Demander un billet d'avion</Text>
      </Pressable>

      <Pressable style={styles.menuItem} onPress={signOut}>
        <Text style={styles.menuIcon}>🚪</Text>
        <Text style={[styles.menuLabel, { color: colors.red }]}>Se déconnecter</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, paddingTop: 50, paddingHorizontal: spacing.md },
  headerTitle: { fontFamily: fonts.display, fontSize: 22, color: colors.cream, textAlign: 'center', marginBottom: spacing.lg },
  guestWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 100 },
  guestIcon: { fontSize: 48, marginBottom: 12 },
  guestText: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 14, textAlign: 'center', paddingHorizontal: 40 },
  contactLink: { color: colors.gold, fontFamily: fonts.bodyMedium, fontSize: 13 },
  profileCard: {
    alignItems: 'center',
    backgroundColor: colors.panel,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.panelAlt,
    borderWidth: 1,
    borderColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  avatarText: { color: colors.goldLight, fontFamily: fonts.displayBold, fontSize: 24 },
  name: { color: colors.cream, fontFamily: fonts.bodySemiBold, fontSize: 16 },
  email: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  menuIcon: { fontSize: 18, marginRight: 12 },
  menuLabel: { color: colors.cream, fontFamily: fonts.bodyMedium, fontSize: 14 },
});
