import type { PaymentProvider, PaymentRequest, PaymentResult } from './types';

export const cashOnDeliveryProvider: PaymentProvider = {
  async initiate(_request: PaymentRequest): Promise<PaymentResult> {
    return {
      success: true,
      reference: null,
      message: 'Vous payerez en espèces directement à la livraison.',
    };
  },
};
