"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const TEST_CARD_NUMBER = (process.env.TEST_CARD_NUMBER || "4111111111111111").replace(/\D/g, "");
const TEST_CARD_CVV = (process.env.TEST_CARD_CVV || "").replace(/\D/g, "");
const ASAAS_API_BASE = process.env.ASAAS_API_BASE || "https://sandbox.asaas.com/api/v3";
const ASAAS_API_KEY = process.env.ASAAS_API_KEY || "";
const CONFIG_ERROR_MESSAGE = "Gateway Asaas não está configurado. Defina ASAAS_API_KEY no .env (sandbox ou produção) e reinicie o servidor.";
const apiClient = axios_1.default.create({
    baseURL: ASAAS_API_BASE,
    headers: {
        "Content-Type": "application/json",
        ...(ASAAS_API_KEY ? { access_token: ASAAS_API_KEY } : {}),
    },
});
function ensureGatewayConfigured() {
    if (!ASAAS_API_KEY) {
        throw new Error(CONFIG_ERROR_MESSAGE);
    }
}
class AsaasProvider {
    async getOrCreateCustomer(customerData) {
        try {
            if (customerData.cpf === "00000000000") {
                return "test-customer";
            }
            ensureGatewayConfigured();
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
        }
        catch (error) {
            console.error("Asaas - Error getting or creating customer:", error.response?.data || error.message);
            throw new Error(error.message || "Failed to process customer in Asaas.");
        }
    }
    async processPayment(paymentRequest) {
        if (!paymentRequest.creditCard) {
            return { success: false, message: 'Credit card details are required.' };
        }
        const normalizedNumber = paymentRequest.creditCard.number.replace(/\D/g, "");
        const normalizedCvv = paymentRequest.creditCard.cvv?.replace?.(/\D/g, "") ?? paymentRequest.creditCard.cvv;
        const shouldSimulate = paymentRequest.customer.cpf === "00000000000" ||
            (Boolean(TEST_CARD_NUMBER) &&
                normalizedNumber === TEST_CARD_NUMBER &&
                (!TEST_CARD_CVV || normalizedCvv === TEST_CARD_CVV));
        if (shouldSimulate) {
            console.log('[AsaasProvider] Simulating approved payment for test card.', {
                normalizedNumber,
                testCard: TEST_CARD_NUMBER,
                cpf: paymentRequest.customer.cpf,
            });
            return {
                success: true,
                gatewayPaymentId: `test-${paymentRequest.externalReference}-${Date.now()}`,
                status: 'TEST_APPROVED',
            };
        }
        try {
            ensureGatewayConfigured();
            const customerId = await this.getOrCreateCustomer(paymentRequest.customer);
            const paymentData = {
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
            }
            else {
                return {
                    success: false,
                    gatewayPaymentId: response.data.id,
                    status: response.data.status,
                    message: 'Payment was not approved.',
                };
            }
        }
        catch (error) {
            console.error("Asaas - Error processing credit card payment:", error.response?.data || error.message);
            const errorMessage = error.response?.data?.errors?.[0]?.description || error.message || "Failed to process payment.";
            return {
                success: false,
                message: errorMessage,
            };
        }
    }
    async createPixPayment(paymentRequest) {
        try {
            ensureGatewayConfigured();
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
        }
        catch (error) {
            console.error('Asaas - Error creating PIX payment:', error.response?.data || error.message);
            const errorMessage = error.response?.data?.errors?.[0]?.description || error.message || 'Failed to create PIX payment.';
            return {
                success: false,
                message: errorMessage,
            };
        }
    }
    async getPaymentStatusByExternalReference(externalReference) {
        try {
            ensureGatewayConfigured();
            const resp = await apiClient.get('/payments', { params: { externalReference } });
            const payment = Array.isArray(resp.data?.data) && resp.data.data.length > 0 ? resp.data.data[0] : null;
            if (!payment) {
                return { success: true, paid: false };
            }
            const status = payment.status;
            const paidStatuses = ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'];
            const paid = paidStatuses.includes(status);
            return { success: true, status, paid, paymentId: payment.id };
        }
        catch (error) {
            console.error('Asaas - Error fetching payment by externalReference:', error.response?.data || error.message);
            return { success: false, paid: false };
        }
    }
    async getPaymentStatusById(paymentId) {
        try {
            ensureGatewayConfigured();
            const resp = await apiClient.get(`/payments/${paymentId}`);
            const payment = resp.data;
            if (!payment)
                return { success: true, paid: false };
            const status = payment.status;
            const paidStatuses = ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'];
            const paid = paidStatuses.includes(status);
            return { success: true, status, paid, paymentId };
        }
        catch (error) {
            console.error('Asaas - Error fetching payment by id:', error.response?.data || error.message);
            return { success: false, paid: false };
        }
    }
}
exports.default = AsaasProvider;
