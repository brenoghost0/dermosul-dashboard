"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const stripe_1 = __importDefault(require("stripe"));
const stripe = new stripe_1.default(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2025-08-27.basil',
});
class StripeProvider {
    async processPayment(paymentRequest) {
        if (!paymentRequest.creditCard) {
            return {
                success: false,
                message: 'Credit card details are required for Stripe payments.',
            };
        }
        try {
            // No Stripe, o fluxo geralmente começa no frontend com a criação de um PaymentMethod.
            // Aqui, para manter a consistência do backend, vamos simular a criação de um cliente e um pagamento direto.
            // Isso não é o ideal para PCI compliance no mundo real sem tokenização do lado do cliente.
            const customer = await stripe.customers.create({
                email: paymentRequest.customer.email,
                name: paymentRequest.customer.name,
            });
            const paymentMethod = await stripe.paymentMethods.create({
                type: 'card',
                card: {
                    number: paymentRequest.creditCard.number,
                    exp_month: parseInt(paymentRequest.creditCard.expiryMonth, 10),
                    exp_year: parseInt(paymentRequest.creditCard.expiryYear, 10),
                    cvc: paymentRequest.creditCard.cvv,
                },
            });
            const paymentIntent = await stripe.paymentIntents.create({
                amount: paymentRequest.amount * 100, // Stripe usa centavos
                currency: 'brl',
                payment_method: paymentMethod.id,
                customer: customer.id,
                confirmation_method: 'manual',
                confirm: true,
            });
            if (paymentIntent.status === 'succeeded') {
                return {
                    success: true,
                    gatewayPaymentId: paymentIntent.id,
                    status: paymentIntent.status,
                };
            }
            else {
                return {
                    success: false,
                    gatewayPaymentId: paymentIntent.id,
                    status: paymentIntent.status,
                    message: 'Payment failed.',
                };
            }
        }
        catch (error) {
            return {
                success: false,
                message: error.message,
            };
        }
    }
    async createPixPayment(paymentRequest) {
        console.log('PIX payment is not supported by the Stripe provider in this implementation.', paymentRequest);
        throw new Error('PIX payment is not supported by Stripe.');
    }
}
exports.default = StripeProvider;
