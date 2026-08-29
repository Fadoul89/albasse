import type { PaymentProvider, PaymentRequest, PaymentResult } from './types';

const MERCHANT_ID = process.env.EXPO_PUBLIC_AIRTEL_MONEY_MERCHANT_ID ?? '';
const API_KEY = process.env.EXPO_PUBLIC_AIRTEL_MONEY_API_KEY ?? '';

// TODO: brancher l'API officielle Airtel Money (Open API) une fois le compte
// marchand ouvert et les identifiants recus. Documentation :
// https://developers.airtel.africa/
export const airtelMoneyProvider: PaymentProvider = {
  async initiate(request: PaymentRequest): Promise<PaymentResult> {
    if (!MERCHANT_ID || !API_KEY) {
      return {
        success: false,
        reference: null,
        message:
          'Airtel Money non configuré. Ajoutez EXPO_PUBLIC_AIRTEL_MONEY_MERCHANT_ID et EXPO_PUBLIC_AIRTEL_MONEY_API_KEY dans .env.',
      };
    }

    // Appel API reel a implementer ici (push USSD vers request.phone).
    throw new Error('Integration Airtel Money non implementee — en attente des identifiants marchand.');
  },
};
