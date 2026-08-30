import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NavigationContainer, DarkTheme, getStateFromPath } from '@react-navigation/native';
import { navigationRef } from './navigationRef';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { RootStackParamList } from './types';
import { colors } from '../theme';
import { SocialProofTicker } from '../components/SocialProofTicker';
import { WhatsAppFab } from '../components/WhatsAppFab';
import { trackPageView } from '../lib/analytics';
import { useAuthStore } from '../store/authStore';
import { TabNavigator } from './TabNavigator';
import { CategoryScreen } from '../screens/CategoryScreen';
import { ProductScreen } from '../screens/ProductScreen';
import { CheckoutScreen } from '../screens/CheckoutScreen';
import { OrdersScreen } from '../screens/OrdersScreen';
import { TravelScreen } from '../screens/TravelScreen';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { RegisterScreen } from '../screens/auth/RegisterScreen';
import { AdminProductsScreen } from '../screens/admin/AdminProductsScreen';
import { AdminProductFormScreen } from '../screens/admin/AdminProductFormScreen';
import { AdminOrdersScreen } from '../screens/admin/AdminOrdersScreen';
import { AdminTravelRequestsScreen } from '../screens/admin/AdminTravelRequestsScreen';
import { AdminCategoriesScreen } from '../screens/admin/AdminCategoriesScreen';
import { AdminPaymentSettingsScreen } from '../screens/admin/AdminPaymentSettingsScreen';
import { AdminCustomersScreen } from '../screens/admin/AdminCustomersScreen';
import { AdminCustomerDetailScreen } from '../screens/admin/AdminCustomerDetailScreen';
import { AdminDashboardScreen } from '../screens/admin/AdminDashboardScreen';
import { AdminSourcePerformanceScreen } from '../screens/admin/AdminSourcePerformanceScreen';
import { AdminAbandonedCartsScreen } from '../screens/admin/AdminAbandonedCartsScreen';
import { AdminNotificationsScreen } from '../screens/admin/AdminNotificationsScreen';
import { AdminPromotionsScreen } from '../screens/admin/AdminPromotionsScreen';
import { SmartPromotionPopup } from '../components/SmartPromotionPopup';
import { WheelPopup } from '../components/WheelPopup';
import { AdminStoreSettingsScreen } from '../screens/admin/AdminStoreSettingsScreen';
import { ContactScreen } from '../screens/ContactScreen';
import { CustomerNotificationsScreen } from '../screens/CustomerNotificationsScreen';
import { NotificationSettingsScreen } from '../screens/NotificationSettingsScreen';
import { FavoritesScreen } from '../screens/FavoritesScreen';
import { FavoritesSync } from '../components/FavoritesSync';
import { AdminCitiesScreen } from '../screens/admin/AdminCitiesScreen';
import { PrivacyPolicyScreen } from '../screens/PrivacyPolicyScreen';
import { MessagesScreen } from '../screens/MessagesScreen';
import { AdminMessagesScreen } from '../screens/admin/AdminMessagesScreen';
import { AffiliateApplyScreen } from '../screens/AffiliateApplyScreen';
import { AffiliateDashboardScreen } from '../screens/AffiliateDashboardScreen';
import { AffiliateProductsScreen } from '../screens/AffiliateProductsScreen';
import { OrderConfirmationScreen } from '../screens/OrderConfirmationScreen';
import { AdminBestLeadsScreen } from '../screens/admin/AdminBestLeadsScreen';
import { WheelScreen } from '../screens/WheelScreen';
import { AdminWheelScreen } from '../screens/admin/AdminWheelScreen';
import { AdminAffiliatesScreen } from '../screens/admin/AdminAffiliatesScreen';
import { AdminAffiliateSettingsScreen } from '../screens/admin/AdminAffiliateSettingsScreen';
import { AdminAffiliateCommissionsScreen } from '../screens/admin/AdminAffiliateCommissionsScreen';
import type { LinkingOptions } from '@react-navigation/native';

const Stack = createNativeStackNavigator<RootStackParamList>();

const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [],
  config: {
    screens: {
      Tabs: {
        screens: {
          Home: '',
          Search: 'recherche',
          Cart: 'panier',
          Account: 'compte',
        },
      },
      Category: 'categorie/:slug',
      Product: 'produit/:slug',
      Checkout: 'commande',
      Orders: 'mes-commandes',
      Travel: 'voyage',
      Login: 'connexion',
      Register: 'inscription',
      AdminDashboard: 'admin/tableau-de-bord',
      AdminSourcePerformance: 'admin/performance-par-source',
      AdminAbandonedCarts: 'admin/paniers-abandonnes',
      AdminNotifications: 'admin/notifications',
      AdminPromotions: 'admin/promotions',
      AdminProducts: 'admin/produits',
      AdminProductForm: 'admin/produits/edition',
      AdminOrders: 'admin/commandes',
      AdminTravelRequests: 'admin/voyage',
      AdminCategories: 'admin/categories',
      AdminPaymentSettings: 'admin/paiement',
      AdminCustomers: 'admin/clients',
      AdminCustomerDetail: 'admin/clients/:userId',
      AdminStoreSettings: 'admin/parametres/contact',
      Contact: 'contact',
      CustomerNotifications: 'notifications',
      NotificationSettings: 'compte/notifications',
      Favorites: 'mes-favoris',
      AdminCities: 'admin/livraison-villes',
      PrivacyPolicy: 'politique-de-confidentialite',
      Messages: 'mes-messages',
      AdminMessages: 'admin/messages',
      AffiliateApply: 'devenir-affilie',
      AffiliateDashboard: 'espace-affilie',
      AffiliateProducts: 'espace-affilie/produits',
      OrderConfirmation: 'commande/confirmation',
      AdminBestLeads: 'admin/meilleurs-clients',
      Wheel: 'roue-de-la-chance',
      AdminWheel: 'admin/roue-de-la-chance',
      AdminAffiliates: 'admin/affilies',
      AdminAffiliateSettings: 'admin/affilies/reglages',
      AdminAffiliateCommissions: 'admin/affilies/commissions',
    },
  },
};

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.background,
    card: colors.background,
    primary: colors.gold,
    text: colors.cream,
    border: colors.border,
  },
};

