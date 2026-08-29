import type { PaymentMethod } from '../../types';
import type { PaymentProvider, PaymentRequest, PaymentResult } from './types';
import { airtelMoneyProvider } from './airtelMoney';
import { moovMoneyProvider } from './moovMoney';
import { cashOnDeliveryProvider } from './cashOnDelivery';

export * from './types';

const providers: Partial<Record<PaymentMethod, PaymentProvider>> = {
  airtel_money: airtelMoneyProvider,
  moov_money: moovMoneyProvider,
  cash_on_delivery: cashOnDeliveryProvider,
  // stripe: stripeProvider, // a ajouter plus tard
};

export async function initiatePayment(request: PaymentRequest): Promise<PaymentResult> {
  const provider = providers[request.method];
  if (!provider) {
    return { success: false, reference: null, message: 'Méthode de paiement non prise en charge.' };
  }
  return provider.initiate(request);
}
