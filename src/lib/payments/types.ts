import type { PaymentMethod } from '../../types';

export interface PaymentRequest {
  method: PaymentMethod;
  amount: number;
  phone: string;
  orderId: string;
}

export interface PaymentResult {
  success: boolean;
  reference: string | null;
  message: string;
}

export interface PaymentProvider {
  initiate: (request: PaymentRequest) => Promise<PaymentResult>;
}
