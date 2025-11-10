export interface PaymentRequest {
  amount: number;
  customer: {
    name: string;
    email: string;
    cpf: string;
    phone: string;
  };
  creditCard?: {
    holderName: string;
    number: string;
    expiryMonth: string;
    expiryYear: string;
    cvv: string;
  };
  externalReference: string;
  installments?: number;
}

export interface PaymentResponse {
  success: boolean;
  gatewayPaymentId?: string;
  status?: string;
  message?: string;
  qrCode?: string;
  copyPaste?: string;
}

export interface RefundOptions {
  valueCents?: number;
  description?: string;
}

export interface RefundResponse {
  success: boolean;
  status?: string;
  message?: string;
}

export interface PaymentProvider {
  processPayment(paymentRequest: PaymentRequest): Promise<PaymentResponse>;
  createPixPayment(paymentRequest: PaymentRequest): Promise<PaymentResponse>;
  refundPayment(paymentId: string, options?: RefundOptions): Promise<RefundResponse>;
}
