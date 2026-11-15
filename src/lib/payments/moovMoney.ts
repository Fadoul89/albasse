import type { PaymentProvider, PaymentRequest, PaymentResult } from './types';

// SÉCURITÉ : la clé marchande Moov Money ne doit JAMAIS être dans le site (une variable EXPO_PUBLIC_… est copiée dans le site,
// donc lisible par tout le monde). Le jour où le compte marchand sera ouvert, l'appel à l'API passera par une fonction serveur
// Supabase qui garde la clé dans ses Secrets ; le site appellera seulement cette fonction.
// Aujourd'hui le paiement Moov Money se fait à la main (numéros affichés en bas de la page de commande).
export const moovMoneyProvider: PaymentProvider = {
  async initiate(_request: PaymentRequest): Promise<PaymentResult> {
    return {
      success: false,
      reference: null,
      message: 'Paiement Moov Money automatique pas encore disponible : envoyez le montant au numéro affiché en bas de la page de commande.',
    };
  },
};
