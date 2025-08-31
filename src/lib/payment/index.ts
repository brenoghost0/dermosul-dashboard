import AsaasProvider from './asaas';
import { PaymentProvider } from './types';

let paymentProvider: PaymentProvider;

export function getPaymentProvider(): PaymentProvider {
  if (paymentProvider) {
    return paymentProvider;
  }

  console.log(`[PaymentProviderFactory] Initializing payment provider: asaas`);
  paymentProvider = new AsaasProvider();

  return paymentProvider;
}

// Re-export types for convenience
export * from './types';