// Retient la page demandee au tout premier chargement (ex: lien produit partage)
// avant que le mur de connexion ne l'efface, pour y revenir apres connexion.
const initialPendingPath =
  Platform.OS === 'web' && typeof window !== 'undefined'
    ? window.location.pathname + window.location.search
    : null;
const IGNORED_REDIRECT_PATHS = ['/', '/connexion', '/inscription'];

export function RootNavigator() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const wasAuthenticated = useRef(isAuthenticated);

  useEffect(() => {
    if (
      !wasAuthenticated.current &&
      isAuthenticated &&
      initialPendingPath &&
      !IGNORED_REDIRECT_PATHS.includes(initialPendingPath) &&
      navigationRef.isReady()
    ) {
      const state = getStateFromPath(initialPendingPath, linking.config);
      if (state) navigationRef.reset(state);
    }
    wasAuthenticated.current = isAuthenticated;
  }, [isAuthenticated]);

  return (
    <NavigationContainer
      ref={navigationRef}
      theme={navTheme}
      documentTitle={{ enabled: false }}
      linking={linking}
      onStateChange={() => trackPageView()}
    >
      <View style={styles.root}>
        <SafeAreaView edges={['top']} style={styles.tickerSafeArea}>
          <SocialProofTicker />
        </SafeAreaView>
        <View style={styles.stackWrap}>
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Tabs" component={TabNavigator} />
            <Stack.Screen name="Category" component={CategoryScreen} />
            <Stack.Screen name="Product" component={ProductScreen} />
            <Stack.Screen name="Checkout" component={CheckoutScreen} />
            <Stack.Screen name="Orders" component={OrdersScreen} />
            <Stack.Screen name="Travel" component={TravelScreen} />
            <Stack.Screen name="Login" component={LoginScreen} options={{ presentation: 'modal' }} />
            <Stack.Screen name="Register" component={RegisterScreen} options={{ presentation: 'modal' }} />
            <Stack.Screen name="AdminProducts" component={AdminProductsScreen} />
            <Stack.Screen name="AdminProductForm" component={AdminProductFormScreen} />
            <Stack.Screen name="AdminOrders" component={AdminOrdersScreen} />
            <Stack.Screen name="AdminTravelRequests" component={AdminTravelRequestsScreen} />
            <Stack.Screen name="AdminCategories" component={AdminCategoriesScreen} />
            <Stack.Screen name="AdminPaymentSettings" component={AdminPaymentSettingsScreen} />
            <Stack.Screen name="AdminCustomers" component={AdminCustomersScreen} />
            <Stack.Screen name="AdminCustomerDetail" component={AdminCustomerDetailScreen} />
            <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} />
            <Stack.Screen name="AdminSourcePerformance" component={AdminSourcePerformanceScreen} />
            <Stack.Screen name="AdminAbandonedCarts" component={AdminAbandonedCartsScreen} />
            <Stack.Screen name="AdminNotifications" component={AdminNotificationsScreen} />
            <Stack.Screen name="AdminPromotions" component={AdminPromotionsScreen} />
            <Stack.Screen name="AdminStoreSettings" component={AdminStoreSettingsScreen} />
            <Stack.Screen name="Contact" component={ContactScreen} />
            <Stack.Screen name="CustomerNotifications" component={CustomerNotificationsScreen} />
            <Stack.Screen name="NotificationSettings" component={NotificationSettingsScreen} />
            <Stack.Screen name="Favorites" component={FavoritesScreen} />
            <Stack.Screen name="AdminCities" component={AdminCitiesScreen} />
            <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} options={{ presentation: 'modal' }} />
            <Stack.Screen name="Messages" component={MessagesScreen} />
            <Stack.Screen name="AdminMessages" component={AdminMessagesScreen} />
            <Stack.Screen name="AffiliateApply" component={AffiliateApplyScreen} options={{ presentation: 'modal' }} />
            <Stack.Screen name="AffiliateDashboard" component={AffiliateDashboardScreen} />
            <Stack.Screen name="AffiliateProducts" component={AffiliateProductsScreen} />
            <Stack.Screen name="OrderConfirmation" component={OrderConfirmationScreen} />
            <Stack.Screen name="AdminBestLeads" component={AdminBestLeadsScreen} />
            <Stack.Screen name="Wheel" component={WheelScreen} />
            <Stack.Screen name="AdminWheel" component={AdminWheelScreen} />
            <Stack.Screen name="AdminAffiliates" component={AdminAffiliatesScreen} />
            <Stack.Screen name="AdminAffiliateSettings" component={AdminAffiliateSettingsScreen} />
            <Stack.Screen name="AdminAffiliateCommissions" component={AdminAffiliateCommissionsScreen} />
          </Stack.Navigator>
        </View>
        <FavoritesSync />
        <WhatsAppFab />
        <SmartPromotionPopup />
        <WheelPopup />
      </View>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  tickerSafeArea: { backgroundColor: colors.background },
  stackWrap: { flex: 1 },
});
