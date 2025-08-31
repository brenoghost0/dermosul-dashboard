import React from 'react';

interface CreditCardPreviewProps {
  cardName: string;
  cardNumber: string;
  cardExpiryMonth: string;
  cardExpiryYear: string;
  cardCvv: string;
  cardBrand: string;
}

const CreditCardPreview: React.FC<CreditCardPreviewProps> = ({
  cardName,
  cardNumber,
  cardExpiryMonth,
  cardExpiryYear,
  cardBrand,
}) => {
  const formatCardNumber = (num: string) => {
    const cleaned = num.replace(/\D/g, '').padEnd(16, '•');
    return cleaned.match(/.{1,4}/g)?.join(' ') || '';
  };

  const formattedExpiry = `${cardExpiryMonth.padEnd(2, 'M')}/${cardExpiryYear.slice(-2).padEnd(2, 'A')}`;

  return (
    <div className="w-full max-w-xs mx-auto bg-slate-900 rounded-xl shadow-lg text-white font-mono relative aspect-video flex flex-col p-4 sm:p-5">
      {/* Top row: Chip and Brand */}
      <div className="flex justify-between items-center mb-4">
        <div className="w-12 h-8 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-md"></div>
        <div className="h-8">
          {cardBrand !== 'Desconhecida' && (
            <img 
              src={`https://raw.githubusercontent.com/aaronfagan/svg-credit-card-payment-icons/main/mono/${cardBrand.toLowerCase()}.svg`} 
              alt={cardBrand} 
              className="h-full" 
            />
          )}
        </div>
      </div>

      {/* Middle: Card Number */}
      <div className="flex-grow flex items-center justify-center">
        <p className="text-lg md:text-xl tracking-widest whitespace-nowrap">{formatCardNumber(cardNumber)}</p>
      </div>

      {/* Bottom row: Name and Expiry */}
      <div className="flex justify-between items-end text-xs sm:text-sm">
        <div>
          <p className="text-slate-400 uppercase text-xs font-sans">Nome no Cartão</p>
          <p className="tracking-wide uppercase">{cardName || 'NOME COMPLETO'}</p>
        </div>
        <div>
          <p className="text-slate-400 uppercase text-xs font-sans text-right">Validade</p>
          <p className="tracking-wide">{formattedExpiry}</p>
        </div>
      </div>
    </div>
  );
};

export default CreditCardPreview;
