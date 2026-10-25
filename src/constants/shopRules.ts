// Regles de la boutique que les clients doivent connaitre (assistante Zara Kings, page de commande).
export const HOME_CITY = "N'Djamena";

// Paiement : a la livraison seulement a N'Djamena ; dans les autres villes, a l'avance par Mobile Money.
export const PAYMENT = {
  airtel: '60 60 51 51',
  moov: '99 22 10 17',
};

// Les services de livraison sont ouverts de 8h30 a 16h.
export const DELIVERY_HOURS = '8h30 à 16h';

// Une commande restee en attente apres ce delai est signalee comme fausse commande
// (voir auto_flag_stale_orders dans add-auto-flag-stale-orders.sql).
export const ORDER_VALIDITY_HOURS = 48;

// Agences de transport vers les villes de province quand la ville n'a pas d'agence precise.
export const DEFAULT_AGENCIES = 'STTL ou Sud Voyage';

// Emballage cadeau : service a 2 000 FCFA par commande (choisi a la commande, ou ajoute ensuite
// dans Mes commandes tant que la commande est en attente).
export const GIFT_WRAP_FEE = 2000;

// Livraison programmée (clients de N'Djamena) : le client choisit un jour et une heure de rendez-vous ; Zara prévient l'administrateur
// sur Telegram quelques minutes avant. Heures de N'Djamena (UTC+1 toute l'année). Les mêmes limites sont revérifiées par la base
// (add-scheduled-delivery.sql) : le téléphone du client ne peut pas les contourner.
export const SCHEDULED_DELIVERY = {
  firstSlot: '08:30', // premier rendez-vous de la journée (ouverture des services de livraison)
  lastSlot: '15:30', // dernier rendez-vous (les services ferment à 16h)
  stepMinutes: 30, // un créneau toutes les 30 minutes
  minLeadMinutes: 120, // rendez-vous au plus tôt 2 h après la commande, pour préparer le colis
  maxDaysAhead: 7, // rendez-vous au plus tard dans 7 jours
  reminderMinutes: 10, // Zara prévient l'administrateur 10 minutes avant
};

// Grosses commandes : à partir de ces seuils (ou si le client parle de gros, de cartons, de grandes quantités), Zara propose de passer
// par l'équipe sur WhatsApp, qui donne les prix de gros. Zara n'annonce JAMAIS de prix de gros elle-même.
export const BULK_MIN_QTY = 10; // pièces d'un même article
