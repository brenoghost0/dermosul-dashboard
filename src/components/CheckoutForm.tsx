import { useState } from 'react';
import { PaymentRequest } from '../lib/payment';
import { apiClient } from '../lib/api';

const CheckoutForm = () => {
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [succeeded, setSucceeded] = useState(false);
  const [pixData, setPixData] = useState<{ qrCode: string; copyPaste: string } | null>(null);

  // State for credit card details
  const [cardData, setCardData] = useState({
    holderName: '',
    number: '',
    expiryMonth: '',
    expiryYear: '',
    cvv: '',
  });

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setCardData({ ...cardData, [name]: value });
  };

  const handleCreditCardSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setProcessing(true);
    setError(null);

    // Mock customer and order data for demonstration
    const paymentRequest: PaymentRequest = {
      amount: 10.0, // Example: R$ 10,00
      externalReference: `DEMO-${Date.now()}`,
      customer: {
        name: 'Breno Ghost',
        email: 'breno.ghost@example.com',
        cpf: '97097236034',
        phone: '11999999999',
      },
      creditCard: {
        holderName: cardData.holderName,
        number: cardData.number.replace(/\s/g, ''),
        expiryMonth: cardData.expiryMonth,
        expiryYear: cardData.expiryYear,
        cvv: cardData.cvv,
      },
    };

    try {
      const result = await apiClient.post('/payments/credit-card', paymentRequest);

      if (result.data.success) {
        setSucceeded(true);
      } else {
        setError(result.data.message || 'Ocorreu um erro no pagamento.');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Ocorreu um erro desconhecido.');
    } finally {
      setProcessing(false);
    }
  };

  const handlePixSubmit = async () => {
    setProcessing(true);
    setError(null);
    setPixData(null);

    const paymentRequest: Omit<PaymentRequest, 'creditCard'> = {
      amount: 10.0, // Example: R$ 10,00
      externalReference: `DEMO-PIX-${Date.now()}`,
      customer: {
        name: 'Breno Ghost',
        email: 'breno.ghost@example.com',
        cpf: '97097236034',
        phone: '11999999999',
      },
    };

    try {
      const result = await apiClient.post('/payments/pix', paymentRequest);
      if (result.data.success) {
        setPixData({ qrCode: result.data.qrCode, copyPaste: result.data.copyPaste });
        setSucceeded(true); // Considera sucesso para exibir o modal
      } else {
        setError(result.data.message || 'Ocorreu um erro ao gerar o PIX.');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Ocorreu um erro desconhecido.');
    } finally {
      setProcessing(false);
    }
  };


  if (succeeded && pixData) {
    return (
      <div style={{ maxWidth: '400px', margin: 'auto', textAlign: 'center' }}>
        <h2>Pague com PIX</h2>
        <img src={`data:image/png;base64,${pixData.qrCode}`} alt="PIX QR Code" />
        <p>Ou copie o código abaixo:</p>
        <textarea
          readOnly
          value={pixData.copyPaste}
          style={{ width: '100%', minHeight: '100px', boxSizing: 'border-box', padding: '8px' }}
        />
        <p style={{ color: 'green', marginTop: '10px' }}>Aguardando pagamento...</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '400px', margin: 'auto' }}>
      <form onSubmit={handleCreditCardSubmit}>
        <div style={{ marginBottom: '10px' }}>
          <label>Nome no Cartão</label>
        <input
          type="text"
          name="holderName"
          value={cardData.holderName}
          onChange={handleInputChange}
          required
          style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
        />
      </div>
      <div style={{ marginBottom: '10px' }}>
        <label>Número do Cartão</label>
        <input
          type="text"
          name="number"
          value={cardData.number}
          onChange={handleInputChange}
          placeholder="0000 0000 0000 0000"
          required
          style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
        />
      </div>
      <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
        <div style={{ flex: 1 }}>
          <label>Mês de Validade</label>
          <input
            type="text"
            name="expiryMonth"
            value={cardData.expiryMonth}
            onChange={handleInputChange}
            placeholder="MM"
            required
            style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label>Ano de Validade</label>
          <input
            type="text"
            name="expiryYear"
            value={cardData.expiryYear}
            onChange={handleInputChange}
            placeholder="YYYY"
            required
            style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label>CVV</label>
          <input
            type="text"
            name="cvv"
            value={cardData.cvv}
            onChange={handleInputChange}
            placeholder="123"
            required
            style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
          />
        </div>
      </div>
      <button
        type="submit"
        disabled={processing || succeeded}
        style={{ width: '100%', padding: '10px', background: '#007bff', color: 'white', border: 'none', cursor: 'pointer' }}
        >
          {processing ? 'Processando...' : 'Pagar com Cartão'}
        </button>
      </form>

      <button
        type="button"
        onClick={handlePixSubmit}
        disabled={processing || succeeded}
        style={{ width: '100%', padding: '10px', background: '#00c853', color: 'white', border: 'none', cursor: 'pointer', marginTop: '10px' }}
      >
        {processing ? 'Gerando PIX...' : 'Pagar com PIX'}
      </button>

      {error && <div style={{ color: 'red', marginTop: '10px' }}>{error}</div>}
      {succeeded && !pixData && <div style={{ color: 'green', marginTop: '10px' }}>Pagamento com cartão realizado com sucesso!</div>}
    </div>
  );
};

export default CheckoutForm;
