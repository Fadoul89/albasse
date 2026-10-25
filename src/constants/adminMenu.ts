// Menu de l'administration, rangé par thème : affiché sur la page « Tableau de bord » (components/AdminMenuGroups).
import type { RootStackParamList } from '../navigation/types';

export type AdminRoute = Extract<
  keyof RootStackParamList,
  | 'AdminNotifications'
  | 'AdminProducts'
  | 'AdminCategories'
  | 'AdminOrders'
  | 'AdminTravelRequests'
  | 'AdminPaymentSettings'
  | 'AdminCustomers'
  | 'AdminPromotions'
  | 'AdminSourcePerformance'
  | 'AdminZaraStats'
  | 'AdminMarketing'
  | 'AdminBrowsing'
  | 'AdminCallbacks'
  | 'AdminStoreSettings'
  | 'AdminCities'
  | 'AdminAffiliates'
  | 'AdminBestLeads'
  | 'AdminWheel'
>;

export interface AdminMenuItem {
  icon: string;
  label: string;
  route: AdminRoute;
}
export interface AdminMenuGroup {
  key: 'reports' | 'customers' | 'marketing' | 'shop' | 'settings';
  icon: string;
  title: string;
  items: AdminMenuItem[];
}

export const ADMIN_MENU_GROUPS: AdminMenuGroup[] = [
  {
    key: 'reports',
    icon: '📈',
    title: 'Rapports',
    items: [
      { icon: '📡', label: 'Performance par source', route: 'AdminSourcePerformance' },
      { icon: '💬', label: 'Statistiques de Zara', route: 'AdminZaraStats' },
      { icon: '🔎', label: 'Suivi de navigation', route: 'AdminBrowsing' },
      { icon: '🔔', label: 'Notifications', route: 'AdminNotifications' },
    ],
  },
  {
    key: 'customers',
    icon: '👥',
    title: 'Clients',
    items: [
      { icon: '👥', label: 'Clients', route: 'AdminCustomers' },
      { icon: '🎯', label: 'Meilleurs clients potentiels', route: 'AdminBestLeads' },
      { icon: '📲', label: 'Rappels WhatsApp', route: 'AdminCallbacks' },
    ],
  },
  {
    key: 'marketing',
    icon: '📣',
    title: 'Marketing',
    items: [
      { icon: '✍️', label: 'Assistant marketing', route: 'AdminMarketing' },
      { icon: '🎁', label: 'Promotions intelligentes', route: 'AdminPromotions' },
      { icon: '🎡', label: 'Roue de la chance', route: 'AdminWheel' },
      { icon: '🤝', label: 'Affiliés', route: 'AdminAffiliates' },
    ],
  },
  {
    key: 'shop',
    icon: '🛍️',
    title: 'Boutique',
    items: [
      { icon: '📦', label: 'Commandes et factures', route: 'AdminOrders' },
      { icon: '🛠️', label: 'Produits', route: 'AdminProducts' },
      { icon: '🏷️', label: 'Catégories', route: 'AdminCategories' },
      { icon: '✈️', label: 'Voyage', route: 'AdminTravelRequests' },
    ],
  },
  {
    key: 'settings',
    icon: '⚙️',
    title: 'Paramètres',
    items: [
      { icon: '📍', label: 'Informations de contact', route: 'AdminStoreSettings' },
      { icon: '💳', label: 'Paiement', route: 'AdminPaymentSettings' },
      { icon: '🚚', label: 'Livraison (Villes)', route: 'AdminCities' },
    ],
  },
];
