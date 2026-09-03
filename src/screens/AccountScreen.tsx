import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts, radius, spacing } from '../theme';
import { useAuthStore } from '../store/authStore';
import { GoldButton } from '../components/GoldButton';
import { useCustomerMessages } from '../hooks/useCustomerMessages';
import { useToastStore } from '../store/toastStore';
import { supabase } from '../lib/supabase';
import { uploadAvatar } from '../lib/imageUpload';
import { getLoyaltyStatus, LOYALTY_TIERS } from '../lib/loyalty';

type AdminRoute = Extract<
  keyof RootStackParamList,
  | 'AdminDashboard'
  | 'AdminNotifications'
  | 'AdminProducts'
  | 'AdminCategories'
  | 'AdminOrders'
  | 'AdminTravelRequests'
  | 'AdminPaymentSettings'
  | 'AdminCustomers'
  | 'AdminPromotions'
  | 'AdminSourcePerformance'
  | 'AdminAbandonedCarts'
  | 'AdminStoreSettings'
  | 'AdminMessages'
  | 'AdminCities'
  | 'AdminAffiliates'
  | 'AdminBestLeads'
  | 'AdminWheel'
>;

const ADMIN_MENU_ITEMS: { icon: string; label: string; route: AdminRoute }[] = [
  { icon: '📊', label: 'Tableau de bord', route: 'AdminDashboard' },
  { icon: '🔔', label: 'Notifications', route: 'AdminNotifications' },
  { icon: '🛠️', label: 'Produits', route: 'AdminProducts' },
  { icon: '🏷️', label: 'Catégories', route: 'AdminCategories' },
  { icon: '📦', label: 'Commandes', route: 'AdminOrders' },
  { icon: '✈️', label: 'Voyage', route: 'AdminTravelRequests' },
  { icon: '💳', label: 'Paiement', route: 'AdminPaymentSettings' },
  { icon: '👥', label: 'Clients', route: 'AdminCustomers' },
  { icon: '🎁', label: 'Promotions intelligentes', route: 'AdminPromotions' },
  { icon: '📡', label: 'Performance par source', route: 'AdminSourcePerformance' },
  { icon: '🛒', label: 'Paniers abandonnés', route: 'AdminAbandonedCarts' },
  { icon: '📍', label: 'Informations de contact', route: 'AdminStoreSettings' },
  { icon: '✉️', label: 'Message à tous les clients', route: 'AdminMessages' },
  { icon: '🚚', label: 'Livraison (Villes)', route: 'AdminCities' },
  { icon: '🤝', label: 'Affiliés', route: 'AdminAffiliates' },
  { icon: '🎯', label: 'Meilleurs clients potentiels', route: 'AdminBestLeads' },
  { icon: '🎡', label: 'Roue de la chance', route: 'AdminWheel' },
];

export function AccountScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const profile = useAuthStore((s) => s.profile);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const signOut = useAuthStore((s) => s.signOut);
  const refreshProfile = useAuthStore((s) => s.refreshProfile);
  const { unreadCount } = useCustomerMessages();
  const showToast = useToastStore((s) => s.show);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [adminExpanded, setAdminExpanded] = useState(false);

  const handlePickAvatar = async () => {
    if (!profile) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showToast("Autorisez l'accès aux photos pour changer votre photo de profil.", {
        title: 'Permission requise',
        type: 'error',
      });
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;

    setUploadingAvatar(true);
    const { url, error } = await uploadAvatar(result.assets[0].uri, profile.id);
    if (error || !url) {
      setUploadingAvatar(false);
      showToast(error ?? 'Échec du téléversement.', { title: 'Erreur', type: 'error' });
      return;
    }

    const { error: updateError } = await supabase.from('profiles').update({ avatar_url: url }).eq('id', profile.id);
    setUploadingAvatar(false);
    if (updateError) {
      showToast(updateError.message, { title: 'Erreur', type: 'error' });
      return;
    }
    await refreshProfile();
    showToast('Votre photo de profil a été mise à jour.', { title: 'Photo mise à jour ✓', type: 'success' });
  };

  if (!isAuthenticated || !profile) {
    return (
      <View style={styles.screen}>
        <Text style={styles.headerTitle}>Mon Compte</Text>
        <View style={styles.guestWrap}>
          <Text style={styles.guestIcon}>👤</Text>
          <Text style={styles.guestText}>Connectez-vous pour accéder à votre compte</Text>
          <GoldButton label="Se connecter" onPress={() => navigation.navigate('Login')} style={{ marginTop: spacing.lg, width: 220 }} />
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={styles.headerTitle}>Mon Compte</Text>
      <View style={styles.profileCard}>
        <Pressable style={styles.avatar} onPress={handlePickAvatar} disabled={uploadingAvatar}>
          {profile.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} contentFit="cover" />
          ) : (
            <Text style={styles.avatarText}>{(profile.full_name ?? profile.email)[0]?.toUpperCase()}</Text>
          )}
          <View style={styles.avatarEditBadge}>
            {uploadingAvatar ? (
              <ActivityIndicator size="small" color={colors.background} />
            ) : (
              <Text style={styles.avatarEditIcon}>📷</Text>
            )}
          </View>
        </Pressable>
        <Text style={styles.name}>{profile.full_name ?? 'Client Albasse'}</Text>
        <Text style={styles.email}>{profile.email}</Text>

        <LoyaltyCard points={profile.loyalty_points ?? 0} />
      </View>

      {profile.is_admin && (
        <View style={styles.adminGroup}>
          <Pressable style={styles.menuItem} onPress={() => setAdminExpanded((v) => !v)}>
            <Text style={styles.menuIcon}>⚙️</Text>
            <Text style={styles.menuLabel}>Espace Admin</Text>
            <Text style={styles.menuChevron}>{adminExpanded ? '▲' : '▼'}</Text>
          </Pressable>
          {adminExpanded &&
            ADMIN_MENU_ITEMS.map((item) => (
              <Pressable
                key={item.route}
                style={styles.subMenuItem}
                onPress={() => navigation.navigate(item.route)}
              >
                <Text style={styles.menuIcon}>{item.icon}</Text>
                <Text style={styles.menuLabel}>{item.label}</Text>
              </Pressable>
            ))}
        </View>
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
      <Pressable style={styles.menuItem} onPress={() => navigation.navigate('Orders')}>
        <Text style={styles.menuIcon}>📦</Text>
        <Text style={styles.menuLabel}>Mes commandes</Text>
      </Pressable>
      <Pressable style={styles.menuItem} onPress={() => navigation.navigate('ReturnPolicy')}>
        <Text style={styles.menuIcon}>↩️</Text>
        <Text style={styles.menuLabel}>Conditions de retour</Text>
      </Pressable>
      <Pressable style={styles.travelMenuItem} onPress={() => navigation.navigate('Travel')}>
        <Text style={styles.menuIcon}>✈️</Text>
        <Text style={styles.travelMenuLabel}>Demander un billet d'avion</Text>
        <Text style={styles.travelMenuArrow}>→</Text>
      </Pressable>

      <Pressable style={styles.menuItem} onPress={signOut}>
        <Text style={styles.menuIcon}>🚪</Text>
        <Text style={[styles.menuLabel, { color: colors.red }]}>Se déconnecter</Text>
      </Pressable>
    </ScrollView>
  );
}

