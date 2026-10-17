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
