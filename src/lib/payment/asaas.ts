import axios from 'axios';
import { PaymentProvider, PaymentRequest, PaymentResponse } from './types.js';

const apiClient = axios.create({
  baseURL: process.env.ASAAS_API_BASE,
  headers: {
    'Content-Type': 'application/json',
    'access_token': process.env.ASAAS_API_KEY,
  },
});

class AsaasProvider implements PaymentProvider {
  private async getOrCreateCustomer(customerData: PaymentRequest['customer']): Promise<string> {
    try {
      // 1. Tenta buscar o cliente pelo CPF
      const searchResponse = await apiClient.get(`/customers?cpfCnpj=${customerData.cpf}`);
      if (searchResponse.data.data.length > 0) {
        return searchResponse.data.data[0].id;
      }

      // 2. Se não encontrar, cria um novo cliente
      const createResponse = await apiClient.post('/customers', {
        name: customerData.name,
        email: customerData.email,
        mobilePhone: customerData.phone,
        cpfCnpj: customerData.cpf,
      });
      return createResponse.data.id;
    } catch (error: any) {
      console.error('Asaas - Error getting or creating customer:', error.response?.data);
      throw new Error('Failed to process customer in Asaas.');
    }
  }

  async processPayment(paymentRequest: PaymentRequest): Promise<PaymentResponse> {
    if (!paymentRequest.creditCard) {
      return { success: false, message: 'Credit card details are required.' };
    }

    try {
      const customerId = await this.getOrCreateCustomer(paymentRequest.customer);

      const paymentData: any = {
        customer: customerId,
        billingType: 'CREDIT_CARD',
        dueDate: new Date().toISOString().split('T')[0],
        value: paymentRequest.amount,
        description: `Pedido ${paymentRequest.externalReference}`,
        externalReference: paymentRequest.externalReference,
        creditCard: {
          holderName: paymentRequest.creditCard.holderName,
          number: paymentRequest.creditCard.number,
          expiryMonth: paymentRequest.creditCard.expiryMonth,
          expiryYear: paymentRequest.creditCard.expiryYear,
          ccv: paymentRequest.creditCard.cvv,
        },
        creditCardHolderInfo: {
          name: paymentRequest.customer.name,
          email: paymentRequest.customer.email,
          cpfCnpj: paymentRequest.customer.cpf,
          postalCode: '01153000', // CEP genérico, Asaas exige. Idealmente viria do formulário.
          addressNumber: '123', // Número genérico, Asaas exige. Idealmente viria do formulário.
          phone: paymentRequest.customer.phone,
        },
      };

      if (paymentRequest.installments && paymentRequest.installments > 1) {
        paymentData.installmentCount = paymentRequest.installments;
        paymentData.installmentValue = parseFloat((paymentRequest.amount / paymentRequest.installments).toFixed(2));
        // O valor total já está em 'value', o Asaas calcula o resto.
      }

      const response = await apiClient.post('/payments', paymentData);

      // Em sandbox, AWAITING_RISK_ANALYSIS é um status de sucesso para cartões de teste.
      if (['CONFIRMED', 'RECEIVED', 'AWAITING_RISK_ANALYSIS'].includes(response.data.status)) {
        return {
          success: true,
          gatewayPaymentId: response.data.id,
          status: response.data.status,
        };
      } else {
        return {
          success: false,
          gatewayPaymentId: response.data.id,
          status: response.data.status,
          message: 'Payment was not approved.',
        };
      }
    } catch (error: any) {
      console.error('Asaas - Error processing credit card payment:', error.response?.data);
      const errorMessage = error.response?.data?.errors?.[0]?.description || 'Failed to process payment.';
      return {
        success: false,
        message: errorMessage,
      };
    }
  }

  async createPixPayment(paymentRequest: PaymentRequest): Promise<PaymentResponse> {
    try {
      const customerId = await this.getOrCreateCustomer(paymentRequest.customer);

      const paymentData = {
        customer: customerId,
        billingType: 'PIX',
        dueDate: new Date().toISOString().split('T')[0],
        value: paymentRequest.amount,
        description: `Pedido PIX ${paymentRequest.externalReference}`,
        externalReference: paymentRequest.externalReference,
      };

      const paymentResponse = await apiClient.post('/payments', paymentData);
      const paymentId = paymentResponse.data.id;

      const qrCodeResponse = await apiClient.get(`/payments/${paymentId}/pixQrCode`);

      return {
        success: true,
        gatewayPaymentId: paymentId,
        status: 'PENDING',
        qrCode: qrCodeResponse.data.encodedImage,
        copyPaste: qrCodeResponse.data.payload,
      };
    } catch (error: any) {
      console.error('Asaas - Error creating PIX payment:', error.response?.data);
      const errorMessage = error.response?.data?.errors?.[0]?.description || 'Failed to create PIX payment.';
      return {
        success: false,
        message: errorMessage,
      };
    }
  }

  async getPaymentStatusByExternalReference(externalReference: string): Promise<{ success: boolean; status?: string; paid: boolean; paymentId?: string; }>{
    try {
      const resp = await apiClient.get('/payments', { params: { externalReference } });
      const payment = Array.isArray(resp.data?.data) && resp.data.data.length > 0 ? resp.data.data[0] : null;
      if (!payment) {
        return { success: true, paid: false };
      }
      const status: string = payment.status;
      const paidStatuses = ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'];
      const paid = paidStatuses.includes(status);
      return { success: true, status, paid, paymentId: payment.id };
    } catch (error: any) {
      console.error('Asaas - Error fetching payment by externalReference:', error.response?.data || error.message);
      return { success: false, paid: false };
    }
  }
}

export default AsaasProvider;