function LoyaltyCard({ points }: { points: number }) {
  const status = getLoyaltyStatus(points);
  return (
    <View style={styles.loyaltyCard}>
      <View style={styles.loyaltyHeader}>
        <Text style={styles.loyaltyTierText}>
          {status.current.icon} Client {status.current.label}
        </Text>
        <Text style={styles.loyaltyPoints}>{points} pts</Text>
      </View>
      <View style={styles.loyaltyBarTrack}>
        <View style={[styles.loyaltyBarFill, { width: `${Math.round(status.progress * 100)}%` }]} />
      </View>
      <Text style={styles.loyaltyHint}>
        {status.next
          ? `${status.pointsToNext} pts avant le palier ${status.next.icon} ${status.next.label}`
          : 'Palier maximum atteint 🎉'}
      </Text>
      <View style={styles.loyaltyStepsRow}>
        {LOYALTY_TIERS.map((tier) => (
          <View key={tier.key} style={styles.loyaltyStep}>
            <Text style={[styles.loyaltyStepIcon, points < tier.min && styles.loyaltyStepIconLocked]}>
              {tier.icon}
            </Text>
            <Text style={styles.loyaltyStepLabel}>{tier.label}</Text>
          </View>
        ))}
      </View>
    </View>
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
    backgroundColor: '#241a3d',
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: '#8b5cf6',
    padding: spacing.lg,
    marginBottom: spacing.lg,
    shadowColor: '#8b5cf6',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.panelAlt,
    borderWidth: 2,
    borderColor: '#8b5cf6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
    overflow: 'visible',
  },
  avatarImage: { width: 64, height: 64, borderRadius: 32 },
  avatarText: { color: colors.goldLight, fontFamily: fonts.displayBold, fontSize: 24 },
  avatarEditBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.panel,
  },
  avatarEditIcon: { fontSize: 11 },
  name: { color: colors.cream, fontFamily: fonts.bodySemiBold, fontSize: 16 },
  email: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
  loyaltyCard: {
    width: '100%',
    backgroundColor: colors.panelAlt,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  loyaltyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  loyaltyTierText: { color: colors.goldLight, fontFamily: fonts.bodyBold, fontSize: 14 },
  loyaltyPoints: { color: colors.cream, fontFamily: fonts.bodySemiBold, fontSize: 13 },
  loyaltyBarTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.background,
    overflow: 'hidden',
    marginBottom: 6,
  },
  loyaltyBarFill: { height: '100%', backgroundColor: colors.gold, borderRadius: 4 },
  loyaltyHint: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 11, marginBottom: 10 },
  loyaltyStepsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  loyaltyStep: { alignItems: 'center', flex: 1 },
  loyaltyStepIcon: { fontSize: 18, opacity: 1 },
  loyaltyStepIconLocked: { opacity: 0.25 },
  loyaltyStepLabel: { color: colors.creamFaint, fontFamily: fonts.body, fontSize: 9, marginTop: 2 },
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
  menuChevron: { color: colors.creamFaint, fontSize: 11 },
  adminGroup: { marginBottom: spacing.sm },
  subMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.panelAlt,
    borderRadius: radius.md,
    padding: spacing.md,
    marginLeft: spacing.lg,
    marginTop: spacing.xs,
  },
  travelMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gold,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  travelMenuLabel: { flex: 1, color: colors.background, fontFamily: fonts.bodyBold, fontSize: 14 },
  travelMenuArrow: { color: colors.background, fontFamily: fonts.bodyBold, fontSize: 16 },
});
