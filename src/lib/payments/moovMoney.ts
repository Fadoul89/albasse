import type { PaymentProvider, PaymentRequest, PaymentResult } from './types';

const MERCHANT_ID = process.env.EXPO_PUBLIC_MOOV_MONEY_MERCHANT_ID ?? '';
const API_KEY = process.env.EXPO_PUBLIC_MOOV_MONEY_API_KEY ?? '';

// TODO: brancher l'API officielle Moov Money (Flooz) une fois le compte
// marchand ouvert et les identifiants recus.
export const moovMoneyProvider: PaymentProvider = {
  async initiate(request: PaymentRequest): Promise<PaymentResult> {
    if (!MERCHANT_ID || !API_KEY) {
      return {
        success: false,
        reference: null,
        message:
          'Moov Money non configuré. Ajoutez EXPO_PUBLIC_MOOV_MONEY_MERCHANT_ID et EXPO_PUBLIC_MOOV_MONEY_API_KEY dans .env.',
      };
    }

    throw new Error('Integration Moov Money non implementee — en attente des identifiants marchand.');
  },
};
